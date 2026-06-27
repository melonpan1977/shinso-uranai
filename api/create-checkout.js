const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  plus:    "price_1TmIALHxskKHNuyk7fPJd6p5",
  premium: "price_1TmIBbHxskKHNuykEuK4ghby",
  master:  "price_1TmICYHxskKHNuyk68EfgptO",
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan } = req.body;
    const priceId = PRICES[plan];
    if (!priceId) return res.status(400).json({ error: "無効なプランです" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: { trial_period_days: 7 },
      success_url: "https://shinso-uranai.vercel.app/",
      cancel_url: "https://shinso-uranai.vercel.app/",
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
