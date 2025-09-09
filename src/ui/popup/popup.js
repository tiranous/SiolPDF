/**
 * Popup Script - PDF Editor Pro
 * MV3-compliant with no inline JavaScript
 */

class PopupManager {
  constructor() {
    this.currentTab = null;
    this.pdfInfo = null;
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.getCurrentTab();
      await this.detectPDF();
      this.setupEventListeners();
      this.updateUI();
      this.isInitialized = true;
      this.hideLoading();
    } catch (error) {
      console.error('Popup initialization failed:', error);
      this.showError('Σφάλμα φόρτωσης popup');
    }
  }

  async getCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTab = tab;
    } catch (error) {
      console.error('Failed to get current tab:', error);
    }
  }

  async detectPDF() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getPDFFromTab'
      });

      if (response && response.success) {
        this.pdfInfo = response;
        this.updatePDFInfo();
      } else {
        this.showNoPDFState();
      }

    } catch (error) {
      console.error('Failed to detect PDF:', error);
      this.showNoPDFState();
    }
  }

  updatePDFInfo() {
    const pdfDetectedSection = document.getElementById('pdf-detected');
    const noPdfSection = document.getElementById('no-pdf');

    if (this.pdfInfo && this.pdfInfo.isPDF) {
      // Show PDF detected state
      if (pdfDetectedSection) pdfDetectedSection.style.display = 'block';
      if (noPdfSection) noPdfSection.style.display = 'none';

      // Update PDF info
      const title = document.getElementById('pdf-title');
      const url = document.getElementById('pdf-url');

      if (title) {
        title.textContent = this.pdfInfo.title || 'PDF Document';
      }

      if (url) {
        url.textContent = this.formatURL(this.pdfInfo.url);
      }

    } else {
      this.showNoPDFState();
    }
  }

  showNoPDFState() {
    const pdfDetectedSection = document.getElementById('pdf-detected');
    const noPdfSection = document.getElementById('no-pdf');

    if (pdfDetectedSection) pdfDetectedSection.style.display = 'none';
    if (noPdfSection) noPdfSection.style.display = 'block';
  }

  formatURL(url) {
    if (!url) return '';

    try {
      const urlObj = new URL(url);
      const pathname = urlObj.pathname;
      const filename = pathname.split('/').pop();

      if (filename && filename.includes('.pdf')) {
        return filename;
      }

      return urlObj.hostname + (pathname.length > 20 ? pathname.substring(0, 20) + '...' : pathname);
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  setupEventListeners() {
    // PDF actions
    const openCurrentPdfBtn = document.getElementById('open-current-pdf');
    if (openCurrentPdfBtn) {
      openCurrentPdfBtn.addEventListener('click', () => this.openCurrentPDF());
    }

    const quickMergeBtn = document.getElementById('quick-merge-btn');
    if (quickMergeBtn) {
      quickMergeBtn.addEventListener('click', () => this.quickMerge());
    }

    const quickSplitBtn = document.getElementById('quick-split-btn');
    if (quickSplitBtn) {
      quickSplitBtn.addEventListener('click', () => this.quickSplit());
    }

    // General actions
    const openEditorBtn = document.getElementById('open-editor');
    if (openEditorBtn) {
      openEditorBtn.addEventListener('click', () => this.openEditor());
    }

    const browseFilesBtn = document.getElementById('browse-files');
    if (browseFilesBtn) {
      browseFilesBtn.addEventListener('click', () => this.browseFiles());
    }

    // Footer links
    const optionsBtn = document.getElementById('options-btn');
    if (optionsBtn) {
      optionsBtn.addEventListener('click', () => this.openOptions());
    }

    const helpBtn = document.getElementById('help-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => this.openHelp());
    }

    const feedbackBtn = document.getElementById('feedback-btn');
    if (feedbackBtn) {
      feedbackBtn.addEventListener('click', () => this.openFeedback());
    }
  }

  async openCurrentPDF() {
    if (!this.pdfInfo || !this.pdfInfo.url) {
      this.showError('Δεν βρέθηκε URL PDF');
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        action: 'openPDFEditor',
        url: this.pdfInfo.url
      });

      window.close();
    } catch (error) {
      console.error('Failed to open PDF:', error);
      this.showError('Δεν ήταν δυνατό το άνοιγμα του PDF');
    }
  }

  async openEditor() {
    try {
      const editorUrl = chrome.runtime.getURL('src/ui/main/main.html');
      await chrome.tabs.create({ url: editorUrl });
      window.close();
    } catch (error) {
      console.error('Failed to open editor:', error);
      this.showError('Δεν ήταν δυνατό το άνοιγμα του editor');
    }
  }

  async browseFiles() {
    // This would trigger the file picker in the editor
    await this.openEditor();
  }

  async quickMerge() {
    try {
      await chrome.runtime.sendMessage({
        action: 'openPDFEditor',
        url: this.pdfInfo?.url,
        mode: 'merge'
      });

      window.close();
    } catch (error) {
      console.error('Failed to start merge:', error);
      this.showError('Δεν ήταν δυνατή η έναρξη της συγχώνευσης');
    }
  }

  async quickSplit() {
    try {
      await chrome.runtime.sendMessage({
        action: 'openPDFEditor',
        url: this.pdfInfo?.url,
        mode: 'split'
      });

      window.close();
    } catch (error) {
      console.error('Failed to start split:', error);
      this.showError('Δεν ήταν δυνατή η έναρξη του διαχωρισμού');
    }
  }

  openOptions() {
    // Open main editor as options (since no separate options page in MV3)
    this.openEditor();
  }

  openHelp() {
    const helpUrl = 'https://github.com/pdf-editor-pro/help';
    chrome.tabs.create({ url: helpUrl });
    window.close();
  }

  openFeedback() {
    const feedbackUrl = 'https://github.com/pdf-editor-pro/feedback';
    chrome.tabs.create({ url: feedbackUrl });
    window.close();
  }

  hideLoading() {
    const loading = document.getElementById('popup-loading');
    if (loading) {
      loading.style.display = 'none';
    }
  }

  showError(message) {
    console.error(message);

    // Create simple error state
    const main = document.getElementById('popup-main');
    if (main) {
      main.innerHTML = `
        <div class="state-section">
          <div class="empty-state">
            <div class="empty-icon">⚠️</div>
            <h3>Σφάλμα</h3>
            <p>${message}</p>
          </div>
          <div class="action-buttons">
            <button id="retry-btn" class="btn btn-secondary btn-full">Προσπάθεια ξανά</button>
          </div>
        </div>
      `;

      // Add retry functionality
      const retryBtn = document.getElementById('retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => this.initialize());
      }
    }
  }

  updateUI() {
    // Update theme based on system preferences or saved preference
    const savedTheme = localStorage.getItem('pdf-editor-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');

    document.documentElement.setAttribute('data-theme', theme);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const popup = new PopupManager();
  popup.initialize();
});

// Handle messages from background script
if (chrome.runtime && chrome.runtime.onMessage) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Popup received message:', message);

    switch (message.action) {
      case 'updatePDFInfo':
        // Refresh PDF detection
        const popup = new PopupManager();
        popup.detectPDF();
        sendResponse({ success: true });
        break;
    }
  });
}

console.log('PDF Editor Pro popup script loaded');
