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
    const isPremiumOrAbove = priceId === "price_1TmlBbHxskKHNuykEuK4ghby" || priceId === "price_1TmlCYHxskKHNuyk68EfgptO";
    if (!isPremiumOrAbove) {
      return res.status(403).json({ error: "この機能はPremium以上のプラン限定です" });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const thisMonth = year + "-" + String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();

    const weekRanges = [
      { label: "第1週（1〜7日）", start: 1, end: 7 },
      { label: "第2週（8〜14日）", start: 8, end: 14 },
      { label: "第3週（15〜21日）", start: 15, end: 21 },
      { label: "第4週（22〜" + lastDay + "日）", start: 22, end: lastDay }
    ];

    const profileText = `
名前: ${profile.name}
生年月日: ${profile.birth}
今の魂の状態: ${profile.phase || '未回答'}
最も心を占める問い: ${profile.question || '未回答'}
今最も知りたい・隠しているテーマ: ${profile.theme || '未回答'}
最後の告白: ${profile.secret || '未回答'}
`.trim();

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1200,
      messages: [{
        role: "user",
        content: `あなたは心占SHINSOのAI占い師です。以下の鑑定データを多角的に分析し、${year}年${month}月の未来予測を、神秘的で断定的な口調で、週ごとに分けて伝えてください。

${profileText}

心占SHINSO独自の「時命数」「言霊数」「魂紋」という概念を交えつつ、以下の4つの週それぞれについて150〜200文字程度で、その週に訪れる可能性のある出来事や心境の変化、注意点を具体的に伝えてください。

${weekRanges.map(w => "・" + w.label).join("\n")}

出力形式は、必ず以下のJSON形式のみで、Markdownのコードブロックや説明文は一切付けないでください。
{"week1":"第1週の文章","week2":"第2週の文章","week3":"第3週の文章","week4":"第4週の文章","summary":"月全体を貫くテーマを50文字程度で"}

マークダウン記号(**、##、[]など)は一切使わないでください。「〜とされます」「〜の傾向にあります」という表現を使い、確定的な断言(「〜します」「絶対に〜」)は避けてください。`
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
      return res.status(500).json({ error: "予測データの解析に失敗しました" });
    }

    res.status(200).json({
      month: thisMonth,
      summary: parsed.summary || "",
      weeks: weekRanges.map((w, i) => ({
        label: w.label,
        text: parsed["week" + (i + 1)] || ""
      }))
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
