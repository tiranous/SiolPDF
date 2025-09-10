/**
 * Main UI Controller - PDF Editor Pro
 * MV3-compliant with ES modules and CSP compliance
 */

// ES Module imports for PDF.js
import * as pdfjsLib from "../../lib/pdf.mjs";

// PDF.js Worker configuration
pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("src/lib/pdf.worker.mjs");

// Application state
class PDFEditorState {
  constructor() {
    this.currentPDF = null;
    this.currentPageNum = 1;
    this.totalPages = 0;
    this.zoomLevel = 1;
    this.history = [];
    this.historyIndex = -1;
    this.isDirty = false;
    this.isLoading = false;
  }

  addToHistory(action) {
    // Remove any history after current index
    this.history = this.history.slice(0, this.historyIndex + 1);
    this.history.push(action);
    this.historyIndex++;
    this.isDirty = true;
    this.updateUI();
  }

  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.applyHistoryState();
    }
  }

  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.applyHistoryState();
    }
  }

  applyHistoryState() {
    // Implementation would apply the historical state
    this.updateUI();
  }

  updateUI() {
    // Update undo/redo buttons
    const undoBtn = document.getElementById('undo');
    const redoBtn = document.getElementById('redo');

    if (undoBtn) undoBtn.disabled = this.historyIndex <= 0;
    if (redoBtn) redoBtn.disabled = this.historyIndex >= this.history.length - 1;

    // Update changes indicator
    const changesIndicator = document.getElementById('changes-indicator');
    if (changesIndicator) {
      changesIndicator.textContent = this.isDirty ? 'Μη αποθηκευμένες αλλαγές' : 'Αποθηκευμένο';
    }
  }
}

// Global app state
const appState = new PDFEditorState();

// PDF processing with Web Workers
class PDFProcessor {
  constructor() {
    this.worker = null;
    this.mergeWorker = null;
  }

  async initializeWorkers() {
    try {
      // Initialize PDF processing worker
      this.worker = new Worker(
        chrome.runtime.getURL("src/workers/pdf-worker.js"), 
        { type: "module" }
      );

      // Initialize merge worker
      this.mergeWorker = new Worker(
        chrome.runtime.getURL("src/workers/merge-worker.js"), 
        { type: "module" }
      );

      this.worker.addEventListener('message', this.handleWorkerMessage.bind(this));
      this.mergeWorker.addEventListener('message', this.handleMergeMessage.bind(this));

      console.log('PDF Workers initialized successfully');
    } catch (error) {
      console.error('Failed to initialize workers:', error);
      showToast('error', 'Σφάλμα', 'Δεν ήταν δυνατή η φόρτωση των workers');
    }
  }

  handleWorkerMessage(event) {
    const { success, result, error } = event.data;

    if (success) {
      console.log('Worker operation completed:', result);
    } else {
      console.error('Worker error:', error);
      showToast('error', 'Σφάλμα επεξεργασίας', error);
    }
  }

  handleMergeMessage(event) {
    const { success, result, error, type } = event.data;

    if (type === 'progress') {
      updateMergeProgress(event.data);
    } else if (success) {
      showToast('success', 'Συγχώνευση ολοκληρώθηκε', 'Το PDF είναι έτοιμο για εξαγωγή');
    } else {
      showToast('error', 'Σφάλμα συγχώνευσης', error);
    }
  }

  async splitPDF(ranges) {
    if (!this.worker) await this.initializeWorkers();

    this.worker.postMessage({
      action: 'split',
      buffer: appState.currentPDF,
      ranges: ranges
    });
  }

  async mergePDFs(buffers) {
    if (!this.mergeWorker) await this.initializeWorkers();

    this.mergeWorker.postMessage({
      action: 'merge',
      buffers: buffers
    });
  }
}

// Global PDF processor
const pdfProcessor = new PDFProcessor();

// Toast notification system
function showToast(type, title, message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <div class="toast-content">
      <div class="toast-message">
        <div class="toast-title">${title}</div>
        <div class="toast-description">${message}</div>
      </div>
    </div>
    <button class="toast-close" aria-label="Κλείσιμο">×</button>
  `;

  // Add close functionality
  const closeBtn = toast.querySelector('.toast-close');
  closeBtn.addEventListener('click', () => toast.remove());

  container.appendChild(toast);

  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.remove();
    }
  }, 5000);
}

// PDF rendering functions
async function loadPDF(source) {
  try {
    appState.isLoading = true;
    updateLoadingMessage('Φόρτωση PDF...');

    const loadingTask = pdfjsLib.getDocument({
      url: source,
      cMapUrl: chrome.runtime.getURL('src/lib/cmaps/'),
      cMapPacked: true
    });

    const pdf = await loadingTask.promise;
    appState.currentPDF = pdf;
    appState.totalPages = pdf.numPages;
    appState.currentPageNum = 1;

    // Update UI
    document.getElementById('total-pages').textContent = appState.totalPages;
    document.getElementById('current-page').textContent = appState.currentPageNum;

    // Enable controls
    enablePDFControls();

    // Render first page
    await renderPage(1);

    // Generate thumbnails
    await generateThumbnails();

    // Hide empty state, show PDF viewer
    document.getElementById('empty-state').style.display = 'none';
    document.getElementById('pdf-canvas').style.display = 'block';

    // Update file info
    const fileInfo = document.getElementById('file-info');
    if (fileInfo) {
      fileInfo.textContent = `PDF - ${appState.totalPages} σελίδες`;
    }

    showToast('success', 'PDF φορτώθηκε', `${appState.totalPages} σελίδες έτοιμες για επεξεργασία`);

  } catch (error) {
    console.error('Error loading PDF:', error);
    showToast('error', 'Σφάλμα φόρτωσης', 'Δεν ήταν δυνατή η φόρτωση του PDF');
  } finally {
    appState.isLoading = false;
    hideLoading();
  }
}

async function renderPage(pageNum) {
  if (!appState.currentPDF || pageNum < 1 || pageNum > appState.totalPages) {
    return;
  }

  try {
    const page = await appState.currentPDF.getPage(pageNum);
    const canvas = document.getElementById('pdf-canvas');
    const ctx = canvas.getContext('2d');

    // Calculate viewport based on zoom
    const viewport = page.getViewport({ scale: appState.zoomLevel });

    // Set canvas size
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Render page
    const renderContext = {
      canvasContext: ctx,
      viewport: viewport
    };

    await page.render(renderContext).promise;

    // Update current page indicator
    appState.currentPageNum = pageNum;
    document.getElementById('current-page').textContent = pageNum;

    // Update navigation buttons
    const prevBtn = document.getElementById('prev-page');
    const nextBtn = document.getElementById('next-page');

    if (prevBtn) prevBtn.disabled = pageNum <= 1;
    if (nextBtn) nextBtn.disabled = pageNum >= appState.totalPages;

  } catch (error) {
    console.error('Error rendering page:', error);
    showToast('error', 'Σφάλμα', 'Δεν ήταν δυνατή η απόδοση της σελίδας');
  }
}

async function generateThumbnails() {
  const container = document.getElementById('thumbnails-container');
  if (!container || !appState.currentPDF) return;

  // Clear existing thumbnails
  container.innerHTML = '';

  // Generate thumbnails for all pages
  for (let i = 1; i <= appState.totalPages; i++) {
    const thumbnailDiv = document.createElement('div');
    thumbnailDiv.className = 'thumbnail-item';
    thumbnailDiv.dataset.pageNum = i;

    // Add click handler for navigation
    thumbnailDiv.addEventListener('click', () => {
      renderPage(i);
      // Update active thumbnail
      container.querySelectorAll('.thumbnail-item').forEach(item => 
        item.classList.remove('active')
      );
      thumbnailDiv.classList.add('active');
    });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    try {
      const page = await appState.currentPDF.getPage(i);
      const viewport = page.getViewport({ scale: 0.2 }); // Small scale for thumbnails

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      thumbnailDiv.appendChild(canvas);

      const pageLabel = document.createElement('div');
      pageLabel.className = 'thumbnail-label';
      pageLabel.textContent = `${i}`;
      thumbnailDiv.appendChild(pageLabel);

    } catch (error) {
      console.error(`Error generating thumbnail for page ${i}:`, error);

      // Create placeholder thumbnail
      canvas.width = 100;
      canvas.height = 140;
      ctx.fillStyle = '#f0f0f0';
      ctx.fillRect(0, 0, 100, 140);
      ctx.fillStyle = '#666';
      ctx.textAlign = 'center';
      ctx.font = '12px Arial';
      ctx.fillText(`Page ${i}`, 50, 70);

      thumbnailDiv.appendChild(canvas);
    }

    container.appendChild(thumbnailDiv);

    // Mark first thumbnail as active
    if (i === 1) {
      thumbnailDiv.classList.add('active');
    }
  }
}

function enablePDFControls() {
  const controls = [
    'merge-pdf', 'split-pdf', 'crop-tool', 'remove-camscanner',
    'text-tool', 'stamp-tool', 'export-pdf', 'zoom-in', 'zoom-out',
    'zoom-level', 'prev-page', 'next-page'
  ];

  controls.forEach(id => {
    const element = document.getElementById(id);
    if (element) element.disabled = false;
  });
}

function updateLoadingMessage(message) {
  const loadingMessage = document.getElementById('loading-message');
  if (loadingMessage) {
    loadingMessage.textContent = message;
  }
}

function hideLoading() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.display = 'none';
  }
}

function updateMergeProgress(data) {
  showToast('info', 'Συγχώνευση', data.message);
}

// Event handlers
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file && file.type === 'application/pdf') {
    const fileURL = URL.createObjectURL(file);
    loadPDF(fileURL);
  } else {
    showToast('error', 'Άκυρο αρχείο', 'Παρακαλώ επιλέξτε ένα έγκυρο PDF αρχείο');
  }
}

function handleMergeFiles(event) {
  const files = Array.from(event.target.files);
  const pdfFiles = files.filter(file => file.type === 'application/pdf');

  if (pdfFiles.length === 0) {
    showToast('error', 'Άκυρα αρχεία', 'Παρακαλώ επιλέξτε PDF αρχεία για συγχώνευση');
    return;
  }

  showToast('info', 'Συγχώνευση', `Ξεκινά συγχώνευση ${pdfFiles.length} αρχείων...`);

  // Convert files to array buffers and merge
  Promise.all(pdfFiles.map(file => file.arrayBuffer()))
    .then(buffers => pdfProcessor.mergePDFs(buffers))
    .catch(error => {
      console.error('Merge error:', error);
      showToast('error', 'Σφάλμα συγχώνευσης', 'Δεν ήταν δυνατή η συγχώνευση των αρχείων');
    });
}

function handleZoomChange(event) {
  const value = event.target.value;

  if (value === 'fit-page' || value === 'fit-width') {
    // Calculate appropriate zoom level
    const canvas = document.getElementById('pdf-canvas');
    const container = document.getElementById('viewer-container');

    if (canvas && container) {
      const containerWidth = container.clientWidth - 40; // padding
      const containerHeight = container.clientHeight - 40;

      if (value === 'fit-width') {
        appState.zoomLevel = containerWidth / canvas.width;
      } else {
        const scaleWidth = containerWidth / canvas.width;
        const scaleHeight = containerHeight / canvas.height;
        appState.zoomLevel = Math.min(scaleWidth, scaleHeight);
      }
    }
  } else {
    appState.zoomLevel = parseFloat(value);
  }

  renderPage(appState.currentPageNum);
}

function handleThemeToggle() {
  const html = document.documentElement;
  const currentTheme = html.getAttribute('data-theme');
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', newTheme);
  localStorage.setItem('pdf-editor-theme', newTheme);

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = newTheme === 'dark' ? '☀️' : '🌙';
  }
}

// Drag and drop handling
function setupDragDrop() {
  const dropZone = document.getElementById('viewer-container');
  const dropIndicator = document.getElementById('drop-zone');

  if (!dropZone || !dropIndicator) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropIndicator.classList.add('active');
  });

  dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) {
      dropIndicator.classList.remove('active');
    }
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropIndicator.classList.remove('active');

    const files = Array.from(e.dataTransfer.files);
    const pdfFile = files.find(file => file.type === 'application/pdf');

    if (pdfFile) {
      const fileURL = URL.createObjectURL(pdfFile);
      loadPDF(fileURL);
    } else {
      showToast('error', 'Άκυρο αρχείο', 'Παρακαλώ σύρετε ένα έγκυρο PDF αρχείο');
    }
  });
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Skip if typing in input field
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch (e.key.toLowerCase()) {
      case 'o':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('open-pdf')?.click();
        }
        break;
      case 'm':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('merge-pdf')?.click();
        }
        break;
      case 's':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('split-pdf')?.click();
        }
        break;
      case 'e':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('export-pdf')?.click();
        }
        break;
      case 'c':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('crop-tool')?.click();
        }
        break;
      case 'r':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('remove-camscanner')?.click();
        }
        break;
      case 't':
        if (!e.ctrlKey && !e.metaKey) {
          document.getElementById('text-tool')?.click();
        }
        break;
      case 'z':
        if (e.ctrlKey || e.metaKey) {
          e.preventDefault();
          if (e.shiftKey) {
            appState.redo();
          } else {
            appState.undo();
          }
        }
        break;
      case '+':
      case '=':
        document.getElementById('zoom-in')?.click();
        break;
      case '-':
        document.getElementById('zoom-out')?.click();
        break;
      case '0':
        const zoomSelect = document.getElementById('zoom-level');
        if (zoomSelect) {
          zoomSelect.value = '1';
          handleZoomChange({ target: zoomSelect });
        }
        break;
    }
  });
}

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
  console.log('PDF Editor Pro initializing...');

  // Initialize workers
  await pdfProcessor.initializeWorkers();

  // Setup event listeners
  setupEventListeners();
  setupDragDrop();
  setupKeyboardShortcuts();

  // Load saved theme
  loadSavedTheme();

  // Handle onboarding
  handleOnboarding();

  // Check for PDF URL in query params
  const urlParams = new URLSearchParams(window.location.search);
  const pdfUrl = urlParams.get('pdf');

  if (pdfUrl) {
    try {
      const decodedUrl = decodeURIComponent(pdfUrl);
      loadPDF(decodedUrl);
    } catch (error) {
      console.error('Failed to load PDF from URL:', error);
    }
  }

  // Hide loading screen
  setTimeout(() => {
    hideLoading();
    document.getElementById('app').style.display = 'flex';

    // Show onboarding if first time
    if (!localStorage.getItem('pdf-editor-onboarded')) {
      document.getElementById('onboarding-overlay').style.display = 'flex';
    }
  }, 1000);

  console.log('PDF Editor Pro initialized successfully');
});

function setupEventListeners() {
  // File operations
  const openPdfBtn = document.getElementById('open-pdf');
  const emptyOpenPdfBtn = document.getElementById('empty-open-pdf');
  const fileInput = document.getElementById('file-input');
  const mergeFileInput = document.getElementById('merge-file-input');

  openPdfBtn?.addEventListener('click', () => fileInput?.click());
  emptyOpenPdfBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', handleFileSelect);
  mergeFileInput?.addEventListener('change', handleMergeFiles);

  // PDF operations
  document.getElementById('merge-pdf')?.addEventListener('click', () => {
    mergeFileInput?.click();
  });

  document.getElementById('split-pdf')?.addEventListener('click', () => {
    showToast('info', 'Διαχωρισμός', 'Εισάγετε ranges σελίδων (π.χ. 1-3,5)');
  });

  document.getElementById('export-pdf')?.addEventListener('click', () => {
    showToast('success', 'Εξαγωγή', 'Το PDF θα κατέβει σύντομα');
  });

  // Zoom controls
  document.getElementById('zoom-level')?.addEventListener('change', handleZoomChange);
  document.getElementById('zoom-in')?.addEventListener('click', () => {
    appState.zoomLevel = Math.min(appState.zoomLevel * 1.2, 5);
    renderPage(appState.currentPageNum);
  });
  document.getElementById('zoom-out')?.addEventListener('click', () => {
    appState.zoomLevel = Math.max(appState.zoomLevel / 1.2, 0.1);
    renderPage(appState.currentPageNum);
  });

  // Page navigation
  document.getElementById('prev-page')?.addEventListener('click', () => {
    if (appState.currentPageNum > 1) {
      renderPage(appState.currentPageNum - 1);
    }
  });
  document.getElementById('next-page')?.addEventListener('click', () => {
    if (appState.currentPageNum < appState.totalPages) {
      renderPage(appState.currentPageNum + 1);
    }
  });

  // Theme toggle
  document.getElementById('theme-toggle')?.addEventListener('click', handleThemeToggle);

  // Onboarding
  document.getElementById('skip-onboarding')?.addEventListener('click', () => {
    document.getElementById('onboarding-overlay').style.display = 'none';
  });

  document.getElementById('start-using')?.addEventListener('click', () => {
    const dontShow = document.getElementById('dont-show-again')?.checked;
    if (dontShow) {
      localStorage.setItem('pdf-editor-onboarded', 'true');
    }
    document.getElementById('onboarding-overlay').style.display = 'none';
  });

  // Undo/Redo
  document.getElementById('undo')?.addEventListener('click', () => appState.undo());
  document.getElementById('redo')?.addEventListener('click', () => appState.redo());
}

function loadSavedTheme() {
  const savedTheme = localStorage.getItem('pdf-editor-theme') || 
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');

  document.documentElement.setAttribute('data-theme', savedTheme);

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    themeBtn.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
  }
}

function handleOnboarding() {
  // Handle messages from background script
  chrome.runtime.onMessage?.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'openPDF':
        loadPDF(message.url);
        sendResponse({ success: true });
        break;
      case 'startQuickMerge':
        document.getElementById('merge-pdf')?.click();
        sendResponse({ success: true });
        break;
      case 'startQuickSplit':
        document.getElementById('split-pdf')?.click();
        sendResponse({ success: true });
        break;
    }
  });
}

// Export for testing
export { appState, pdfProcessor, loadPDF, renderPage };
