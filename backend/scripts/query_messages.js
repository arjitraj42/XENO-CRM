const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const { Campaign, Communication } = require('../models/models');

async function run() {
  // Let the user force a URI via command line, e.g. --uri mongodb://localhost:27017/xeno_crm
  let mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/xeno_crm';
  let isLocalFallback = false;
  
  const uriIndex = process.argv.indexOf('--uri');
  if (uriIndex !== -1 && process.argv[uriIndex + 1]) {
    mongoUri = process.argv[uriIndex + 1];
  }

  // Filter out parameters from process.argv
  const args = process.argv.slice(2).filter((arg, i, arr) => {
    if (arg === '--uri') return false;
    if (i > 0 && arr[i - 1] === '--uri') return false;
    return true;
  });

  const targetCampaignIdInput = args[0];

  async function tryConnectAndQuery(uri) {
    const cleanUri = uri.split('@').pop() || uri;
    console.log(`Connecting to database: ${cleanUri}...`);
    try {
      // Connect with a 5-second timeout so it doesn't hang forever if the host is down
      await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
      
      const campaignsCount = await Campaign.countDocuments();
      if (campaignsCount === 0) {
        await mongoose.connection.close();
        return { success: false, reason: 'Connected, but database is empty (no campaigns found).' };
      }
      return { success: true };
    } catch (err) {
      return { success: false, reason: err.message };
    }
  }

  let connectionResult = await tryConnectAndQuery(mongoUri);

  // If the cloud DB from .env failed or returned 0 campaigns, try local fallback
  if (!connectionResult.success && mongoUri !== 'mongodb://localhost:27017/xeno_crm' && (uriIndex === -1)) {
    console.log(`\nNote: Cloud DB check returned: "${connectionResult.reason}".`);
    console.log(`Checking local MongoDB fallback (mongodb://localhost:27017/xeno_crm)...`);
    mongoUri = 'mongodb://localhost:27017/xeno_crm';
    isLocalFallback = true;
    connectionResult = await tryConnectAndQuery(mongoUri);
  }

  if (!connectionResult.success) {
    console.error(`\nError: Could not find any campaign records.`);
    console.error(`Reason: ${connectionResult.reason}`);
    console.error(`\nMake sure your MongoDB server is running or MONGO_URI in backend/.env is correct.`);
    process.exit(1);
  }

  console.log(`Connected successfully to database.\n`);

  try {
    // Find last 5 campaigns
    const campaigns = await Campaign.find({}).sort({ created_at: -1 }).limit(5);
    
    console.log('--- LATEST CAMPAIGNS ---');
    console.table(campaigns.map(c => ({
      ID: c.id,
      Name: c.name,
      Channel: c.channel,
      Status: c.status,
      Created: c.created_at.toISOString()
    })));
    
    // Check if the user passed a specific campaign ID, otherwise use the latest
    const targetCampaignId = targetCampaignIdInput || campaigns[0].id;
    console.log(`\nQuerying messages for campaign ID: "${targetCampaignId}"`);
    
    const campaign = await Campaign.findOne({ id: targetCampaignId });
    if (!campaign) {
      console.error(`Error: Campaign with ID "${targetCampaignId}" not found.`);
      process.exit(1);
    }
    
    console.log(`Campaign Name: "${campaign.name}" | Template: "${campaign.message_template}"`);
    
    const communications = await Communication.find({ campaign_id: targetCampaignId });
    
    if (communications.length === 0) {
      console.log('No dispatched messages found for this campaign.');
      process.exit(0);
    }
    
    // Status breakdown
    const breakdown = {};
    communications.forEach(c => {
      breakdown[c.status] = (breakdown[c.status] || 0) + 1;
    });
    
    console.log('\n--- MESSAGE STATUS BREAKDOWN ---');
    console.table(Object.keys(breakdown).map(status => ({
      Status: status,
      Count: breakdown[status]
    })));
    
    console.log('\n--- SAMPLE DISPATCHED MESSAGES (Up to 15) ---');
    console.table(communications.slice(0, 15).map(c => ({
      CommID: c.id,
      Recipient: c.recipient,
      Status: c.status,
      Message: c.message.length > 60 ? c.message.substring(0, 57) + '...' : c.message
    })));
    
    if (communications.length > 15) {
      console.log(`... and ${communications.length - 15} more messages.`);
    }
    
  } catch (error) {
    console.error('Error querying database:', error);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
}

run();
