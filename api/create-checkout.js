const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const PRICES = {
  plus:    "price_1TmlALHxskKHNuyk7fPJd6p5",
  premium: "price_1TmlBbHxskKHNuykEuK4ghby",
  master:  "price_1TmlCYHxskKHNuyk68EfgptO"
};

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { plan, trialDays } = req.body;
    const priceId = PRICES[plan];
    if (!priceId) return res.status(400).json({ error: "無効なプランです" });

    const subscriptionData = {};
    const finalTrialDays = (typeof trialDays === "number" && trialDays >= 0) ? trialDays : 7;
    if (finalTrialDays > 0) {
      subscriptionData.trial_period_days = finalTrialDays;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      subscription_data: subscriptionData,
      success_url: `${process.env.NEXT_PUBLIC_URL}/welcome.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_URL}/`,
    });

    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
