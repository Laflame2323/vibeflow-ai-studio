export default async function handler(req, res) {
  if (req.method !== "POST") { res.setHeader("Allow", "POST"); return res.status(405).json({ error: "Method not allowed" }); }
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "The AI service is not configured yet." });
  const body = req.body || {};
  const idea = typeof body.idea === "string" ? body.idea.trim() : "";
  const format = typeof body.format === "string" ? body.format.slice(0, 40) : "Short video";
  const vibe = typeof body.vibe === "string" ? body.vibe.slice(0, 40) : "Cinematic";
  const duration = typeof body.duration === "string" ? body.duration.slice(0, 30) : "30 seconds";
  if (!idea) return res.status(400).json({ error: "Tell us what your video should be about." });
  if (idea.length > 1200) return res.status(400).json({ error: "Keep your idea under 1,200 characters." });
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: "Bearer " + apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: "You are VibeFlow Script Studio, an expert video scriptwriter. Create original engaging scripts, with a strong opening hook, scene-by-scene timestamps, narration or dialogue, visual direction, on-screen text suggestions, and a natural closing call to action. Respect the requested platform, tone and duration. Be specific and avoid filler. Return readable plain text with clear headings." },
          { role: "user", content: "Create a video script from this idea: " + idea + "\nFormat: " + format + "\nVibe: " + vibe + "\nTarget length: " + duration + "\nInclude a title, hook, scene-by-scene visuals and narration, on-screen text, and closing call to action." }
        ],
        max_completion_tokens: 2200
      })
    });
    if (!response.ok) { const detail = await response.text(); console.error("Groq script request failed:", response.status, detail.slice(0, 500)); return res.status(502).json({ error: "The script generator could not respond. Please try again." }); }
    const data = await response.json();
    const script = data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content ? data.choices[0].message.content.trim() : "";
    if (!script) return res.status(502).json({ error: "The AI returned an empty script. Please try again." });
    return res.status(200).json({ script });
  } catch (error) { console.error("Script generation error:", error); return res.status(500).json({ error: "Unable to reach the AI service right now." }); }
}