const express = require('express');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { generateKey } = require('./keys');
const { sendKeyEmail, sendExpiryEmail } = require('../email');

const router = express.Router();

// Stripe sends events here after payment
router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const email = session.customer_details?.email;
      const customerId = session.customer;
      const subscriptionId = session.subscription;

      if (!email) break;

      try {
        const keyData = await generateKey(email, customerId, subscriptionId);
        console.log(`Key generated for ${email}: ${keyData.key}`);
        await sendKeyEmail(email, keyData.key);
      } catch (err) {
        console.error('Failed to generate key:', err.message);
      }
      break;
    }

    case 'customer.subscription.deleted':
    case 'invoice.payment_failed': {
      const obj = event.data.object;
      const subscriptionId = obj.id || obj.subscription;

      if (subscriptionId) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const { data: keyRow } = await supabase
          .from('license_keys')
          .update({ status: 'expired' })
          .eq('stripe_subscription_id', subscriptionId)
          .select('email, key')
          .single();

        if (keyRow) {
          await sendExpiryEmail(keyRow.email, keyRow.key);
        }
      }
      break;
    }

    case 'invoice.payment_succeeded': {
      // Renew subscription for another month
      const invoice = event.data.object;
      const subscriptionId = invoice.subscription;

      if (subscriptionId) {
        const { createClient } = require('@supabase/supabase-js');
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
        const newExpiry = new Date();
        newExpiry.setMonth(newExpiry.getMonth() + 1);
        await supabase
          .from('license_keys')
          .update({ status: 'active', expires_at: newExpiry.toISOString() })
          .eq('stripe_subscription_id', subscriptionId);
      }
      break;
    }
  }

  res.json({ received: true });
});

module.exports = router;
