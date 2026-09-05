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
      // 初めての顧客：フルの7日間トライアル
      return res.status(200).json({ trialDays: TRIAL_DAYS, isNewCustomer: true });
    }

    // このメールアドレスに紐づく全顧客の、全サブスクリプションを調べる
    let earliestStart = null;
    for (const customer of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 20 });
      for (const sub of subs.data) {
        // created はUNIXタイムスタンプ（秒）
        if (earliestStart === null || sub.created < earliestStart) {
          earliestStart = sub.created;
        }
      }
    }

    if (earliestStart === null) {
      // 顧客レコードはあるが契約履歴なし：フルの7日間トライアル
      return res.status(200).json({ trialDays: TRIAL_DAYS, isNewCustomer: true });
    }

    const now = Math.floor(Date.now() / 1000);
    const elapsedSeconds = now - earliestStart;
    const elapsedDays = Math.floor(elapsedSeconds / 86400);
    const remainingDays = TRIAL_DAYS - elapsedDays;

    if (remainingDays <= 0) {
      return res.status(200).json({ trialDays: 0, isNewCustomer: false });
    }

    return res.status(200).json({ trialDays: remainingDays, isNewCustomer: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
