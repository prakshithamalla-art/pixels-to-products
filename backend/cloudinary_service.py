"""Cloudinary integration for AutoMod.

One signed upload does the heavy lifting:
  * moderation      -> AWS Rekognition moderation (add-on)
  * categorization  -> AWS Rekognition auto-tagging (add-on)
  * eager transform -> AI background removal + smart crop + optimized delivery
"""
import os

import cloudinary
import cloudinary.exceptions
import cloudinary.uploader

# Transformation string used for both the eager upload and the delivery URL.
# NO leading slash (Cloudinary treats "/" as a named-transformation marker and
# prepends "t_" to it, which breaks the URL).
TRANSFORMATION = "e_background_removal/c_fill,g_auto,w_800,h_800/f_auto,q_auto"

TRANSFORMATIONS_APPLIED = [
    {"param": "moderation=aws_rek", "purpose": "AI content moderation (AWS Rekognition)"},
    {"param": "categorization=aws_rek_tagging", "purpose": "Automatic object and scene tagging"},
    {"param": "e_background_removal", "purpose": "AI background removal"},
    {"param": "c_fill,g_auto,w_800,h_800", "purpose": "Content-aware smart crop"},
    {"param": "f_auto,q_auto", "purpose": "Best format and quality per browser"},
]


class ConfigError(RuntimeError):
    """Cloudinary credentials are missing."""


class MediaError(RuntimeError):
    """Cloudinary rejected or failed to process the upload."""


def _configure() -> None:
    cfg = {
        "cloud_name": os.getenv("CLOUDINARY_CLOUD_NAME"),
        "api_key": os.getenv("CLOUDINARY_API_KEY"),
        "api_secret": os.getenv("CLOUDINARY_API_SECRET"),
    }
    missing = [k.upper() for k, v in cfg.items() if not v or v.startswith("your_")]
    if missing:
        raise ConfigError(f"Server is missing Cloudinary settings: {', '.join(missing)}")
    cloudinary.config(secure=True, **cfg)


def _tag_pct(value):
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return round(v * 100 if v <= 1 else v, 1)


def parse_moderation(result: dict) -> dict:
    entries = result.get("moderation") or []
    entry = next((e for e in entries if e.get("kind") == "aws_rek"), entries[0] if entries else None)
    if not entry:
        return {"verdict": "UNKNOWN", "status": "missing", "confidence": None, "labels": []}

    status = entry.get("status", "unknown")
    raw_labels = (entry.get("response") or {}).get("moderation_labels") or []
    labels = [
        {
            "name": l.get("name"),
            "parent": l.get("parent_name") or None,
            "confidence": round(float(l.get("confidence", 0)), 1),
        }
        for l in raw_labels
    ]
    labels.sort(key=lambda l: l["confidence"], reverse=True)

    verdict = {"approved": "SAFE", "rejected": "UNSAFE", "pending": "PENDING"}.get(status, "UNKNOWN")
    return {
        "verdict": verdict,
        "status": status,
        "confidence": labels[0]["confidence"] if labels else None,
        "labels": labels,
    }


def parse_tags(result: dict) -> list:
    data = (
        ((result.get("info") or {}).get("categorization") or {})
        .get("aws_rek_tagging", {})
        .get("data")
        or []
    )
    tags = [{"tag": t.get("tag"), "confidence": _tag_pct(t.get("confidence"))} for t in data if t.get("tag")]
    tags.sort(key=lambda t: t["confidence"] or 0, reverse=True)
    return tags


def analyze_image(file_bytes: bytes) -> dict:
    _configure()

    params = {
        "folder": "automod",
        "resource_type": "image",
        "moderation": "aws_rek",
        "categorization": "aws_rek_tagging",
        "auto_tagging": 0.6,
        "eager": TRANSFORMATION,
        "eager_async": False,
    }
    preset = os.getenv("CLOUDINARY_UPLOAD_PRESET")
    if preset:
        params["upload_preset"] = preset

    try:
        result = cloudinary.uploader.upload(file_bytes, **params)
    except cloudinary.exceptions.Error as exc:
        raise MediaError(str(exc)) from exc

    # Build the processed URL manually so Cloudinary's transformation parser
    # cannot mis-read it and inject "t_" / "fl_attachment".
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    version = result.get("version")
    public_id = result["public_id"]
    processed_url = (
        f"https://res.cloudinary.com/{cloud_name}"
        f"/image/upload/{TRANSFORMATION}"
        f"/v{version}/{public_id}"
    )

    moderation = parse_moderation(result)
    return {
        **moderation,
        "tags": parse_tags(result),
        "original_url": result.get("secure_url"),
        "processed_url": processed_url,
        "public_id": public_id,
        "width": result.get("width"),
        "height": result.get("height"),
        "format": result.get("format"),
        "bytes": result.get("bytes"),
        "transformations": TRANSFORMATIONS_APPLIED,
        "raw": result,
    }