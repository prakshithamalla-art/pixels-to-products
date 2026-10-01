# AutoMod architecture

## System diagram

```
┌──────────────┐   multipart POST    ┌──────────────────┐   signed upload   ┌─────────────────────┐
│   Frontend   │ ──────────────────▶ │  FastAPI backend │ ────────────────▶ │  Cloudinary         │
│ static, ES   │                     │  /api/analyze    │                   │  Upload API         │
│ modules      │ ◀────────────────── │  /api/health     │ ◀──────────────── │  + AWS Rekognition  │
└──────────────┘   normalized JSON   └──────────────────┘   result JSON     │  + AI transforms    │
        │                                                                   └─────────────────────┘
        └────────────── loads processed image directly from Cloudinary CDN ───────────▲
```

## Data flow

1. The user selects or drops an image. `upload.js` validates type and size client-side.
2. `analyzeImage()` posts it to `/api/analyze` with `XMLHttpRequest` so the progress bar reflects real upload progress.
3. The backend validates content type, emptiness and the 10 MB limit again, because client checks can't be trusted.
4. `cloudinary_service.analyze_image()` performs one signed upload with `moderation`, `categorization`, `auto_tagging` and an eager transformation (background removal, smart crop, `f_auto,q_auto`).
5. The response is normalized: verdict (`approved` → SAFE, `rejected` → UNSAFE), labels sorted by confidence, tags sorted by confidence, original URL, processed URL.
6. `ui.js` renders each panel with `textContent` (never `innerHTML`), so API data can't inject markup.
7. The processed image loads straight from Cloudinary's CDN, with retries while the AI transformation finishes rendering.

## Why a frontend/backend split

- The Cloudinary API secret is required for signed uploads and for server-side moderation parameters. It must never reach the browser.
- The backend is the single place that interprets Cloudinary's response shape, so the UI depends on a small stable contract.
- The static frontend can be hosted free on any CDN. The backend is stateless and can run on any Python host.
- In production the frontend proxies `/api/*` to the backend (`netlify.toml`, `vercel.json`), so there are no CORS issues in the browser.

## Error handling

| Layer | Failure | Behavior |
| :--- | :--- | :--- |
| Frontend | Wrong type or too large | Inline message before any upload |
| Frontend | Network down or timeout | Plain-language message naming the likely cause |
| Backend | 415 / 413 / 400 | Validation error as `{"detail": "..."}` |
| Backend | Missing credentials | 500 naming the missing variable (never its value) |
| Backend | Cloudinary rejects the upload | 502 with Cloudinary's message |
| Cloudinary | No moderation or tag data | Verdict `UNKNOWN` with a hint about enabling the add-on |
| Cloudinary | Moderation `pending` | Verdict `PENDING` and a prompt to retry |

## Scalability notes

- The backend holds no state, so it scales horizontally behind a load balancer.
- The Cloudinary SDK call is blocking, so it runs in a threadpool to keep the event loop free.
- For high volume, switch to async moderation with a Cloudinary webhook (`notification_url`) and store verdicts in a database instead of waiting on the request.
- Add rate limiting, auth, and a cleanup job for rejected assets before going public.
- Uploading directly from the browser with a signed upload (backend only issues signatures) would remove the backend from the data path for large files.
