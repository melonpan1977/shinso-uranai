const https = require("https");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { name, birthday, session_id } = req.body;
    if (!session_id) return res.status(400).json({ error: "決済情報が確認できません" });
    if (!name || !birthday) return res.status(400).json({ error: "名前と生年月日が必要です" });

    const today = new Date().toISOString().slice(0, 10);
    const seed = `${name}-${birthday}-${today}`;

    const body = JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: `あなたは心占SHINSOの専属占い師です。次のシード値を元に、今日1日だけ有効な「今日の運勢」を神秘的で断定的な口調で鑑定してください。シード:${seed}。マークダウン記号(**、##、[]など)は一切使わないでください。全体運・注意すべきこと・今日のラッキーアクションの3点を、150字程度で簡潔に伝えてください。`
        }
      ]
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
