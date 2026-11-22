export default async function handler(req, res) {
  const apiKey = process.env.RUNWAYML_API_SECRET;
  if (!apiKey) {
    return res.status(500).json({ error: "Video service is not configured." });
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "X-Runway-Version": "2024-11-06",
    "Content-Type": "application/json"
  };

  if (req.method === "POST") {
    const { prompt, ratio = "1280:720", duration = 5 } = req.body || {};

    if (typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({ error: "Describe the video you want to create." });
    }
    if (prompt.trim().length > 1000) {
      return res.status(400).json({ error: "Keep your video description under 1,000 characters." });
    }
    if (!["1280:720", "720:1280"].includes(ratio)) {
      return res.status(400).json({ error: "Choose landscape or portrait format." });
    }
    if (duration !== 5) {
      return res.status(400).json({ error: "The initial test is limited to 5 seconds." });
    }

    try {
      const response = await fetch("https://api.dev.runwayml.com/v1/text_to_video", {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: "hailuo3_lite",
          promptText: prompt.trim(),
          ratio,
          duration
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Runway create task failed:", response.status, JSON.stringify(data).slice(0, 500));
        return res.status(response.status === 429 ? 429 : 502).json({
          error: response.status === 429
            ? "Runway is busy. Please wait a moment and try again."
            : "Runway could not start this video. Check your account and API credits."
        });
      }
      return res.status(200).json({
        taskId: data.id,
        estimatedCost: data.estimatedCost || null,
        status: data.status || "PENDING"
      });
    } catch (error) {
      console.error("Runway create task error:", error);
      return res.status(502).json({ error: "Unable to reach Runway right now." });
    }
  }

  if (req.method === "GET") {
    const taskId = typeof req.query?.taskId === "string" ? req.query.taskId : "";
    if (!/^[a-f0-9-]{20,60}$/i.test(taskId)) {
      return res.status(400).json({ error: "A valid video task ID is required." });
    }
    try {
      const response = await fetch(`https://api.dev.runwayml.com/v1/tasks/${encodeURIComponent(taskId)}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "X-Runway-Version": "2024-11-06"
        }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Runway task lookup failed:", response.status, JSON.stringify(data).slice(0, 500));
        return res.status(502).json({ error: "Unable to check video progress." });
      }
      const output = Array.isArray(data.output) ? data.output[0] : null;
      return res.status(200).json({
        status: data.status || "UNKNOWN",
        videoUrl: typeof output === "string" ? output : null,
        failure: data.failure || null
      });
    } catch (error) {
      console.error("Runway task lookup error:", error);
      return res.status(502).json({ error: "Unable to check video progress." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
