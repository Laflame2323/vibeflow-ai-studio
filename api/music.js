export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed." });
  }
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return res.status(503).json({ error: "Music catalogue setup is waiting for a Jamendo developer Client ID. Create a free read-only app and add JAMENDO_CLIENT_ID in Vercel." });
  const mode = req.query?.mode === "trending" ? "trending" : "search";
  const query = typeof req.query?.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (mode === "search" && !query) return res.status(400).json({ error: "Enter a song, artist, or genre to search." });
  const params = new URLSearchParams({ client_id: clientId, format: "json", limit: "30", include: "licenses,musicinfo" });
  const endpoint = mode === "trending" ? "charts/track" : "tracks";
  if (mode === "trending") {
    params.set("order", "trending");
    params.set("groupby", "artist_id");
  } else {
    params.set("search", query);
    params.set("boost", "popularity_week");
  }
  try {
    const upstream = await fetch("https://api.jamendo.com/v3.0/" + endpoint + "/?" + params.toString(), { headers: { Accept: "application/json" } });
    let data = await upstream.json().catch(() => ({}));
    if (!upstream.ok || data.headers?.status !== "success") {
      console.error("Jamendo API error:", upstream.status, JSON.stringify(data).slice(0, 500));
      return res.status(502).json({ error: "The music catalogue is temporarily unavailable. Please try again." });
    }
    // The chart endpoint returns track IDs, so fetch full track metadata and playable URLs separately.
    if (mode === "trending") {
      const ids = (data.results || []).map(t => t.id).filter(Boolean);
      if (!ids.length) return res.status(200).json({ tracks: [], mode, total: 0 });
      const detailsParams = new URLSearchParams({ client_id: clientId, format: "json", limit: String(ids.length), id: ids.join(","), include: "licenses,musicinfo" });
      const detailsResponse = await fetch("https://api.jamendo.com/v3.0/tracks/?" + detailsParams.toString(), { headers: { Accept: "application/json" } });
      data = await detailsResponse.json().catch(() => ({}));
      if (!detailsResponse.ok || data.headers?.status !== "success") {
        console.error("Jamendo chart track details failed:", detailsResponse.status, JSON.stringify(data).slice(0, 500));
        return res.status(502).json({ error: "Trending tracks could not be loaded. Please try again." });
      }
    }
    const tracks = (data.results || []).map(t => ({
      id: String(t.id),
      name: t.name || "Untitled track",
      artist: t.artist_name || "Unknown artist",
      album: t.album_name || "",
      image: t.album_image || t.image || "",
      duration: Number(t.duration) || 0,
      streamUrl: t.audio || "",
      downloadUrl: t.audiodownload_allowed === true ? (t.audiodownload || "") : "",
      downloadAllowed: t.audiodownload_allowed === true,
      license: t.license_ccurl || t.license || "",
      sourceUrl: t.shareurl || "https://www.jamendo.com/"
    })).filter(t => t.streamUrl);
    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    return res.status(200).json({ tracks, mode, total: tracks.length });
  } catch (error) {
    console.error("Jamendo request failed:", error);
    return res.status(502).json({ error: "Could not connect to the music catalogue." });
  }
}