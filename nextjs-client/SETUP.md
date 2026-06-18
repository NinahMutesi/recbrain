# RECBrain Next.js Client — Setup Guide

This folder replaces your old `client/` (React + Vite) folder.
Your `server/server.js`, `data/seed.js`, Qdrant, Ollama, and Appwrite
all stay exactly as they are — nothing there changes.

## 1. Place this folder

Copy this entire folder into your project as `nextjs-client/`:

```
recbrain/
├── server/              ← unchanged
├── data/                ← unchanged
├── client/               ← your old React app, can keep or delete later
└── nextjs-client/        ← THIS folder goes here
```

## 2. Install dependencies

```bash
cd recbrain/nextjs-client
npm install
```

## 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:
- `NEXT_PUBLIC_SOCKET_URL` — usually `http://localhost:3001` (your existing server.js)
- Appwrite credentials — same ones you already use in `server/.env`
- `SYNC_SECRET` — any random string, used to protect the `/api/sync` route

## 4. Run it

Keep your existing server running exactly as before:
```bash
# Terminal 1
ollama serve

# Terminal 2 — your existing chatbot server, unchanged
cd recbrain/server
npm run dev
```

Then run the new Next.js client instead of the old React client:
```bash
# Terminal 3
cd recbrain/nextjs-client
npm run dev
```

Open **http://localhost:3000** (Next.js default port — note this is
different from the old Vite port 5173).

## 5. The new API routes

- `GET /api/health` — quick check that the Next.js app is alive
- `GET /api/history?sessionId=xxx` — fetch chat history via HTTP
  without exposing Appwrite credentials to the browser
- `GET /api/sync` — pulls new documents from the Appwrite
  `rec_knowledge` collection, embeds them, and upserts into Qdrant

## 6. Setting up the rec_knowledge collection in Appwrite

This is what lets NREP staff add new REC content without touching code.

1. Go to your Appwrite console → Databases → your database
2. Create a new collection called `rec_knowledge`
3. Add these string attributes:
   - `source` (255 chars)
   - `edition` (100 chars)
   - `text` (5000 chars)
   - `category` (100 chars)
4. Set permissions so your API key can read it
5. Add a test document, e.g.:
   ```
   source: REC26/Overview
   edition: REC26 2026
   text: REC26 will be held in October 2026...
   category: overview
   ```
6. Visit `http://localhost:3000/api/sync` in your browser — it should
   return JSON showing it synced 1 document into Qdrant
7. Ask the chatbot a question about it — it should now know the answer

## 7. Automating the sync with a cron job

**Option A — Vercel Cron (when deployed to Vercel):**
The included `vercel.json` already configures this to run every hour.
No extra setup needed once deployed.

**Option B — cron-job.org (free, works anywhere):**
1. Go to https://cron-job.org and create a free account
2. Create a new cron job:
   - URL: `https://yourdomain.com/api/sync`
   - Schedule: every hour (`0 * * * *`)
   - Method: GET
   - If you set `SYNC_SECRET`, add header: `Authorization: Bearer your_secret`
3. Save — it will now call your sync route automatically forever

## 8. Deploying

The easiest path is deploying `nextjs-client/` to Vercel (one click,
free tier available) while `server/` continues running wherever you
host it (a VPS, Railway, Render, etc.). Just update
`NEXT_PUBLIC_SOCKET_URL` in Vercel's environment variables to point
to your deployed server.js URL instead of localhost.
