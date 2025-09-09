/**
 * Background Service Worker - PDF Editor Pro (MV3)
 * Handles extension lifecycle, context menus, and cross-tab communication
 */

// Extension installation and updates
chrome.runtime.onInstalled.addListener((details) => {
  console.log('PDF Editor Pro installed:', details.reason);

  if (details.reason === 'install') {
    initializeExtension();
  } else if (details.reason === 'update') {
    console.log('Updated from version:', details.previousVersion);
    updateExtension(details.previousVersion);
  }
});

// Initialize extension
function initializeExtension() {
  createContextMenus();

  // Set default settings
  chrome.storage.local.set({
    'pdf-editor-settings': {
      theme: 'auto',
      defaultZoom: 1,
      showOnboarding: true,
      shortcuts: {
        open: 'KeyO',
        merge: 'KeyM',
        split: 'KeyS',
        export: 'KeyE'
      },
      version: '1.0.0'
    }
  }).catch(error => {
    console.error('Failed to save settings:', error);
  });

  console.log('PDF Editor Pro initialized successfully');
}

// Update extension
function updateExtension(previousVersion) {
  console.log(`Updating from version ${previousVersion} to 1.0.0`);
  // Handle any migration logic here
}

// Context menu creation
function createContextMenus() {
  // Remove existing menus first
  chrome.contextMenus.removeAll(() => {
    // Main menu for PDF files
    chrome.contextMenus.create({
      id: 'open-pdf-editor',
      title: 'Άνοιγμα στο PDF Editor Pro',
      contexts: ['page', 'link'],
      targetUrlPatterns: [
        '*://*/*.pdf',
        'file:///*/*.pdf'
      ]
    });

    // Submenu for PDF operations
    chrome.contextMenus.create({
      id: 'pdf-operations',
      title: 'PDF Operations',
      contexts: ['page', 'link'],
      targetUrlPatterns: [
        '*://*/*.pdf',
        'file:///*/*.pdf'
      ]
    });

    chrome.contextMenus.create({
      id: 'quick-merge',
      parentId: 'pdf-operations',
      title: 'Γρήγορη συγχώνευση',
      contexts: ['page', 'link'],
      targetUrlPatterns: ['*://*/*.pdf', 'file:///*/*.pdf']
    });

    chrome.contextMenus.create({
      id: 'quick-split',
      parentId: 'pdf-operations', 
      title: 'Γρήγορος διαχωρισμός',
      contexts: ['page', 'link'],
      targetUrlPatterns: ['*://*/*.pdf', 'file:///*/*.pdf']
    });

    console.log('Context menus created successfully');
  });
}

// Context menu click handler
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  console.log('Context menu clicked:', info.menuItemId);

  try {
    switch (info.menuItemId) {
      case 'open-pdf-editor':
        await openPDFEditor(info, tab);
        break;

      case 'quick-merge':
        await quickMerge(info, tab);
        break;

      case 'quick-split':
        await quickSplit(info, tab);
        break;
    }
  } catch (error) {
    console.error('Context menu action failed:', error);

    // Show notification on error
    chrome.notifications.create({
      type: 'basic',
      iconUrl: chrome.runtime.getURL('src/assets/icons/icon-48.png'),
      title: 'PDF Editor Pro',
      message: 'Δεν ήταν δυνατή η εκτέλεση της ενέργειας'
    }).catch(() => {
      // Notifications might not be available
      console.log('Could not show notification');
    });
  }
});

// Open PDF in editor
async function openPDFEditor(info, tab) {
  try {
    const pdfUrl = info.linkUrl || info.pageUrl || tab.url;
    const editorUrl = chrome.runtime.getURL('src/ui/main/main.html');

    // Check if editor is already open
    const tabs = await chrome.tabs.query({ url: editorUrl });

    if (tabs.length > 0) {
      // Focus existing editor and send PDF URL
      await chrome.tabs.update(tabs[0].id, { active: true });

      // Send message to open PDF
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'openPDF',
        url: pdfUrl
      }).catch(error => {
        console.warn('Could not send message to editor tab:', error);
      });
    } else {
      // Open new editor tab
      await chrome.tabs.create({
        url: `${editorUrl}?pdf=${encodeURIComponent(pdfUrl)}`
      });
    }

  } catch (error) {
    console.error('Failed to open PDF editor:', error);
    throw error;
  }
}

// Quick merge functionality
async function quickMerge(info, tab) {
  await openPDFEditor(info, tab);

  // Send message to start merge process after a short delay
  setTimeout(async () => {
    try {
      const editorUrl = chrome.runtime.getURL('src/ui/main/main.html');
      const tabs = await chrome.tabs.query({ url: editorUrl });

      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startQuickMerge'
        }).catch(error => {
          console.warn('Could not send merge message:', error);
        });
      }
    } catch (error) {
      console.error('Failed to initiate quick merge:', error);
    }
  }, 1000);
}

// Quick split functionality  
async function quickSplit(info, tab) {
  await openPDFEditor(info, tab);

  setTimeout(async () => {
    try {
      const editorUrl = chrome.runtime.getURL('src/ui/main/main.html');
      const tabs = await chrome.tabs.query({ url: editorUrl });

      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: 'startQuickSplit'
        }).catch(error => {
          console.warn('Could not send split message:', error);
        });
      }
    } catch (error) {
      console.error('Failed to initiate quick split:', error);
    }
  }, 1000);
}

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Background received message:', message);

  switch (message.action) {
    case 'openPDFEditor':
      openPDFEditor({ pageUrl: message.url }, sender.tab)
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true; // Keep message channel open for async response

    case 'getPDFFromTab':
      getPDFFromCurrentTab()
        .then(result => sendResponse(result))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;

    case 'downloadPDF':
      chrome.downloads.download({
        url: message.url,
        filename: message.filename || 'document.pdf'
      }).then(downloadId => {
        sendResponse({ success: true, downloadId });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;

    case 'getSettings':
      chrome.storage.local.get('pdf-editor-settings')
        .then(result => {
          sendResponse({ 
            success: true, 
            settings: result['pdf-editor-settings'] || {} 
          });
        })
        .catch(error => {
          sendResponse({ success: false, error: error.message });
        });
      return true;

    case 'saveSettings':
      chrome.storage.local.set({ 'pdf-editor-settings': message.settings })
        .then(() => sendResponse({ success: true }))
        .catch(error => sendResponse({ success: false, error: error.message }));
      return true;
  }
});

// Get PDF data from current tab
async function getPDFFromCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab found');
    }

    // Check if current tab is a PDF
    if (tab.url && tab.url.toLowerCase().includes('.pdf')) {
      return {
        success: true,
        url: tab.url,
        title: tab.title,
        isPDF: true,
        source: 'direct'
      };
    }

    // Try to extract PDF from page content
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractPDFFromPage
      });

      if (results && results[0] && results[0].result) {
        return {
          success: true,
          ...results[0].result
        };
      }
    } catch (scriptError) {
      console.warn('Could not execute script in tab:', scriptError);
    }

    return {
      success: false,
      error: 'No PDF found in current tab',
      isPDF: false
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      isPDF: false
    };
  }
}

// Function to inject into page to extract PDF
function extractPDFFromPage() {
  try {
    // Look for embedded PDFs
    const pdfEmbeds = document.querySelectorAll('embed[type="application/pdf"], object[type="application/pdf"]');
    const pdfLinks = document.querySelectorAll('a[href$=".pdf"]');

    if (pdfEmbeds.length > 0) {
      return {
        isPDF: true,
        url: pdfEmbeds[0].src,
        embedded: true,
        source: 'embedded'
      };
    }

    if (pdfLinks.length > 0) {
      return {
        isPDF: false,
        pdfLinks: Array.from(pdfLinks).slice(0, 5).map(link => ({
          url: link.href,
          text: link.textContent.trim() || link.href
        })),
        source: 'links'
      };
    }

    // Check if current page is PDF viewer
    if (window.location.href.includes('pdf') || 
        document.contentType === 'application/pdf') {
      return {
        isPDF: true,
        url: window.location.href,
        viewer: true,
        source: 'viewer'
      };
    }

    return null;
  } catch (error) {
    console.error('Error extracting PDF:', error);
    return null;
  }
}

// Handle extension icon click
chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Try to detect PDF in current tab first
    const pdfInfo = await getPDFFromCurrentTab();

    if (pdfInfo.success && pdfInfo.isPDF) {
      // Open PDF editor with current PDF
      await openPDFEditor({ pageUrl: pdfInfo.url }, tab);
    } else {
      // Open PDF editor without PDF (empty state)
      const editorUrl = chrome.runtime.getURL('src/ui/main/main.html');
      await chrome.tabs.create({ url: editorUrl });
    }
  } catch (error) {
    console.error('Failed to handle action click:', error);
  }
});

// Tab update listener (for PDF detection badge)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      if (tab.url.toLowerCase().includes('.pdf')) {
        // Show PDF badge
        chrome.action.setBadgeText({
          tabId: tabId,
          text: 'PDF'
        });

        chrome.action.setBadgeBackgroundColor({
          tabId: tabId,
          color: '#3b82f6'
        });
      } else {
        // Clear badge
        chrome.action.setBadgeText({
          tabId: tabId,
          text: ''
        });
      }
    } catch (error) {
      // Badge operations might fail, ignore
      console.warn('Badge operation failed:', error);
    }
  }
});

// Extension startup
chrome.runtime.onStartup.addListener(() => {
  console.log('PDF Editor Pro service worker started');
});

// Keep service worker alive
chrome.runtime.onSuspend.addListener(() => {
  console.log('PDF Editor Pro service worker suspending');
});

// Error handling
self.addEventListener('error', (event) => {
  console.error('Service worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service worker unhandled rejection:', event.reason);
});

console.log('PDF Editor Pro background service worker loaded');
