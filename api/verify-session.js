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
      expand: ["subscription"]
    });

    if (session.payment_status === "paid" || session.status === "complete") {
      const planPriceId = session.line_items ? null : (session.subscription && session.subscription.items.data[0].price.id);
      res.status(200).json({ ok: true, email: session.customer_details ? session.customer_details.email : null });
    } else {
      res.status(200).json({ ok: false });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
