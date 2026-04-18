require('dotenv').config();
const express = require('express');
const cors = require('cors');

const chatRouter = require('./routes/chat');
const keysRouter = require('./routes/keys');
const webhookRouter = require('./routes/webhook');

const app = express();

// Stripe webhooks need raw body — must be before express.json()
app.use('/api/webhook', express.raw({ type: 'application/json' }), webhookRouter);

app.use(cors());
app.use(express.json());

app.use('/api/chat', chatRouter);
app.use('/api/keys', keysRouter);

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
