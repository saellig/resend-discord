require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SIGNING_SECRET = process.env.SIGNING_SECRET;

// Middleware to capture raw body for signature verification
app.use((req, res, next) => {
  let data = '';
  req.setEncoding('utf8');
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    next();
  });
});

app.use(express.json());

// Verify signature function
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = hmac.digest('base64');
  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

app.post('/resend-webhook', async (req, res) => {
  const signature = req.headers['resend-signature'];

  if (!signature) {
    console.error('Missing signature header');
    return res.status(400).send('Missing signature');
  }

  if (!verifySignature(req.rawBody, signature, SIGNING_SECRET)) {
    console.error('Invalid signature:', signature);
    return res.status(401).send('Invalid signature');
  }

  // Log entire event for debugging
  console.log('Received event:', JSON.stringify(req.body, null, 2));

  const event = req.body;

  // Handle if event structure is nested
  let eventType = event.type;
  let eventData = event.data;

  // Example fallback if payload is wrapped (adjust if needed)
  if (eventType === 'event_callback' && event.data) {
    eventType = event.data.type;
    eventData = event.data.data;
  }

  if (!eventType || !eventData) {
    console.error('Invalid webhook payload:', req.body);
    return res.status(400).send('Invalid webhook payload');
  }

  let message = '';

  switch (eventType) {
    case 'email.sent':
      message = `📤 **Email sent** to \`${eventData.to}\`\nSubject: **${eventData.subject}**`;
      break;
    case 'email.delivered':
      message = `✅ **Email delivered** to \`${eventData.to}\``;
      break;
    default:
      message = `ℹ️ Received unknown event type: \`${eventType}\``;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: message });
    return res.status(200).send('OK');
  } catch (err) {
    console.error('Error sending to Discord:', err.message);
    return res.status(500).send('Failed to send to Discord');
  }
});

app.get('/', (req, res) => {
  res.send('Resend Webhook Relay is running!');
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
