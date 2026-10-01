import { API_BASE_URL, MAX_FILE_SIZE_MB, ACCEPTED_TYPES } from "./config.js";

export function validateFile(file) {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return "That file type isn't supported. Choose a JPG, PNG, WebP or GIF image.";
  }
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return `That file is larger than ${MAX_FILE_SIZE_MB} MB. Choose a smaller image.`;
  }
  return null;
}

function errorMessage(body, status) {
  const detail = body && body.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail[0]?.msg) return detail[0].msg;
  return `The server returned an error (${status}). Try again in a moment.`;
}

/** Sends the file to the backend, reporting upload progress (0-100). */
export function analyzeImage(file, { onProgress, onUploaded } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_BASE_URL}/api/analyze`);
    xhr.timeout = 180000;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => onUploaded && onUploaded();

    xhr.onload = () => {
      let body = null;
      try { body = JSON.parse(xhr.responseText); } catch { /* non-JSON response */ }
      if (xhr.status >= 200 && xhr.status < 300 && body) resolve(body);
      else reject(new Error(errorMessage(body, xhr.status)));
    };
    xhr.onerror = () => reject(new Error("Couldn't reach the AutoMod server. Check that the backend is running and the API URL is correct."));
    xhr.ontimeout = () => reject(new Error("The request timed out. Try a smaller image."));

    const form = new FormData();
    form.append("file", file);
    xhr.send(form);
  });
}
