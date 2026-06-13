const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const apiRoutes = require('./routes/api');
const { Campaign } = require('./models/models');
const { queueManager } = require('./utils/queue');

dotenv.config();
connectDB();

const app = express();

app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Content-Type', 'Authorization'] }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/api', apiRoutes);

// Simple health check so we know the server's alive
app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

// Runs every 10s and fires off any campaigns that were scheduled to go out
function startScheduler() {
  console.log('[Scheduler] Scheduled campaigns worker started.');
  setInterval(async () => {
    try {
      const due = await Campaign.find({
        status: 'SCHEDULED',
        schedule_time: { $lte: new Date() }
      });
      for (const c of due) {
        console.log(`[Scheduler] Firing: ${c.name} (${c.id})`);
        queueManager.dispatchCampaign(c.id);
      }
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  }, 10000);
}

startScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Mini CRM Server running on port ${PORT}`));
