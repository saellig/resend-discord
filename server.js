require('dotenv').config();
const express = require('express');
const crypto = require('crypto');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SIGNING_SECRET = process.env.SIGNING_SECRET;

// Capture raw body for signature verification
app.use(bodyParser.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));

// Helper: Verify webhook signature
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = hmac.digest('base64');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
}

app.post('/resend-webhook', async (req, res) => {
  const signature = req.headers['resend-signature'];
  const payload = req.rawBody;

  if (!signature) {
    return res.status(400).send('Missing signature');
  }

  if (!verifySignature(payload, signature, SIGNING_SECRET)) {
    console.error('Invalid signature:', signature);
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;

  if (!event.type || !event.data) {
    return res.status(400).send('Invalid webhook payload');
  }

  const { type, data } = event;
  let message = '';

  switch (type) {
    case 'email.sent':
      message = `📤 **Email sent** to \`${data.to}\`\nSubject: **${data.subject}**`;
      break;
    case 'email.delivered':
      message = `✅ **Email delivered** to \`${data.to}\``;
      break;
    default:
      message = `ℹ️ Received unknown event type: \`${type}\``;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: message });
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
  console.log(`Listening on port ${PORT}`);
});
