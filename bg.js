// background.js



chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  console.log("[BACKGROUND] Received message:", msg);
  if (msg.type === "PAGE_CAPTURE") {
    chrome.tabs.sendMessage(sender.tab.id, {
      type: "SUMMARIZE_WITH_WEBLLM",
      title: msg.title,
      content: msg.content,
      url: msg.url,
    });
  }

  if (msg.type === "SUMMARY_RESULT") {
    const { title, summary, url, time } = msg;

    chrome.storage.local.set({
      [url]: { title, summary, url, time },
    });

    console.log("✅ Summary saved for:", url);
  }

  return true; // for async sendResponse
});

chrome.runtime.onInstalled.addListener(() => {
  console.log("Service Worker: Installed");
});

chrome.runtime.onStartup.addListener(() => {
  console.log("Service Worker: Startup");
});


