const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "メールアドレスがありません" });

    const TRIAL_DAYS = 7;
    const customers = await stripe.customers.list({ email, limit: 10 });

    if (customers.data.length === 0) {
      return res.status(200).json({ trialDays: TRIAL_DAYS, isNewCustomer: true });
    }

    let hasAnySubscription = false;
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 1 });
      if (subs.data.length > 0) {
        hasAnySubscription = true;
        break;
      }
    }

    if (hasAnySubscription) {
      return res.status(200).json({ trialDays: 0, isNewCustomer: false });
    }

    return res.status(200).json({ trialDays: TRIAL_DAYS, isNewCustomer: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
