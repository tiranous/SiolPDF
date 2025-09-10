// Avoid running inside iframes (e.g., Chrome PDF viewer subframes)
if (window.top !== window.self) { throw new Error('SiolPDF: skip_iframe'); }

/**
 * Content Script - PDF Editor Pro (MV3-compliant)
 * Detects PDFs on web pages and provides quick access to editor
 */

class PDFDetector {
  constructor() {
    this.bannerInjected = false;
    this.pdfInfo = null;
    this.observer = null;
  }

  initialize() {
    try {
      this.detectPDFs();
      this.setupMessageListener();
      this.setupDOMObserver();
      console.log('PDF Editor Pro content script initialized');
    } catch (error) {
      console.error('PDF detector initialization failed:', error);
    }
  }

  setupDOMObserver() {
    // Watch for dynamic content changes
    this.observer = new MutationObserver((mutations) => {
      if (!this.bannerInjected) {
        // Debounce PDF detection
        clearTimeout(this.detectTimeout);
        this.detectTimeout = setTimeout(() => {
          this.detectPDFs();
        }, 500);
      }
    });

    if (document.body) {
      this.observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  }

  detectPDFs() {
    try {
      // Current page is PDF
      if (this.isPDFPage()) {
        chrome.runtime.sendMessage({ type: 'IS_DISMISSED' }, (resp) => {
        if (!resp || !resp.dismissed) {
          this.showPDFBanner({
            type: 'current',
            url: window.location.href,
            title: document.title || 'PDF Document'
          });
        }
      });
        return;
      }

      // Embedded PDFs
      const embeddedPDF = this.findEmbeddedPDF();
      if (embeddedPDF) {
        chrome.runtime.sendMessage({ type: 'IS_DISMISSED' }, (resp) => {
        if (!resp || !resp.dismissed) {
          this.showPDFBanner({
            type: 'embedded',
            ...embeddedPDF
          });
        }
      });
        return;
      }

      // PDF links (only if no banner already shown)
      const pdfLinks = this.findPDFLinks();
      if (pdfLinks.length > 0 && !this.bannerInjected) {
        chrome.runtime.sendMessage({ type: 'IS_DISMISSED' }, (resp) => {
          if (!resp || !resp.dismissed) {
            this.showPDFLinksBanner(pdfLinks);
          }
        });
      }
    } catch (error) {
      console.error('PDF detection error:', error);
    }
  }

  isPDFPage() {
    // URL check
    const url = window.location.href.toLowerCase();
    if (url.includes('.pdf') || url.includes('pdf')) {
      return true;
    }

    // Content type check
    const contentType = document.contentType || '';
    if (contentType.includes('application/pdf')) {
      return true;
    }

    // PDF viewer indicators
    const pdfViewerSelectors = [
      '[id*="pdf"]',
      '[class*="pdf"]',
      'embed[type="application/pdf"]',
      'object[type="application/pdf"]'
    ];

    return pdfViewerSelectors.some(selector => 
      document.querySelector(selector) !== null
    );
  }

  findEmbeddedPDF() {
    const selectors = [
      'embed[type="application/pdf"]',
      'object[type="application/pdf"]', 
      'iframe[src*=".pdf"]',
      'embed[src*=".pdf"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element && (element.src || element.data)) {
        return {
          url: element.src || element.data,
          element: element
        };
      }
    }

    return null;
  }

  findPDFLinks() {
    const links = Array.from(document.querySelectorAll('a[href*=".pdf"]'))
      .filter(link => {
        const href = link.href.toLowerCase();
        return href.includes('.pdf') && !href.includes('#');
      })
      .slice(0, 5) // Limit to 5 links
      .map(link => ({
        url: link.href,
        text: (link.textContent || '').trim() || link.href,
        element: link
      }));

    return links.filter(link => link.url && link.text);
  }

  showPDFBanner(pdfInfo) {
    if (this.bannerInjected || !document.body) return;

    try {
      this.pdfInfo = pdfInfo;

      const banner = document.createElement('div');
      banner.id = 'pdf-editor-banner';
      banner.setAttribute('role', 'banner');
      banner.setAttribute('aria-label', 'PDF Editor Pro notification');

      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon" aria-hidden="true">📄</div>
          <div class="banner-text">
            <strong>PDF εντοπίστηκε!</strong>
            <span>Ανοίξτε το στο PDF Editor Pro για επεξεργασία</span>
          </div>
          <div class="banner-actions">
            <button id="open-in-editor" class="banner-btn primary" type="button">
              Άνοιγμα στο Editor
            </button>
            <button id="close-banner" class="banner-btn secondary" type="button" aria-label="Κλείσιμο">
              ×
            </button>
          </div>
        </div>
      `;

      this.injectBannerStyles();
      document.body.insertBefore(banner, document.body.firstChild);
      this.bannerInjected = true;

      // Setup event listeners (no inline handlers)
      const openBtn = document.getElementById('open-in-editor');
      const closeBtn = document.getElementById('close-banner');

      if (openBtn) {
        openBtn.addEventListener('click', () => this.openInEditor());
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeBanner(true));
      }

      // Auto-hide after 10 seconds
      setTimeout(() => {
        this.closeBanner(false);
      }, 10000);

    } catch (error) {
      console.error('Failed to show PDF banner:', error);
    }
  }

  showPDFLinksBanner(pdfLinks) {
    if (this.bannerInjected || !document.body || pdfLinks.length === 0) return;

    try {
      const banner = document.createElement('div');
      banner.id = 'pdf-editor-banner';
      banner.setAttribute('role', 'banner');

      const linksText = pdfLinks.length === 1 ? 'σύνδεσμος' : 'σύνδεσμοι';

      banner.innerHTML = `
        <div class="banner-content">
          <div class="banner-icon" aria-hidden="true">📄</div>
          <div class="banner-text">
            <strong>${pdfLinks.length} PDF ${linksText} βρέθηκαν!</strong>
            <span>Επιλέξτε έναν για άνοιγμα στο PDF Editor Pro</span>
          </div>
          <div class="banner-actions">
            <select id="pdf-link-select" class="banner-select" aria-label="Επιλέξτε PDF">
              ${pdfLinks.map((link, index) => 
                `<option value="${index}">${this.truncateText(link.text, 30)}</option>`
              ).join('')}
            </select>
            <button id="open-selected-pdf" class="banner-btn primary" type="button">
              Άνοιγμα
            </button>
            <button id="close-banner" class="banner-btn secondary" type="button" aria-label="Κλείσιμο">
              ×
            </button>
          </div>
        </div>
      `;

      this.injectBannerStyles();
      document.body.insertBefore(banner, document.body.firstChild);
      this.bannerInjected = true;

      // Event listeners
      const openBtn = document.getElementById('open-selected-pdf');
      const closeBtn = document.getElementById('close-banner');
      const select = document.getElementById('pdf-link-select');

      if (openBtn) {
        openBtn.addEventListener('click', () => {
          if (select) {
            const selectedIndex = parseInt(select.value);
            const selectedPDF = pdfLinks[selectedIndex];
            if (selectedPDF) {
              this.openInEditor(selectedPDF.url);
            }
          }
        });
      }

      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.closeBanner(true));
      }

      setTimeout(() => this.closeBanner(false), 15000);

    } catch (error) {
      console.error('Failed to show PDF links banner:', error);
    }
  }

  injectBannerStyles() {
    if (document.getElementById('pdf-editor-banner-styles')) return;

    try {
      const styles = document.createElement('style');
      styles.id = 'pdf-editor-banner-styles';
      styles.textContent = `
        #pdf-editor-banner {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          background: linear-gradient(135deg, #3b82f6, #1d4ed8) !important;
          color: white !important;
          z-index: 2147483647 !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15) !important;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          animation: slideDown 0.3s ease-out !important;
          border: none !important;
          margin: 0 !important;
          padding: 0 !important;
        }

        @keyframes slideDown {
          from { transform: translateY(-100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .banner-content {
          display: flex !important;
          align-items: center !important;
          gap: 16px !important;
          padding: 12px 20px !important;
          max-width: 1200px !important;
          margin: 0 auto !important;
        }

        .banner-icon { 
          font-size: 24px !important; 
          flex-shrink: 0 !important; 
        }

        .banner-text { 
          flex: 1 !important; 
          min-width: 0 !important; 
        }

        .banner-text strong { 
          display: block !important; 
          font-weight: 600 !important; 
          margin-bottom: 2px !important; 
        }

        .banner-text span { 
          font-size: 14px !important; 
          opacity: 0.9 !important; 
        }

        .banner-actions {
          display: flex !important;
          align-items: center !important;
          gap: 8px !important;
          flex-shrink: 0 !important;
        }

        .banner-btn {
          padding: 8px 16px !important;
          border: none !important;
          border-radius: 6px !important;
          font-size: 14px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          background: transparent !important;
          color: white !important;
        }

        .banner-btn.primary {
          background: rgba(255, 255, 255, 0.2) !important;
        }

        .banner-btn.primary:hover {
          background: rgba(255, 255, 255, 0.3) !important;
          transform: translateY(-1px) !important;
        }

        .banner-btn.secondary {
          width: 32px !important;
          height: 32px !important;
          padding: 0 !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 18px !important;
        }

        .banner-btn.secondary:hover {
          background: rgba(255, 255, 255, 0.1) !important;
        }

        .banner-select {
          padding: 6px 12px !important;
          border: 1px solid rgba(255, 255, 255, 0.3) !important;
          border-radius: 6px !important;
          background: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          font-size: 14px !important;
          max-width: 200px !important;
        }

        .banner-select option {
          background: #1d4ed8 !important;
          color: white !important;
        }

        @media (max-width: 768px) {
          .banner-content {
            padding: 12px 16px !important;
            gap: 12px !important;
          }

          .banner-text span {
            display: none !important;
          }

          .banner-select {
            max-width: 120px !important;
          }
        }
      `;

      document.head.appendChild(styles);
    } catch (error) {
      console.error('Failed to inject banner styles:', error);
    }
  }

  openInEditor(url = null) {
    try {
      let targetUrl = url || (this.pdfInfo && this.pdfInfo.url) || window.location.href;
      try { const u = new URL(targetUrl, window.location.href); targetUrl = u.searchParams.get('src') || targetUrl; } catch {}

      chrome.runtime.sendMessage({
        action: 'openPDFEditor',
        url: targetUrl
      }).then(response => {
        if (response && response.success) {
          this.closeBanner();
        } else {
          console.error('Failed to open PDF editor:', response?.error);
        }
      }).catch(error => {
        console.error('Failed to send message to background:', error);
      });
    } catch (error) {
      console.error('Failed to open in editor:', error);
    }
  }

  closeBanner(userDismissed = false) {
    try {
      const banner = document.getElementById('pdf-editor-banner');
      if (banner) {
        banner.style.animation = 'slideUp 0.3s ease-out forwards';
        setTimeout(() => {
          if (banner.parentNode) {
            banner.remove();
          }
          this.bannerInjected = false;
          if (userDismissed) {
            try { chrome.runtime.sendMessage({ type: 'DISMISS_BANNER' }); } catch {}
          }
        }, 300);
      }
    } catch (error) {
      console.error('Failed to close banner:', error);
    }
  }

  setupMessageListener() {
    try {
      chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        switch (message.action) {
          case 'detectPDF':
            const detected = this.isPDFPage() || this.findEmbeddedPDF();
            sendResponse({ 
              success: true, 
              hasPDF: !!detected,
              pdfInfo: this.pdfInfo 
            });
            break;

          case 'openPDF':
            this.openInEditor(message.url);
            sendResponse({ success: true });
            break;

          default:
            sendResponse({ success: false, error: 'Unknown action' });
        }
      });
    } catch (error) {
      console.error('Failed to setup message listener:', error);
    }
  }

  truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - 3) + '...';
  }

  destroy() {
    if (this.observer) {
      this.observer.disconnect();
    }
    clearTimeout(this.detectTimeout);
    this.closeBanner();
  }
}

// Initialize detector when ready
let pdfDetector = null;

function initializePDFDetector() {
  if (pdfDetector) {
    pdfDetector.destroy();
  }

  pdfDetector = new PDFDetector();
  pdfDetector.initialize();
}

// Initialize based on document ready state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializePDFDetector);
} else {
  initializePDFDetector();
}

// Clean up on page unload
window.addEventListener('beforeunload', () => {
  if (pdfDetector) {
    pdfDetector.destroy();
  }
});

console.log('PDF Editor Pro content script loaded (MV3-compliant)');
