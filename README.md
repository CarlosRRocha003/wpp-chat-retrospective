# wpp-chat-retrospective

A Spotify Wrapped–style retrospective of a WhatsApp group chat, built to be shared with the group.

Open the site, pick the exported chat (`.txt` or `.zip`) and get a story-style recap: who talks the most, busiest day and hours, streaks and silences, stickers/audios/photos, laughs (kkkk vs hahaha vs rsrs), emojis, the duo that replies to each other the most, who revives the group, catchphrases, the longest message, and an award for each person.

**The chat never leaves the device.** Everything is computed in the browser. There is no backend.

### Optional AI: what was the busiest day about?

An opt-in setting runs a small multilingual embedding model ([`Xenova/multilingual-e5-small`](https://huggingface.co/Xenova/multilingual-e5-small), 118 MB, cached after the first download) in a Web Worker via transformers.js. It labels the busiest days and the longest messages with a theme from a fixed list (`src/lib/topics.ts`), scored against the group's usual conversation so generic themes don't always win. It never writes text and stays silent when nothing stands out. Small local LLMs (Qwen3 0.6B/1.7B, Gemma 3 1B) were tested for free-form titles and were not reliable enough.

## Sharing

- **Images**: each person gets a 1080×1920 card (plus a group summary) ready for stories or for the group chat. On phones it opens the native share sheet.
- **Link (encrypted vault)**: the recap, including the original animated stickers, photos and voice notes of the funny moments, is compressed and encrypted in the browser (AES-256-GCM) with a random key, then stored in a small Cloudflare Worker + KV (`worker/`). The key only lives in the link fragment (`#c=<id>.<key>`), which browsers never send to servers, so the vault cannot read what it stores. Links are short (~90 chars) and expire after 90 days. If the vault is unreachable, the site falls back to the old self-contained link (`#r=...`, stats only, static thumbnails, no audio). Contacts that still show as phone numbers are masked.

## Supported exports

- Android and iPhone, Portuguese and English (`DD/MM` or `MM/DD`, 24h or AM/PM).
- "Without media" works everywhere. "With media" also tells stickers, audios, photos and videos apart. Large `.zip` files are fine: only the chat `.txt` entry is read and inflated.

## Frontend (`frontend/`)

React + TypeScript + Vite, no runtime dependencies besides React.

```bash
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test        # parser, stats, awards, share link and zip reader
npm run build
```

There is a "see an example" button that generates a fictional chat (`src/lib/sample.ts`), so you can try it without exporting anything.

| File | What it does |
|---|---|
| `src/lib/parser.ts` | Parses the export into messages and classifies media, deleted and edited messages |
| `src/lib/zip.ts` | Minimal zip reader that extracts only the chat `.txt` |
| `src/lib/stats.ts` | Computes the retrospective (a serializable `Retro` object) |
| `src/lib/awards.ts` | Gives each person a unique title |
| `src/lib/share.ts` | Encodes/decodes the shareable link |
| `src/lib/card.ts` | Draws the shareable images on a canvas |
| `src/lib/topics.ts`, `ai.ts`, `topics.worker.ts` | Optional on-device theme detection |
| `src/components/` | Home, setup, stories and slides |

### Docker

```bash
docker build -t frontend:latest frontend
docker run -p 8080:80 frontend:latest
```

## Deploy

`.github/workflows/pages.yml` tests, builds and publishes to GitHub Pages on every push to `main`. One-time setup: **Settings → Pages → Source: GitHub Actions**.

## Vault (`worker/`)

```bash
cd worker
npm install
npm run dev        # local vault on http://localhost:8787 (the frontend dev server uses it via .env.development)

# one-time setup on Cloudflare (free plan is enough)
npx wrangler login
npx wrangler kv namespace create RETROS   # put the returned id in wrangler.toml
npm run deploy                            # then set VITE_VAULT_URL in frontend/.env.production
```

Deployed at `https://retro-cofre.cine-horarios.workers.dev` (referenced in `frontend/.env.production`). Only origins listed in `ALLOWED_ORIGINS` (wrangler.toml) can store packets, each packet is capped at 10 MB, and each IP is limited to about 3 links per minute (Workers rate limiting binding, which is approximate per data center), so the vault can't be used as free file hosting.

## Data extractor (`data_extractor/`)

The original Python prototype (pandas). The web app replaces it, but it is kept for reference.

```bash
cd data_extractor
python main.py
```
