const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { session_id } = req.query;
    if (!session_id) return res.status(400).json({ error: "session_idがありません" });

    const session = await stripe.checkout.sessions.retrieve(session_id, {
      expand: ["subscription", "subscription.items.data.price"]
    });

    if (session.payment_status === "paid" || session.status === "complete") {
      let plan = "plus";
      const priceId = session.subscription && session.subscription.items.data[0].price.id;
      if (priceId === "price_1TmlBbHxskKHNuykEuK4ghby") plan = "premium";
      if (priceId === "price_1TmlCYHxskKHNuyk68EfgptO") plan = "master";

      res.status(200).json({
        ok: true,
        email: session.customer_details ? session.customer_details.email : null,
        plan: plan
      });
    } else {
      res.status(200).json({ ok: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
