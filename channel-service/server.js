const express = require('express');
const cors = require('cors');
const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Helper to fire webhook callback with up to 3 retries and exponential backoff
async function fireCallbackWithRetry(callbackUrl, payload, attempt = 0) {
  try {
    console.log(`[Channel Service] Posting callback for Comm: ${payload.comm_id} (Status: ${payload.status}) to CRM. Attempt: ${attempt + 1}...`);
    const response = await axios.post(callbackUrl, payload, { timeout: 5000 });
    if (response.status === 200) {
      console.log(`[Channel Service] Webhook callback successful for ${payload.comm_id} (Status: ${payload.status})`);
    } else {
      throw new Error(`CRM Backend returned status: ${response.status}`);
    }
  } catch (error) {
    console.error(`[Channel Service] Webhook callback failed for ${payload.comm_id} (Status: ${payload.status}): ${error.message}`);
    if (attempt < 3) {
      const delay = Math.pow(2, attempt) * 1000;
      console.log(`[Channel Service] Retrying webhook callback for ${payload.comm_id} in ${delay}ms...`);
      setTimeout(() => {
        fireCallbackWithRetry(callbackUrl, payload, attempt + 1);
      }, delay);
    } else {
      console.error(`[Channel Service] Webhook callback permanently failed for ${payload.comm_id} (Status: ${payload.status}) after 3 attempts.`);
    }
  }
}

// POST /send - Simulates delivery dispatching
app.post('/send', (req, res) => {
  const { comm_id, recipient, channel, message, callback_url } = req.body;

  if (!comm_id || !recipient || !channel || !message || !callback_url) {
    return res.status(400).json({ error: 'Missing required delivery parameters' });
  }

  // Acknowledge receipt immediately to CRM (Async dispatch simulation)
  res.status(202).json({ success: true, status: 'dispatched' });

  // Simulate network/delivery latency: 0.5s to 4s
  const initialDelay = Math.random() * (4000 - 500) + 500;

  setTimeout(() => {
    // Simulate initial outcome
    // 90% delivered, 5% failed, rest are queued or pending (we treat as delivered for progressive click-through simulation)
    const roll = Math.random() * 100;
    
    if (roll < 5) {
      // Failed (5%)
      const payload = {
        comm_id,
        status: 'FAILED',
        timestamp: new Date().toISOString(),
        error_message: 'Network Congestion / Timeout'
      };
      fireCallbackWithRetry(callback_url, payload);
    } else {
      // Delivered (95%)
      const deliveredPayload = {
        comm_id,
        status: 'DELIVERED',
        timestamp: new Date().toISOString()
      };
      fireCallbackWithRetry(callback_url, deliveredPayload);

      // Simulate progressive events: Delivered -> Opened -> Read -> Clicked
      // 1. Progress to OPENED (65% chance) after 1.5s - 5s
      const openChance = 65;
      if (Math.random() * 100 < openChance) {
        const openDelay = Math.random() * (5000 - 1500) + 1500;
        setTimeout(() => {
          const openedPayload = {
            comm_id,
            status: 'OPENED',
            timestamp: new Date().toISOString()
          };
          fireCallbackWithRetry(callback_url, openedPayload);

          // 2. Progress to READ (70% chance) after 1.5s - 4s
          const readChance = 70;
          if (Math.random() * 100 < readChance) {
            const readDelay = Math.random() * (4000 - 1500) + 1500;
            setTimeout(() => {
              const readPayload = {
                comm_id,
                status: 'READ',
                timestamp: new Date().toISOString()
              };
              fireCallbackWithRetry(callback_url, readPayload);

              // 3. Progress to CLICKED (40% chance) after 1s - 4s
              const clickChance = 40;
              if (Math.random() * 100 < clickChance) {
                const clickDelay = Math.random() * (4000 - 1000) + 1000;
                setTimeout(() => {
                  const clickedPayload = {
                    comm_id,
                    status: 'CLICKED',
                    timestamp: new Date().toISOString()
                  };
                  fireCallbackWithRetry(callback_url, clickedPayload);
                }, clickDelay);
              }

            }, readDelay);
          }

        }, openDelay);
      }
    }
  }, initialDelay);
});

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Channel Service Stub running on port ${PORT}`);
});
