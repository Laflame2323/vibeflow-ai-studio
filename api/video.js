const MODEL = "agnes-video-2.5-flash";
const API_BASE = "https://apihub.agnes-ai.com";

function safeError(status) {
  if (status === 401 || status === 403) return "Agnes rejected the API key. Check AGNES_API_KEY in Vercel.";
  if (status === 429) return "Agnes rate limit reached. Wait a minute before trying again.";
  if (status === 402) return "Agnes reports that this account needs credits or an eligible plan.";
  return "Agnes could not process the video request. Check your Agnes account and model access.";
}

export default async function handler(req, res) {
  const apiKey = process.env.AGNES_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Video service is not configured. Add AGNES_API_KEY in Vercel." });
  }

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
      const response = await fetch(`${API_BASE}/v1/videos`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL,
          prompt: prompt.trim(),
          mode: "text",
          seconds: "5",
          size: "720P",
          aspect_ratio: ratio === "1280:720" ? "16:9" : "9:16",
          n: 1
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Agnes create task failed:", response.status, JSON.stringify(data).slice(0, 500));
        return res.status(response.status === 429 ? 429 : 502).json({ error: safeError(response.status) });
      }

      const videoId = data.video_id || data.task_id || data.id;
      if (!videoId || typeof videoId !== "string") {
        console.error("Agnes response missing video identifier:", JSON.stringify(data).slice(0, 500));
        return res.status(502).json({ error: "Agnes accepted an unexpected response. No video task ID was returned." });
      }
      return res.status(200).json({
        taskId: videoId,
        status: data.status || "pending",
        model: MODEL
      });
    } catch (error) {
      console.error("Agnes create task error:", error);
      return res.status(502).json({ error: "Unable to reach Agnes right now." });
    }
  }

  if (req.method === "GET") {
    const videoId = typeof req.query?.taskId === "string" ? req.query.taskId : "";
    if (!videoId || videoId.length > 200 || !/^[a-zA-Z0-9_-]+$/.test(videoId)) {
      return res.status(400).json({ error: "A valid video task ID is required." });
    }
    try {
      const url = new URL(`${API_BASE}/agnesapi`);
      url.searchParams.set("video_id", videoId);
      url.searchParams.set("model_name", MODEL);
      const response = await fetch(url.toString(), {
        method: "GET",
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.error("Agnes task lookup failed:", response.status, JSON.stringify(data).slice(0, 500));
        return res.status(response.status === 429 ? 429 : 502).json({ error: safeError(response.status) });
      }
      const state = String(data.status || "pending").toLowerCase();
      return res.status(200).json({
        status: state === "completed" || state === "succeeded" ? "SUCCEEDED" :
          state === "failed" || state === "canceled" ? "FAILED" : state.toUpperCase(),
        videoUrl: typeof data.url === "string" ? data.url :
          typeof data.video_url === "string" ? data.video_url : null,
        failure: data.error || data.message || null
      });
    } catch (error) {
      console.error("Agnes task lookup error:", error);
      return res.status(502).json({ error: "Unable to check video progress." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Method not allowed." });
}
