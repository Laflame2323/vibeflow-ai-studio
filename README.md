# VibeFlow AI Studio

A mobile-first AI video creation studio.

## Current working features
- Main studio dashboard and tool navigation
- AI Voice Studio using the Groq speech API
- Server-side API key handling through `GROQ_API_KEY`

## Planned modules
- AI video generation (text-to-video and image-to-video)
- AI presenter / My AI Twin (with explicit consent for face and voice use)
- Script writer, captions, video editing, music and effects
- Export presets for YouTube, Shorts, TikTok and Instagram

## Run / deploy
This project is designed for Vercel. The voice endpoint is available at `/api/voice`.
Set `GROQ_API_KEY` in Vercel Environment Variables. Never put API keys in browser code or commit them to GitHub.

## Important status note
The dashboard and voice feature are the initial foundation. The planned AI video, face animation, voice cloning and full editing features are not yet implemented. They require compatible model providers and, for some models, GPU hosting.

## Privacy
Only upload photos or voice recordings you own or have permission to use. Profile storage and deletion controls must be implemented before collecting user media.
