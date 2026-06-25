const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  plus:    { amount: 980,  name: "Plusプラン" },
  premium: { amount: 2980, name: "Premiumプラン" },
  master:  { amount: 9800, name: "Masterプラン" },
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan } = req.body;
    const priceInfo = PRICES[plan];
    if (!priceInfo) return res.status(400).json({ error: "無効なプランです" });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "jpy",
          product_data: { name: `心占SHINSO ${priceInfo.name}` },
          unit_amount: priceInfo.amount,
          recurring: { interval: "month" },
        },
        quantity: 1,
      }],
      mode: "subscription",
      subscription_data: {
        trial_period_days: 7,
      },
      success_url: `${process.env.NEXT_PUBLIC_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
