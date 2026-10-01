"""AutoMod API. Run: uvicorn main:app --reload --port 8000"""
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

import cloudinary_service as svc  # noqa: E402  (after load_dotenv)

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("automod")

MAX_BYTES = 10 * 1024 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/gif"}

app = FastAPI(title="AutoMod API", version="1.0.0")

origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=origins != ["*"],
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.post("/api/analyze")
async def analyze(file: UploadFile = File(...)):
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(415, "Unsupported file type. Use JPG, PNG, WebP or GIF.")

    data = await file.read()
    if not data:
        raise HTTPException(400, "The uploaded file is empty.")
    if len(data) > MAX_BYTES:
        raise HTTPException(413, "File is too large. The limit is 10 MB.")

    try:
        return await run_in_threadpool(svc.analyze_image, data)
    except svc.ConfigError as exc:
        log.error("config error: %s", exc)
        raise HTTPException(500, str(exc))
    except svc.MediaError as exc:
        log.warning("cloudinary error: %s", exc)
        raise HTTPException(502, f"Cloudinary could not process this image: {exc}")
    except Exception:
        log.exception("unexpected failure")
        raise HTTPException(500, "Something went wrong while analyzing the image.")
