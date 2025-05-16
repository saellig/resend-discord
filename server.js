require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const RESEND_SIGNING_SECRET = process.env.RESEND_SIGNING_SECRET;

app.use(express.json());

// Middleware to verify Resend webhook signature
app.post('/resend-webhook', async (req, res) => {
  const signature = req.headers['resend-signature'];
  const payload = JSON.stringify(req.body);

  // Compute HMAC SHA256 with your signing secret
  const expectedSignature = crypto
    .createHmac('sha256', RESEND_SIGNING_SECRET)
    .update(payload)
    .digest('hex');

  if (!signature || signature !== expectedSignature) {
    console.warn('Invalid signature:', signature);
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  if (!event.type || !event.data) {
    return res.status(400).send('Invalid webhook payload');
  }

  const { type, data } = event;

  // Extract recipient email safely
  const recipientEmail = Array.isArray(data.to) && data.to.length > 0 ? data.to[0].email : 'unknown';

  let message = '';

  switch (type) {
    case 'email.sent':
      message = `📤 **Email sent** to \`${recipientEmail}\`\nSubject: **${data.subject}**`;
      break;
    case 'email.delivered':
      message = `✅ **Email delivered** to \`${recipientEmail}\``;
      break;
    default:
      message = `ℹ️ Received unknown event type: \`${type}\``;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, {
      content: message,
    });

    res.status(200).send('OK');
  } catch (err) {
    console.error('Error sending to Discord:', err.message);
    res.status(500).send('Failed to send to Discord');
  }
});

app.get('/', (req, res) => {
  res.send('Resend Webhook Relay is running!');
});

app.listen(PORT, () => {
  console.log(`Listening on http://localhost:${PORT}`);
});
