import { validateFile, analyzeImage } from "./upload.js";
import { showError, clearError, showPreview, setBusy, setProgress, renderResults, hideResults } from "./ui.js";

const dropzone = document.getElementById("dropzone");
const input = document.getElementById("file-input");
const processBtn = document.getElementById("process-btn");
let selected = null;

function selectFile(file) {
  if (!file) return;
  clearError();
  const problem = validateFile(file);
  if (problem) {
    showError(problem);
    return;
  }
  selected = file;
  showPreview(file);
  hideResults();
  processBtn.disabled = false;
}

dropzone.addEventListener("click", () => input.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
});
input.addEventListener("change", () => selectFile(input.files[0]));

["dragenter", "dragover"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("is-over"); })
);
["dragleave", "drop"].forEach((evt) =>
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("is-over"); })
);
dropzone.addEventListener("drop", (e) => selectFile(e.dataTransfer.files[0]));

processBtn.addEventListener("click", async () => {
  if (!selected) return;
  clearError();
  hideResults();
  setBusy(true);
  setProgress(0, "Uploading…");
  try {
    const data = await analyzeImage(selected, {
      onProgress: (p) => setProgress(p, `Uploading… ${p}%`),
      onUploaded: () => setProgress(100, "Analyzing with Cloudinary AI. This can take a few seconds."),
    });
    renderResults(data);
  } catch (err) {
    showError(err.message);
  } finally {
    setBusy(false);
    setProgress(null);
    processBtn.disabled = !selected;
  }
});
