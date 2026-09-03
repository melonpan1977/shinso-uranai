const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "メールアドレスがありません" });

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(200).json({ isMember: false });
    }

    const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "all", limit: 1 });
    const active = subs.data.find(s => s.status === "active" || s.status === "trialing");

    res.status(200).json({ isMember: !!active });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
