# AutoMod

🌐 **Live Demo:** https://glittery-cajeta-22a57a.netlify.app
💻 **Backend API:** https://pixels-to-products.onrender.com

---

**AI content moderation for user-generated images, built on Cloudinary.**
Built for the Pixels to Products Hackathon (HackIndia × Cloudinary), Track 1: AI Media Pipelines.

## What it does

Upload an image and AutoMod returns a moderation verdict (SAFE or UNSAFE) with the flagged labels, a set of auto-generated tags, and a cleaned-up version of the image with the background removed and a content-aware crop applied.

All of the AI work happens in a single Cloudinary signed upload. The backend sends the image with moderation, categorization and an eager transformation, then normalizes Cloudinary's response into one small JSON payload for the frontend.

The frontend is a static site (vanilla HTML, CSS and ES modules, no build step). The backend is a small FastAPI service that keeps your Cloudinary API secret off the client.

## Architecture

```
Browser (static frontend)
   │  POST /api/analyze  (multipart image)
   ▼
FastAPI backend  ── validates type and size ──┐
   │  signed upload + AI params               │ errors → JSON {detail}
   ▼                                          │
Cloudinary Upload API ── AWS Rekognition ─────┘
   │  moderation + tags + processed URL
   ▼
FastAPI normalizes → JSON → Browser renders verdict, tags, before/after
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for details.

## Cloudinary features used

| Parameter | What it does |
| :--- | :--- |
| `moderation: "aws_rek"` | Runs AWS Rekognition moderation on upload and returns `approved` or `rejected` plus labels |
| `categorization: "aws_rek_tagging"` | Detects objects and scenes and returns tags with confidence scores |
| `auto_tagging: 0.6` | Applies tags above 60% confidence to the asset |
| `e_background_removal` | AI background removal, applied in the eager transformation |
| `c_fill, g_auto, w_800, h_800` | Smart crop that keeps the most important region |
| `f_auto, q_auto` | Delivers the best format and quality for each browser |

## Prerequisites

1. A free Cloudinary account.
2. These add-ons enabled in your Cloudinary console (Settings → Add-ons): **Rekognition AI Moderation**, **Rekognition Auto Tagging**, and **Cloudinary AI Background Removal**. Free tiers are available but limited.
3. Python 3.9+.
4. Optional: an upload preset named `automod` (Settings → Upload → Add upload preset). The backend does a signed upload, so the preset is not required. Remove `CLOUDINARY_UPLOAD_PRESET` from `.env` if you skip it.

## Run locally

```bash
git clone <your-repo-url> && cd automod

# Backend
cd backend
python -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env               # Windows: copy .env.example .env
# edit .env with your cloud name, API key and API secret
python -m uvicorn main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
python -m http.server 3000
```

Open http://localhost:3000. The frontend calls `http://localhost:8000` automatically when served locally. Check the backend at http://localhost:8000/api/health.

## Deploy

**Backend (Render or Railway)**
1. Create a Web Service from your GitHub repo with root directory `backend`.
2. Build command: `pip install -r requirements.txt`
3. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. Add the env vars from `.env.example`. Set `ALLOWED_ORIGINS` to your frontend URL.

**Frontend (Netlify or Vercel)**
1. Edit the backend URL in `netlify.toml` (or `vercel.json`).
2. Netlify: connect the repo, or drag the `frontend/` folder to netlify.com/drop (the redirect only applies with Git or CLI deploys; for drag-and-drop, set `API_BASE_URL` in `frontend/js/config.js` to your backend URL instead).
3. Vercel: import the repo. `vercel.json` sets the output directory.

## How to test

- **Safe:** upload a product photo, a landscape or a portrait. Expect a green SAFE verdict, tags such as "person" or "tree", and a cutout on the right.
- **Unsafe:** use Rekognition's sample moderation images or any image that clearly includes suggestive or violent content. Expect a red UNSAFE verdict with labels and confidences.
- **Errors:** try a PDF (unsupported type), a file over 10 MB, or stop the backend to see the network error message.

## Limitations

- Moderation quality is whatever AWS Rekognition provides. It can miss content or flag false positives, so treat it as a first filter, not a final decision.
- Background removal works best on images with a clear subject. The first render can take a few seconds, and the page retries automatically.
- No authentication or rate limiting. Add both before exposing the API publicly.
- Uploads are stored in your Cloudinary `automod/` folder and are not deleted automatically, even when rejected.
- Render's free tier sleeps when idle, so the first request after a pause can be slow.
- 10 MB limit and JPG, PNG, WebP or GIF only.
