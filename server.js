require('dotenv').config();
const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 8080;
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const SIGNING_SECRET = process.env.SIGNING_SECRET;

if (!DISCORD_WEBHOOK_URL || !SIGNING_SECRET) {
  console.error('ERROR: Missing DISCORD_WEBHOOK_URL or SIGNING_SECRET in environment!');
  process.exit(1);
}

// Middleware to capture raw body for signature verification
app.use((req, res, next) => {
  let data = '';
  req.on('data', chunk => {
    data += chunk;
  });
  req.on('end', () => {
    req.rawBody = data;
    try {
      req.body = JSON.parse(data);
    } catch {
      req.body = {};
    }
    next();
  });
});

// Verify signature function
function verifySignature(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload, 'utf8');
  const digest = hmac.digest('base64');
  return signature === digest;
}

app.post('/resend-webhook', async (req, res) => {
  const signature = req.headers['resend-signature'];
  if (!signature) {
    return res.status(401).send('Missing signature header');
  }

  if (!verifySignature(req.rawBody, signature, SIGNING_SECRET)) {
    return res.status(401).send('Invalid signature');
  }

  const event = req.body;
  if (!event.type || !event.data) {
    return res.status(400).send('Invalid webhook payload');
  }

  let message;
  switch (event.type) {
    case 'email.sent':
      message = `📤 **Email sent** to \`${event.data.to}\`\nSubject: **${event.data.subject}**`;
      break;
    case 'email.delivered':
      message = `✅ **Email delivered** to \`${event.data.to}\``;
      break;
    default:
      message = `ℹ️ Unknown event type: \`${event.type}\``;
  }

  try {
    await axios.post(DISCORD_WEBHOOK_URL, { content: message });
    return res.status(200).send('OK');
  } catch (err) {
    return res.status(500).send('Failed to send to Discord');
  }
});

app.get('/', (req, res) => {
  res.send('Resend Webhook Relay is running!');
});

app.listen(PORT, () => {
  console.log(`Listening on port ${PORT}`);
});
