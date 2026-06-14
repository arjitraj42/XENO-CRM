const express = require('express');
const cors = require('cors');
const axios = require('axios');
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

app.get('/health', (req, res) => {
  res.json({ status: 'OK', uptime: process.uptime() });
});

async function fireCallback(callbackUrl, payload, attempt = 0) {
  try {
    await axios.post(callbackUrl, payload, { timeout: 5000 });
  } catch (err) {
    if (attempt < 3) {
      setTimeout(() => fireCallback(callbackUrl, payload, attempt + 1), Math.pow(2, attempt) * 1000);
    }
  }
}

app.post('/send', (req, res) => {
  const { comm_id, recipient, channel, message, callback_url } = req.body;
  if (!comm_id || !recipient || !channel || !message || !callback_url) {
    return res.status(400).json({ error: 'Missing required delivery parameters' });
  }

  res.status(202).json({ success: true, status: 'dispatched' });

  const initialDelay = Math.random() * 3500 + 500;
  setTimeout(() => {
    if (Math.random() * 100 < 5) {
      fireCallback(callback_url, { comm_id, status: 'FAILED', timestamp: new Date().toISOString(), error_message: 'Network Congestion / Timeout' });
      return;
    }

    fireCallback(callback_url, { comm_id, status: 'DELIVERED', timestamp: new Date().toISOString() });

    if (Math.random() * 100 < 65) {
      setTimeout(() => {
        fireCallback(callback_url, { comm_id, status: 'OPENED', timestamp: new Date().toISOString() });

        if (Math.random() * 100 < 70) {
          setTimeout(() => {
            fireCallback(callback_url, { comm_id, status: 'READ', timestamp: new Date().toISOString() });

            if (Math.random() * 100 < 40) {
              setTimeout(() => {
                fireCallback(callback_url, { comm_id, status: 'CLICKED', timestamp: new Date().toISOString() });
              }, Math.random() * 3000 + 1000);
            }
          }, Math.random() * 2500 + 1500);
        }
      }, Math.random() * 3500 + 1500);
    }
  }, initialDelay);
});

function startScheduler() {
  setInterval(async () => {
    try {
      const due = await Campaign.find({ status: 'SCHEDULED', schedule_time: { $lte: new Date() } });
      for (const c of due) queueManager.dispatchCampaign(c.id);
    } catch (err) {
      console.error('[Scheduler] Error:', err);
    }
  }, 10000);
}

startScheduler();

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`XENO CRM running on port ${PORT}`));
