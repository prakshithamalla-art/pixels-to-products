const $ = (id) => document.getElementById(id);

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}

export function showError(message) {
  const el = $("error");
  el.textContent = message;
  el.hidden = false;
}
export function clearError() { $("error").hidden = true; }

export function showPreview(file) {
  $("preview-img").src = URL.createObjectURL(file);
  $("preview-name").textContent = file.name;
  $("preview-size").textContent = formatBytes(file.size);
  $("dropzone-empty").hidden = true;
  $("preview").hidden = false;
}

export function setBusy(busy) {
  const btn = $("process-btn");
  btn.disabled = busy;
  btn.querySelector(".spinner").hidden = !busy;
  btn.querySelector(".btn-label").textContent = busy ? "Processing…" : "Process image";
}

export function setProgress(pct, label) {
  $("progress").hidden = pct === null;
  if (pct === null) return;
  $("progress-bar").style.width = `${pct}%`;
  $("progress-bar").classList.toggle("indeterminate", pct >= 100);
  $("progress-label").textContent = label;
}

let toastTimer;
export function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2000);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderModeration(data) {
  const verdict = $("verdict");
  const detail = $("verdict-detail");
  const map = {
    SAFE: ["safe", "SAFE"],
    UNSAFE: ["unsafe", "UNSAFE"],
    PENDING: ["pending", "PENDING"],
    UNKNOWN: ["pending", "NO RESULT"],
  };
  const [cls, text] = map[data.verdict] || map.UNKNOWN;
  verdict.className = `verdict ${cls}`;
  verdict.textContent = text;

  if (data.verdict === "SAFE") detail.textContent = "No moderation labels were flagged.";
  else if (data.verdict === "UNSAFE") detail.textContent = `Top label confidence: ${data.confidence}%`;
  else if (data.verdict === "PENDING") detail.textContent = "Moderation is still running. Process the image again in a moment.";
  else detail.textContent = "Cloudinary returned no moderation data. Check that the AWS Rekognition moderation add-on is enabled.";

  const list = $("labels");
  list.replaceChildren();
  data.labels.forEach((l) => {
    const li = el("li", "label-item");
    li.append(el("span", "label-name", l.parent ? `${l.name} (${l.parent})` : l.name));
    li.append(el("span", "label-conf", `${l.confidence}%`));
    list.append(li);
  });
}

function renderTags(tags) {
  const wrap = $("tags");
  wrap.replaceChildren();
  if (!tags.length) {
    wrap.append(el("p", "muted", "No tags were returned. Check that the AWS Rekognition auto-tagging add-on is enabled."));
    return;
  }
  tags.forEach((t) => {
    const chip = el("button", "chip", t.tag);
    chip.type = "button";
    if (t.confidence != null) chip.title = `${t.confidence}% confidence`;
    chip.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(t.tag);
        toast(`Copied "${t.tag}"`);
      } catch {
        toast("Copy isn't available in this browser");
      }
    });
    wrap.append(chip);
  });
}

// Background removal can take a few seconds to render on first request, so retry the image.
function loadWithRetry(img, url, tries = 6) {
  let attempt = 0;
  img.onerror = () => {
    if (attempt++ < tries) setTimeout(() => (img.src = `${url}${url.includes("?") ? "&" : "?"}r=${attempt}`), 2500);
  };
  img.src = url;
}

function renderCompare(data) {
  $("img-before").src = data.original_url;
  loadWithRetry($("img-after"), data.processed_url);
  $("download").href = data.processed_url.replace("/upload/", "/upload/fl_attachment/");
}

function renderTech(data) {
  $("tech-url").textContent = data.processed_url;
  const list = $("tech-transforms");
  list.replaceChildren();
  data.transformations.forEach((t) => {
    const li = el("li");
    li.append(el("code", null, t.param), document.createTextNode(` ${t.purpose}`));
    list.append(li);
  });
  $("tech-json").textContent = JSON.stringify(data.raw, null, 2);
}

export function renderResults(data) {
  renderModeration(data);
  renderTags(data.tags);
  renderCompare(data);
  renderTech(data);
  const results = $("results");
  results.hidden = false;
  results.classList.remove("reveal");
  void results.offsetWidth; // restart animation
  results.classList.add("reveal");
  results.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function hideResults() { $("results").hidden = true; }
