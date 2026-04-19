const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateKey } = require('./keys');
const { sendKeyEmail } = require('../email');

const router = express.Router();

// Add your Stripe Price IDs here after creating products in Stripe dashboard
const TIER_PRICE_IDS = {
  [process.env.STRIPE_PRICE_STARTER]: 1, // $8 starter
  [process.env.STRIPE_PRICE_PRO]: 2      // $15 pro
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
      const tier = TIER_PRICE_IDS[priceId] || 1;
      console.log('Price ID:', priceId, 'Tier:', tier);

      console.log('Generating key...');
      const keyData = await generateKey(email, customerId, paymentIntentId, tier);
      console.log(`Key generated: ${keyData.key}`);

      console.log('Sending email...');
      await sendKeyEmail(email, keyData.key, tier);
      console.log('Email sent!');
    } catch (err) {
      console.error('Error:', err.message, err.stack);
    }
  }

  res.json({ received: true });
});

module.exports = router;
