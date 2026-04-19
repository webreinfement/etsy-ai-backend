const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Etsy AI Assistant <noreply@yourdomain.com>'; // replace with your verified Resend domain

async function sendKeyEmail(email, key, tier = 1) {
  const planName = tier === 2 ? 'Pro' : 'Starter';
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: `🛍️ Your Etsy AI Assistant License Key (${planName} Plan)`,
    html: keyEmailTemplate(email, key, tier)
  });
}

async function sendExpiryEmail(email, key) {
  await resend.emails.send({
    from: FROM,
    to: email,
    subject: 'Your Etsy AI subscription has expired',
    html: expiryEmailTemplate(key)
  });
}

function keyEmailTemplate(email, key, tier = 1) {
  const planName = tier === 2 ? 'Pro' : 'Starter';
  const dailyLimit = tier === 2 ? '500' : '250';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 520px; margin: 40px auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
    .header { background: #f97316; padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 24px; }
    .header p { margin: 6px 0 0; color: rgba(255,255,255,0.85); font-size: 14px; }
    .body { padding: 32px; }
    .body p { color: #d1d5db; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .key-box { background: #16213e; border: 2px dashed #f97316; border-radius: 10px; padding: 20px; text-align: center; margin: 24px 0; }
    .key-box .key { font-family: monospace; font-size: 22px; color: #f97316; letter-spacing: 2px; font-weight: 700; }
    .key-box small { color: #6b7280; font-size: 12px; display: block; margin-top: 8px; }
    .steps { background: #16213e; border-radius: 10px; padding: 20px; margin: 0 0 24px; }
    .steps h3 { color: #e0e0e0; margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 1px; }
    .step { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 10px; }
    .step-num { background: #f97316; color: #fff; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; flex-shrink: 0; }
    .step p { color: #9ca3af; font-size: 13px; margin: 2px 0 0; line-height: 1.4; }
    .footer { padding: 20px 32px; border-top: 1px solid #374151; }
    .footer p { color: #6b7280; font-size: 12px; margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🛍️ You're all set!</h1>
      <p>Your Etsy AI Assistant subscription is active</p>
    </div>
    <div class="body">
      <p>Hey there! Here's your license key. Keep this safe — you'll need it to activate the extension.</p>

      <div class="key-box">
        <div class="key">${key}</div>
        <small>${planName} Plan · ${dailyLimit} uses/day · Valid for 30 days</small>
      </div>

      <div class="steps">
        <h3>How to activate</h3>
        <div class="step">
          <div class="step-num">1</div>
          <p>Open the <strong style="color:#e0e0e0">Etsy AI Assistant</strong> extension in Chrome</p>
        </div>
        <div class="step">
          <div class="step-num">2</div>
          <p>Paste your key in the activation box and click <strong style="color:#e0e0e0">Activate</strong></p>
        </div>
        <div class="step">
          <div class="step-num">3</div>
          <p>Head to any Etsy listing and start generating optimized listings!</p>
        </div>
      </div>

      <p>Questions? Just reply to this email.</p>
    </div>
    <div class="footer">
      <p>You're receiving this because you subscribed at ${email}. To cancel, manage your subscription via Stripe.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

function expiryEmailTemplate(key) {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    body { margin: 0; padding: 0; background: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    .container { max-width: 520px; margin: 40px auto; background: #1a1a2e; border-radius: 16px; overflow: hidden; }
    .header { background: #374151; padding: 32px; text-align: center; }
    .header h1 { margin: 0; color: #fff; font-size: 22px; }
    .body { padding: 32px; }
    .body p { color: #d1d5db; font-size: 15px; line-height: 1.6; margin: 0 0 16px; }
    .renew-btn { display: block; background: #f97316; color: #fff; text-decoration: none; text-align: center; padding: 14px; border-radius: 8px; font-weight: 700; font-size: 15px; margin: 24px 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Your subscription has expired</h1>
    </div>
    <div class="body">
      <p>Your Etsy AI Assistant subscription has ended. Your key <strong style="color:#f97316">${key}</strong> is no longer active.</p>
      <p>Renew your subscription to get back to creating optimized listings.</p>
      <a href="https://your-payment-link.com" class="renew-btn">Renew Subscription →</a>
      <p style="color:#6b7280; font-size:13px">Questions? Reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

module.exports = { sendKeyEmail, sendExpiryEmail };
