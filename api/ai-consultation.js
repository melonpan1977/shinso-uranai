const https = require("https");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { email, profile, question } = req.body;
    if (!email) return res.status(400).json({ error: "メールアドレスがありません" });
    if (!profile || !profile.name || !profile.birth) return res.status(400).json({ error: "鑑定データが不足しています" });
    if (!question || !question.trim()) return res.status(400).json({ error: "ご相談内容を入力してください" });

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return res.status(403).json({ error: "ご登録が確認できません" });
    }
    const subs = await stripe.subscriptions.list({ customer: customers.data[0].id, status: "all", limit: 1 });
    const active = subs.data.find(s => s.status === "active" || s.status === "trialing");
    if (!active) {
      return res.status(403).json({ error: "有料プランのご登録が確認できません" });
    }
    const priceId = active.items.data[0].price.id;
    const isMaster = priceId === "price_1TmlCYHxskKHNuyk68EfgptO";
    if (!isMaster) {
      return res.status(403).json({ error: "この機能はMasterプラン限定です" });
    }

    const profileText = `
名前: ${profile.name}
生年月日: ${profile.birth}
今の魂の状態: ${profile.phase || '未回答'}
自己像: ${profile.self || '未回答'}
`.trim();

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `あなたは心占SHINSOの専属占い師である。以下の鑑定データを持つ相談者から、自由なご相談を受けた。神秘的で断定的な口調で、心を込めて回答せよ。

${profileText}

【相談者の質問・悩み】
${question.trim()}

回答は300〜400文字程度で、相談内容に具体的に寄り添いながら答えること。マークダウン記号（**、##、[]など）や絵文字・特殊記号は一切使用しないこと。「〜とされる」「〜の傾向がある」という表現を使い、断定的すぎる予言（「絶対に」「必ず」）は避けること。`
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
    res.status(200).json({ answer: result.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
