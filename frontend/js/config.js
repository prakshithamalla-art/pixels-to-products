// No secrets live in the frontend. Cloudinary credentials stay on the backend.
const host = window.location.hostname;
const isLocal = host === "" || host === "localhost" || host === "127.0.0.1";

// Local dev: talk to uvicorn directly.
// Deployed: use same-origin /api/*, which netlify.toml / vercel.json proxy to the backend.
// To skip the proxy, set this to your backend URL, e.g. "https://automod-api.onrender.com".
export const API_BASE_URL = isLocal ? "http://localhost:8000" : "";

export const MAX_FILE_SIZE_MB = 10;
export const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
