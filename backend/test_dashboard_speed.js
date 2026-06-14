const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const OrderSchema = new mongoose.Schema({
  id: String,
  customer_id: String,
  amount: Number,
  status: String,
  channel: String,
  created_at: Date
}, { collection: 'orders' });

const CustomerSchema = new mongoose.Schema({
  id: String,
  name: String,
  email: String,
  phone: String,
  lifetime_value: Number,
  last_purchase_at: Date
}, { collection: 'customers' });

const CampaignSchema = new mongoose.Schema({
  id: String,
  name: String,
  status: String,
  channel: String
}, { collection: 'campaigns' });

const CommunicationSchema = new mongoose.Schema({
  id: String,
  campaign_id: String,
  customer_id: String,
  status: String,
  updated_at: Date
}, { collection: 'communications' });

const Order = mongoose.model('Order', OrderSchema);
const Customer = mongoose.model('Customer', CustomerSchema);
const Campaign = mongoose.model('Campaign', CampaignSchema);
const Communication = mongoose.model('Communication', CommunicationSchema);

async function runTest() {
  console.log('Connecting to MongoDB Atlas...');
  const startConnect = Date.now();
  await mongoose.connect(process.env.MONGO_URI);
  console.log(`Connected in ${Date.now() - startConnect}ms\n`);

  const now = new Date();

  // 1. Revenue Trend
  console.time('1. Revenue Trend');
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 120);
  await Order.aggregate([
    { $match: { status: 'COMPLETED', created_at: { $gte: ninetyDaysAgo } } },
    { $group: {
      _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
      revenue: { $sum: "$amount" },
      ordersCount: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);
  console.timeEnd('1. Revenue Trend');

  // 2. Audience Growth
  console.time('2. Audience Growth');
  await Customer.aggregate([
    { $group: {
      _id: { $dateToString: { format: "%Y-%m", date: "$created_at" } },
      count: { $sum: 1 }
    }},
    { $sort: { _id: 1 } }
  ]);
  console.timeEnd('2. Audience Growth');

  // 3. Channel Breakout
  console.time('3. Channel Breakout');
  await Order.aggregate([
    { $match: { status: 'COMPLETED' } },
    { $group: {
      _id: "$channel",
      value: { $sum: "$amount" }
    }}
  ]);
  console.timeEnd('3. Channel Breakout');

  // 4. Best Campaign
  console.time('4. Best Campaign (Entire Block)');
  const campaigns = await Campaign.find({ status: 'COMPLETED' });
  let bestCampaign = null;
  let maxRevenueLift = -1;

  console.log(`Analyzing ${campaigns.length} completed campaigns...`);
  for (const campaign of campaigns) {
    const cStart = Date.now();
    const comms = await Communication.find({ campaign_id: campaign.id });
    const activeComms = comms.filter(c => 
      ['DELIVERED', 'OPENED', 'READ', 'CLICKED'].includes(c.status)
    );

    if (activeComms.length > 0) {
      const customerIds = activeComms.map(c => c.customer_id);
      const dispatchTimes = activeComms.map(c => new Date(c.updated_at).getTime());
      const minTime = new Date(Math.min(...dispatchTimes));
      const maxTime = new Date(Math.max(...dispatchTimes) + 24 * 60 * 60 * 1000);

      const orders = await Order.find({
        customer_id: { $in: customerIds },
        status: 'COMPLETED',
        created_at: { $gte: minTime, $lte: maxTime }
      });

      const ordersByCustomer = {};
      for (const order of orders) {
        const cid = order.customer_id.toString();
        if (!ordersByCustomer[cid]) ordersByCustomer[cid] = [];
        ordersByCustomer[cid].push(order);
      }

      let attributedOrders = 0;
      let revenueLift = 0;
      for (const comm of activeComms) {
        const cid = comm.customer_id.toString();
        const customerOrders = ordersByCustomer[cid] || [];
        const dispatchTime = new Date(comm.updated_at).getTime();
        const windowEnd = dispatchTime + 24 * 60 * 60 * 1000;

        const matchingOrders = customerOrders.filter(o => {
          const oTime = new Date(o.created_at).getTime();
          return oTime >= dispatchTime && oTime <= windowEnd;
        });

        if (matchingOrders.length > 0) {
          attributedOrders += matchingOrders.length;
          revenueLift += matchingOrders.reduce((sum, o) => sum + o.amount, 0);
        }
      }
    }
    console.log(`  Campaign "${campaign.name}" analyzed in ${Date.now() - cStart}ms`);
  }
  console.timeEnd('4. Best Campaign (Entire Block)');

  // 5. Churn Risks
  console.time('5. Churn Risks');
  const allCustomers = await Customer.find({ last_purchase_at: { $ne: null } })
    .sort({ last_purchase_at: 1 })
    .limit(100);
  console.timeEnd('5. Churn Risks');

  // 6. Top Customers
  console.time('6. Top Customers');
  await Customer.find({}).sort({ lifetime_value: -1 }).limit(5);
  console.timeEnd('6. Top Customers');

  // 7. High Risk Count
  console.time('7. High Risk Count');
  await Customer.countDocuments({
    last_purchase_at: { $lte: new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000) }
  });
  console.timeEnd('7. High Risk Count');

  await mongoose.disconnect();
  console.log('\nDisconnected.');
}

runTest().catch(console.error);
