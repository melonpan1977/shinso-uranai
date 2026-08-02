const Anthropic = require("@anthropic-ai/sdk");

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  try {
    const { imageBase64, mediaType } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: "画像データがありません" });
    }

    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType || "image/jpeg",
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: "あなたは心占SHINSOの手相鑑定師です。神秘的で断定的な口調で、この手のひらの写真を見て手相を鑑定してください。生命線、感情線、知能線について視えたことを告げ、全体的な運勢メッセージを伝えてください。最後に「さらに深く視るには、心占SHINSOの本格鑑定をお試しください。今なら7日間無料でご利用いただけます。」と添えてください。400文字程度で鑑定してください。",
            },
          ],
        },
      ],
    });

    res.status(200).json({ reading: message.content[0].text });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
