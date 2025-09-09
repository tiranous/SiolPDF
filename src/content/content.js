// Runs on every page (per manifest). Be polite & only act on PDFs.
(function () {
  const BANNER_ID = "siolpdf-banner-root";
  const KEY_DISMISSED = "siolpdf_banner_dismissed:" + location.href;

  // Heuristics: URL ends with .pdf OR PDF <embed/iframe> present
  function isPdfPage() {
    const urlLooksPdf = /\.pdf(\?|#|$)/i.test(location.href);
    const hasPdfEmbed = !!document.querySelector(
      'embed[type="application/pdf"], iframe[src$=".pdf"], frame[src$=".pdf"]'
    );
    return urlLooksPdf || hasPdfEmbed;
  }

  function alreadyDismissed() {
    return sessionStorage.getItem(KEY_DISMISSED) === "1";
  }

  function injectBannerOnce() {
    if (!isPdfPage() || alreadyDismissed()) return;
    if (document.getElementById(BANNER_ID)) return; // singleton guard

    const host = document.createElement("div");
    host.id = BANNER_ID;
    const shadow = host.attachShadow({ mode: "open" });

    shadow.innerHTML = `
      <style>
        :host { all: initial; }
        .bar {
          position: fixed; inset: 0 0 auto 0; height: 52px;
          display: flex; align-items: center; gap: 12px;
          padding: 0 16px; background: #1f6feb; color: white;
          font: 500 14px/1 system-ui,Segoe UI,Roboto,Arial;
          box-shadow: 0 2px 8px rgba(0,0,0,.25); z-index: 2147483647;
        }
        .bar strong { font-weight: 700; }
        button {
          border: 0; border-radius: 8px; padding: 8px 12px;
          background: white; color: #1f6feb; font-weight: 700; cursor: pointer;
        }
        .ghost { margin-left: auto; background: transparent; color: white; font-weight: 700; }
      </style>
      <div class="bar">
        <strong>PDF εντοπίστηκε!</strong>
        <span>Άνοιξέ το στον Editor για εργαλεία (merge, split, crop, κ.λπ.).</span>
        <button id="open">Άνοιγμα στο Editor</button>
        <button id="close" class="ghost" title="Κλείσιμο">✕</button>
      </div>
    `;

    shadow.getElementById("open").addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "OPEN_EDITOR", src: location.href });
    });
    shadow.getElementById("close").addEventListener("click", () => {
      sessionStorage.setItem(KEY_DISMISSED, "1");
      host.remove();
    });

    document.documentElement.appendChild(host);
  }

  // Initial + guard against late PDF viewer injection
  injectBannerOnce();
  const mo = new MutationObserver(() => injectBannerOnce());
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Safety on history navigations (SPA pdf viewers)
  window.addEventListener("pageshow", injectBannerOnce);
})();
