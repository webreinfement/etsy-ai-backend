const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// Validate a key and return status + incrementUsage helper
async function validateKey(key) {
  const { data, error } = await supabase
    .from('license_keys')
    .select('*')
    .eq('key', key)
    .single();

  if (error || !data) {
    return { valid: false, message: 'Key not found.' };
  }

  if (data.status !== 'active') {
    return { valid: false, expired: true, message: 'Subscription expired. Please renew.' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    // Auto-expire
    await supabase.from('license_keys').update({ status: 'expired' }).eq('key', key);
    return { valid: false, expired: true, message: 'Subscription expired. Please renew.' };
  }

  return {
    valid: true,
    data,
    incrementUsage: async () => {
      await supabase
        .from('license_keys')
        .update({ usage_count: (data.usage_count || 0) + 1, last_used_at: new Date().toISOString() })
        .eq('key', key);
    }
  };
}

// Generate a new license key (called by Stripe webhook after payment)
async function generateKey(email, stripeCustomerId, subscriptionId) {
  const key = `ESY-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}`;

  const expiresAt = new Date();
  expiresAt.setMonth(expiresAt.getMonth() + 1); // 1-month subscription

  const { data, error } = await supabase.from('license_keys').insert({
    key,
    email,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: subscriptionId,
    status: 'active',
    usage_count: 0,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString()
  }).select().single();

  if (error) throw error;
  return data;
}

// Validate key endpoint (called by extension)
router.post('/validate', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, message: 'No key provided.' });

  const result = await validateKey(key);
  return res.json({ valid: result.valid, message: result.message });
});

module.exports = router;
module.exports.validateKey = validateKey;
module.exports.generateKey = generateKey;
