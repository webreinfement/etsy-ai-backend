const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateKey } = require('./keys');
const { sendKeyEmail } = require('../email');

const router = express.Router();

// Maps Stripe Price IDs to { tier, days }
// Add your price IDs to Railway env vars
const PRICE_MAP = {
  [process.env.STRIPE_PRICE_T1_DAY]:   { tier: 1, days: 1 },
  [process.env.STRIPE_PRICE_T1_WEEK]:  { tier: 1, days: 7 },
  [process.env.STRIPE_PRICE_T1_MONTH]: { tier: 1, days: 30 },
  [process.env.STRIPE_PRICE_T2_DAY]:   { tier: 2, days: 1 },
  [process.env.STRIPE_PRICE_T2_WEEK]:  { tier: 2, days: 7 },
  [process.env.STRIPE_PRICE_T2_MONTH]: { tier: 2, days: 30 },
};

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Webhook received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email;
    const customerId = session.customer;
    const paymentIntentId = session.payment_intent;

    console.log('Session email:', email, 'customer:', customerId, 'payment:', paymentIntentId);

    if (!email) {
      console.log('No email found, skipping');
      return res.json({ received: true });
    }

    try {
      console.log('Fetching line items...');
      const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
      const priceId = lineItems.data[0]?.price?.id;
      const { tier = 1, days = 30 } = PRICE_MAP[priceId] || {};
      console.log('Price ID:', priceId, 'Tier:', tier, 'Days:', days);

      console.log('Generating key...');
      const keyData = await generateKey(email, customerId, paymentIntentId, tier, days);
      console.log(`Key generated: ${keyData.key}`);

      console.log('Sending email...');
      await sendKeyEmail(email, keyData.key, tier, days);
      console.log('Email sent!');
    } catch (err) {
      console.error('Error:', err.message, err.stack);
    }
  }

  res.json({ received: true });
});

module.exports = router;
