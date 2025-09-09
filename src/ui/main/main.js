// ES module that drives the editor UI
import * as pdfjsLib from "../../lib/pdf.mjs";

// Ensure pdf.js worker resolves από το extension πακέτο
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL(
  "../../lib/pdf.worker.mjs"
);

const $ = (s) => document.querySelector(s);
const canvas = $("#pdfCanvas");
const ctx = canvas.getContext("2d");

// Load URL from query string
const qp = new URLSearchParams(location.search);
const src = qp.get("src");

// Basic render of first page (proof the editor opened)
async function renderFirstPage(arrayBuffer) {
  const task = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.25 });
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: ctx, viewport }).promise;
}

async function fetchAsArrayBuffer(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch PDF: ${res.status}`);
  return await res.arrayBuffer();
}

async function openFromSrc() {
  if (!src) return;
  const ab = await fetchAsArrayBuffer(src);
  await renderFirstPage(ab);
  state.original = ab;
}

const state = { original: null };

// Worker for heavy ops with pdf-lib inside
let worker;
function getWorker() {
  if (worker) return worker;
  worker = new Worker(chrome.runtime.getURL("../../workers/pdf-worker.js"), {
    // classic worker is fine here
    type: "classic",
  });
  return worker;
}

// Example action: remove CamScanner marks via worker
$("#btnRemoveCS").addEventListener("click", () => {
  if (!state.original) return;
  const w = getWorker();
  w.onmessage = (e) => {
    const { ok, buffer, error } = e.data || {};
    if (!ok) {
      console.error(error || "Worker failed");
      return;
    }
    // Re-render the result buffer
    renderFirstPage(buffer);
    state.original = buffer;
  };
  w.postMessage({ action: "remove-camscanner", buffer: state.original }, [
    state.original,
  ]);
});

// Export/save result
$("#btnExport").addEventListener("click", () => {
  if (!state.original) return;
  const blob = new Blob([state.original], { type: "application/pdf" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "edited.pdf";
  a.click();
  URL.revokeObjectURL(a.href);
});

// (Optional) Open file button: left as a stub
$("#btnOpen").addEventListener("click", async () => {
  // You can wire a <input type="file"> if θέλεις.
});

// Start
openFromSrc().catch(console.error);
