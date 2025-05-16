require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const app = express();

const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SIGNING_SECRET = process.env.SIGNING_SECRET;

// Use raw buffer to capture rawBody before parsing
app.use('/resend-webhook', express.raw({ type: '*/*' }));

// Signature verifier
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const digest = hmac.digest('base64');
  return signature === digest;
}

// Webhook endpoint
app.post('/resend-webhook', async (req, res) => {
  const signature = req.headers['resend-signature'];
  const rawBody = req.body;

  if (!signature || !verifySignature(rawBody, signature, SIGNING_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = JSON.parse(rawBody.toString('utf8'));

  const { type, data } = event;
  if (!type || !data) {
    return res.status(400).send('Invalid webhook payload');
  }

  let message;
  if (type === 'email.sent') {
    message = `📤 **Email sent** to \`${data.to}\`\nSubject: **${data.subject}**`;
  } else if (type === 'email.delivered') {
    message = `✅ **Email delivered** to \`${data.to}\``;
  } else {
    message = `ℹ️ Unknown event type: \`${type}\``;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: message });
    res.status(200).send('OK');
  } catch {
    res.status(500).send('Failed to send to Discord');
  }
});

// Basic health check
app.get('/', (req, res) => {
  res.send('Resend Webhook Relay is running!');
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
