// Dedicated worker that uses pdf-lib for heavy ops

// Try to load pdf-lib in both classic and module workers safely
(function loadPdfLib() {
  try {
    // Classic worker path
    // eslint-disable-next-line no-undef
    importScripts(chrome.runtime.getURL("../lib/pdf-lib.min.js"));
  } catch (e) {
    // If ever converted to module worker:
    // (dynamic import on a UMD won't return exports, but executing is enough to set self.PDFLib)
    // await import(chrome.runtime.getURL("../lib/pdf-lib.min.js"));
  }
  if (!self.PDFLib) {
    // Hard fail – don't continue silently
    console.error("pdf-lib failed to load");
  }
})();

self.onmessage = async (e) => {
  const { action, buffer } = e.data || {};
  try {
    if (action === "remove-camscanner") {
      if (!self.PDFLib) throw new Error("PDFLib missing");

      const { PDFDocument, PDFName, PDFArray } = self.PDFLib;
      const pdfDoc = await PDFDocument.load(buffer);

      // 1) Drop page annotations (CamScanner links are Annots with URI)
      for (const page of pdfDoc.getPages()) {
        const node = page.node;
        if (node) {
          // Set Annots to empty array
          node.set(PDFName.of("Annots"), PDFArray.withContext(pdfDoc.context));
        }
      }

      // 2) (Light) scrub metadata that CamScanner συχνά γράφει
      pdfDoc.setTitle("");
      pdfDoc.setAuthor("");
      pdfDoc.setProducer("");
      pdfDoc.setCreator("");

      const out = await pdfDoc.save();
      postMessage({ ok: true, buffer: out }, [out.buffer]);
      return;
    }

    postMessage({ ok: false, error: "Unknown action" });
  } catch (err) {
    postMessage({ ok: false, error: String(err && err.message || err) });
  }
};
