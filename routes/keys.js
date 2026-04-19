const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const TIER_LIMITS = {
  1: 250,
  2: 500
};

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
    return { valid: false, expired: true, message: 'Your access has expired. Please purchase again to continue.' };
  }

  if (data.expires_at && new Date(data.expires_at) < new Date()) {
    await supabase.from('license_keys').update({ status: 'expired' }).eq('key', key);
    return { valid: false, expired: true, message: 'Your access has expired. Please purchase again to continue.' };
  }

  // Check daily usage limit
  const dailyLimit = TIER_LIMITS[data.tier] || 250;
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  if (data.last_used_date === today && data.daily_usage >= dailyLimit) {
    return {
      valid: false,
      message: `Daily limit reached (${dailyLimit} uses). Come back tomorrow or upgrade to Pro.`
    };
  }

  return {
    valid: true,
    data,
    incrementUsage: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const isNewDay = data.last_used_date !== today;

      await supabase
        .from('license_keys')
        .update({
          usage_count: (data.usage_count || 0) + 1,
          daily_usage: isNewDay ? 1 : (data.daily_usage || 0) + 1,
          last_used_date: today,
          last_used_at: new Date().toISOString()
        })
        .eq('key', key);
    }
  };
}

async function generateKey(email, stripeCustomerId, paymentIntentId, tier = 1, days = 30) {
  const key = `ESY-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}-${uuidv4().replace(/-/g, '').toUpperCase().slice(0, 4)}`;

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + days);

  const { data, error } = await supabase.from('license_keys').insert({
    key,
    email,
    tier,
    stripe_customer_id: stripeCustomerId,
    stripe_subscription_id: paymentIntentId,
    status: 'active',
    usage_count: 0,
    daily_usage: 0,
    last_used_date: null,
    expires_at: expiresAt.toISOString(),
    created_at: new Date().toISOString()
  }).select().single();

  if (error) throw error;
  return data;
}

router.post('/validate', async (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ valid: false, message: 'No key provided.' });

  const result = await validateKey(key);
  return res.json({
    valid: result.valid,
    message: result.message,
    expires_at: result.data?.expires_at || null,
    tier: result.data?.tier || null
  });
});

module.exports = router;
module.exports.validateKey = validateKey;
module.exports.generateKey = generateKey;
