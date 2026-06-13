const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const { Campaign } = require('./models/models');
const { queueManager } = require('./utils/queue');

// Load environment variables
dotenv.config();

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow all origins for dev
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Mount API Routes
app.use('/api', apiRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Start scheduler check loop (runs every 10 seconds to check for pending campaigns)
const startCampaignScheduler = () => {
  console.log('[Scheduler] Scheduled campaigns worker started.');
  setInterval(async () => {
    try {
      const now = new Date();
      // Find campaigns that are SCHEDULED and whose schedule_time is in the past
      const pendingCampaigns = await Campaign.find({
        status: 'SCHEDULED',
        schedule_time: { $lte: now }
      });

      for (const campaign of pendingCampaigns) {
        console.log(`[Scheduler] Firing scheduled campaign: ${campaign.name} (${campaign.id})`);
        // We use queueManager to dispatch
        queueManager.dispatchCampaign(campaign.id);
      }
    } catch (error) {
      console.error('[Scheduler] Error checking scheduled campaigns:', error);
    }
  }, 10000); // 10s intervals
};

startCampaignScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Mini CRM Server running on port ${PORT}`);
});
