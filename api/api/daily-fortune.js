const https = require("https");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { name, birthday, email } = req.body;
    if (!email) return res.status(400).json({ error: "メールアドレスがありません" });
    if (!name || !birthday) return res.status(400).json({ error: "名前と生年月日が必要です" });

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(403).json({ error: "ご登録が確認できません" });
    }
    const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "all", limit: 1 });
    const active = subs.data.find(s => s.status === "active" || s.status === "trialing");
    if (!active) {
      return res.status(403).json({ error: "有料プランのご登録が確認できません" });
    }

    const today = new Date().toISOString().slice(0, 10);

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{
        role: "user",
        content: `あなたは心占SHINSOの占い師です。神秘的で断定的な口調で、${name}さん(生年月日:${birthday})の${today}の運勢を占ってください。マークダウン記号(**、##、[]など)は一切使わないでください。150文字程度で、今日1日の運勢を具体的に伝えてください。「〜とされます」という表現で言い切りすぎないよう注意し、現在の傾向として伝えてください。`
      }]
    });

    const options = {
      hostname: "api.anthropic.com",
      path: "/v1/messages",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Length": Buffer.byteLength(body)
      }
    };

    const result = await new Promise((resolve, reject) => {
      const request = https.request(options, (response) => {
        let data = "";
        response.on("data", (chunk) => data += chunk);
        response.on("end", () => resolve(JSON.parse(data)));
      });
      request.on("error", reject);
      request.write(body);
      request.end();
    });

    if (result.error) return res.status(500).json({ error: result.error.message });
    res.status(200).json({ fortune: result.content[0].text, date: today });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
