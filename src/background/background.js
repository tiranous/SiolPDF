// MV3 service worker

// Create context menu for PDF pages/links
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "siolpdf-open",
    title: "Άνοιγμα στο PDF Editor Pro",
    contexts: ["page", "link"],
    documentUrlPatterns: ["*://*/*.pdf", "file:///*/*.pdf"],
    targetUrlPatterns:   ["*://*/*.pdf", "file:///*/*.pdf"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const url = info.linkUrl || info.pageUrl;
  if (url) openEditor(url);
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "OPEN_EDITOR" && msg.src) {
    openEditor(msg.src);
  }
  // keep listener alive for async if ever needed
  return false;
});

function openEditor(srcUrl) {
  const editor = chrome.runtime.getURL("src/ui/main/main.html");
  const url = `${editor}?src=${encodeURIComponent(srcUrl)}`;
  chrome.tabs.create({ url });
}
