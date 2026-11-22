export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Voice service is not configured." });

  const { text, voice = "hannah" } = req.body || {};
  const allowedVoices = new Set(["autumn", "diana", "hannah", "austin", "daniel", "troy"]);

  if (typeof text !== "string" || !text.trim()) {
    return res.status(400).json({ error: "Enter some text first." });
  }
  if (text.length > 200) {
    return res.status(400).json({ error: "Text must be 200 characters or fewer." });
  }
  if (!allowedVoices.has(voice)) {
    return res.status(400).json({ error: "Choose a supported voice." });
  }

  try {
    const response = await fetch("https://api.groq.com/openai/v1/audio/speech", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "canopylabs/orpheus-v1-english",
        input: text.trim(),
        voice,
        response_format: "wav"
      })
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Groq voice request failed:", response.status, detail.slice(0, 500));
      return res.status(502).json({ error: "Voice generation failed. Please try again." });
    }

    const audio = Buffer.from(await response.arrayBuffer());
    res.setHeader("Content-Type", "audio/wav");
    res.setHeader("Content-Length", String(audio.length));
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(audio);
  } catch (error) {
    console.error("Voice generation error:", error);
    return res.status(500).json({ error: "Unable to reach the voice service." });
  }
}
