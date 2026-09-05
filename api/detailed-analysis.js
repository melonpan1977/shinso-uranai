const https = require("https");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { email, profile } = req.body;
    if (!email) return res.status(400).json({ error: "メールアドレスがありません" });
    if (!profile || !profile.name || !profile.birth) return res.status(400).json({ error: "鑑定データが不足しています" });

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

    const today = new Date().toISOString().slice(0, 10);

    const profileText = `
名前: ${profile.name}
生年月日: ${profile.birth}
性別: ${profile.gender || '未回答'}
今の魂の状態: ${profile.phase || '未回答'}
最も心を占める問い: ${profile.question || '未回答'}
深層傾向（共感度:${profile.q1 || '?'}/熟考度:${profile.q2 || '?'}/不安度:${profile.q3 || '?'}）
自己像: ${profile.self || '未回答'}
今最も知りたい・隠しているテーマ: ${profile.theme || '未回答'}
最後の告白: ${profile.secret || '未回答'}
`.trim();

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 900,
      messages: [{
        role: "user",
        content: `あなたは心占SHINSOの深層分析専門の占い師である。心占SHINSOは日本中のあらゆる占術の知見を統合し、独自に再構築した占術体系を持つ。以下の鑑定データをもとに、${today}時点での詳細分析を行え。

${profileText}

【重要な指示】
これはMasterプラン限定の最も踏み込んだ分析である。他の無料鑑定・毎日の運勢・未来予測はすべて前向きな内容に終始しているため、この詳細分析だけは「良い面」と「向き合うべき課題・弱点」を半々の分量で、具体的に踏み込んで書くこと。

課題を指摘する際は、以下を必ず守ること。
・「絶対に」「必ず」という断定的な予言は避け、「〜の傾向がある」「〜とされる」という表現を使う
・課題を指摘するだけでなく、その課題にどう向き合い、どう改善していけるか、具体的な行動のヒントを必ず添える
・人格否定や過度に不安を煽る表現は避け、建設的な指摘に留める
・断定的な口調（〜だ、〜である、汝など）で、神秘的な世界観を保つ

出力は以下のJSON形式のみで、Markdownのコードブロックや説明文は一切付けないでください。
{"strength":"汝の強みについて150文字程度","challenge":"汝が向き合うべき課題について200文字程度","howto":"その課題への具体的な向き合い方について150文字程度","overall":"総合的な総括を100文字程度"}`
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

    const raw = (result.content || []).map(i => i.text || "").join("");
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch (e) {
      return res.status(500).json({ error: "分析データの解析に失敗しました" });
    }

    res.status(200).json({ date: today, ...parsed });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
