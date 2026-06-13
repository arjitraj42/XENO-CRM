const axios = require('axios');
const { Customer, Communication, Campaign } = require('../models/models');

class QueueManager {
  constructor(concurrency = 10) {
    this.concurrency = concurrency;
    this.activeWorkers = 0;
    this.queue = [];
  }

  // Enqueue a job
  enqueue(jobFn) {
    this.queue.push(jobFn);
    this.processNext();
  }

  // Process next items in the queue up to concurrency limit
  processNext() {
    while (this.activeWorkers < this.concurrency && this.queue.length > 0) {
      const jobFn = this.queue.shift();
      this.activeWorkers++;
      
      jobFn()
        .catch(err => console.error('Queue Job Error:', err))
        .finally(() => {
          this.activeWorkers--;
          this.processNext();
        });
    }
  }

  /**
   * Dispatches a campaign to the targeted segment.
   * Feeds the list of customers, creates communications, and enqueues sends.
   */
  async dispatchCampaign(campaignId) {
    console.log(`[Queue] Starting dispatch for Campaign: ${campaignId}`);
    try {
      const campaign = await Campaign.findOne({ id: campaignId });
      if (!campaign) {
        throw new Error(`Campaign ${campaignId} not found`);
      }

      // Update campaign status
      campaign.status = 'SENDING';
      await campaign.save();

      // Resolve the segment audience
      const segment = await mongooseModelResolveSegment(campaign.segment_id);
      if (!segment) {
        campaign.status = 'DRAFT';
        await campaign.save();
        throw new Error(`Segment ${campaign.segment_id} not found`);
      }

      // Query customers based on segment filters
      const customers = await queryCustomersByFilter(segment.filter_json);
      console.log(`[Queue] Found ${customers.length} target customers for Campaign: ${campaign.name}`);

      if (customers.length === 0) {
        campaign.status = 'COMPLETED';
        await campaign.save();
        console.log(`[Queue] Campaign ${campaignId} completed with 0 recipients`);
        return;
      }

      const channelServiceUrl = process.env.CHANNEL_SERVICE_URL || 'http://localhost:5001';
      const callbackUrl = `${process.env.CRM_BACKEND_URL || 'http://localhost:5000'}/api/receipts`;

      // Create communication records and queue their dispatch
      let processedCount = 0;
      for (const customer of customers) {
        const commId = `comm_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;
        
        // Personalize template
        let message = campaign.message_template
          .replace(/\{\{name\}\}/g, customer.name)
          .replace(/\{\{ltv\}\}/g, customer.lifetime_value.toFixed(2));

        const recipient = campaign.channel === 'email' ? customer.email : customer.phone;

        // Create Communication record
        const communication = new Communication({
          id: commId,
          campaign_id: campaignId,
          customer_id: customer.id,
          recipient,
          channel: campaign.channel,
          message,
          status: 'QUEUED'
        });
        await communication.save();

        // Enqueue sending
        this.enqueue(async () => {
          await this.sendToChannelWithRetry(communication, channelServiceUrl, callbackUrl);
          processedCount++;
          if (processedCount === customers.length) {
            // All dispatched
            const campaignRecord = await Campaign.findOne({ id: campaignId });
            if (campaignRecord) {
              campaignRecord.status = 'COMPLETED';
              await campaignRecord.save();
              console.log(`[Queue] Campaign ${campaignId} completed dispatching all ${customers.length} communications`);
            }
          }
        });
      }
    } catch (error) {
      console.error(`[Queue] Error dispatching campaign ${campaignId}:`, error);
      const campaign = await Campaign.findOne({ id: campaignId });
      if (campaign) {
        campaign.status = 'DRAFT';
        await campaign.save();
      }
    }
  }

  /**
   * Dispatches a single communication message to the Channel Service.
   * Implements up to 3 retries with exponential backoff on HTTP failure.
   */
  async sendToChannelWithRetry(communication, channelServiceUrl, callbackUrl, retryCount = 0) {
    try {
      console.log(`[Queue] Sending communication ${communication.id} to channel (Attempt ${retryCount + 1})...`);
      
      const payload = {
        comm_id: communication.id,
        recipient: communication.recipient,
        channel: communication.channel,
        message: communication.message,
        callback_url: callbackUrl
      };

      const response = await axios.post(`${channelServiceUrl}/send`, payload, { timeout: 5000 });

      if (response.status === 200 || response.status === 202) {
        communication.status = 'SENT';
        await communication.save();
        console.log(`[Queue] Comm ${communication.id} dispatched successfully`);
      } else {
        throw new Error(`Channel service returned status: ${response.status}`);
      }
    } catch (error) {
      console.error(`[Queue] Dispatch failed for Comm ${communication.id}: ${error.message}`);
      
      if (retryCount < 3) {
        const backoffDelay = Math.pow(2, retryCount) * 1000;
        console.log(`[Queue] Retrying Comm ${communication.id} in ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
        return this.sendToChannelWithRetry(communication, channelServiceUrl, callbackUrl, retryCount + 1);
      } else {
        communication.status = 'FAILED';
        communication.error_message = error.message;
        await communication.save();
        console.error(`[Queue] Comm ${communication.id} permanently failed after 3 retries.`);
      }
    }
  }
}

// Helper to resolve segment
async function mongooseModelResolveSegment(segmentId) {
  const { Segment } = require('../models/models');
  return await Segment.findOne({ id: segmentId });
}

// Helper to query customers dynamically using segment filter
async function queryCustomersByFilter(filterJson) {
  const { Customer } = require('../models/models');
  const query = {};

  if (!filterJson) return await Customer.find({});

  // 1. LTV Filters
  if (filterJson.ltv_gt !== undefined) {
    query.lifetime_value = { ...query.lifetime_value, $gt: filterJson.ltv_gt };
  }
  if (filterJson.ltv_lt !== undefined) {
    query.lifetime_value = { ...query.lifetime_value, $lt: filterJson.ltv_lt };
  }

  // 2. City Filters
  if (filterJson.city) {
    if (Array.isArray(filterJson.city)) {
      query.city = { $in: filterJson.city };
    } else {
      query.city = filterJson.city;
    }
  }

  // 3. Age Filters
  if (filterJson.age_gt !== undefined) {
    query.age = { ...query.age, $gt: filterJson.age_gt };
  }
  if (filterJson.age_lt !== undefined) {
    query.age = { ...query.age, $lt: filterJson.age_lt };
  }

  // 4. Gender Filters
  if (filterJson.gender) {
    query.gender = filterJson.gender;
  }

  // 5. Tag Filters
  if (filterJson.tags && filterJson.tags.length > 0) {
    query.tags = { $all: filterJson.tags };
  }

  // 6. Recency Filters (last purchase days ago)
  // Current time is 2026-06-12T13:19:44+05:30. We'll use the actual date.
  const now = new Date();
  if (filterJson.last_purchase_days_ago_gt !== undefined) {
    const cutoffDate = new Date(now.getTime() - filterJson.last_purchase_days_ago_gt * 24 * 60 * 60 * 1000);
    query.last_purchase_at = { ...query.last_purchase_at, $lt: cutoffDate };
  }
  if (filterJson.last_purchase_days_ago_lt !== undefined) {
    const cutoffDate = new Date(now.getTime() - filterJson.last_purchase_days_ago_lt * 24 * 60 * 60 * 1000);
    query.last_purchase_at = { ...query.last_purchase_at, $gt: cutoffDate };
  }

  // 7. Order count filters could require aggregation, but if stored or simulated:
  // For the scope of this assignment, we will filter on these customer-level metadata.
  
  return await Customer.find(query);
}

const queueManager = new QueueManager();

module.exports = {
  queueManager,
  queryCustomersByFilter
};
