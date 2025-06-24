// This file should be renamed to summarise.js

let webllmFrame;
let webllmReady = false;
let pendingCallbacks = {};

console.log("[CONTENT] Script injected and running");

function initWebLLMFrame() {
  if (webllmFrame) return;
  
  webllmFrame = document.createElement("iframe");
  webllmFrame.style.display = "none";
  webllmFrame.src = chrome.runtime.getURL("webllm/webllm-runner.html");
  
  document.body.appendChild(webllmFrame);
  
  // Listen for messages from iframe
  window.addEventListener("message", (event) => {
    console.log("[CONTENT] Received message from iframe:", event.data);
    
    // Check if this is a "ready" message
    if (event.data && event.data.type === "WEBLLM_READY") {
      console.log("[CONTENT] WebLLM is now ready!");
      webllmReady = true;
      return;
    }
    
    // Handle normal responses
    const { id, reply } = event.data;
    if (pendingCallbacks[id]) {
      console.log("[CONTENT] Received reply from iframe:", reply);
      pendingCallbacks[id](reply);
      delete pendingCallbacks[id];
    }
  });
}

function summarizeWithWebLLM(text) {
  return new Promise((resolve) => {
    initWebLLMFrame();
    
    const waitForWebLLMReady = () => {
      console.log("[CONTENT] Checking if WebLLM is ready...", webllmReady);
      
      if (webllmReady && webllmFrame.contentWindow) {
        const id = crypto.randomUUID();
        pendingCallbacks[id] = resolve;
        
        const messageData = { content: text, id };
        console.log("[CONTENT] Sending message to ready WebLLM:", messageData);
        
        webllmFrame.contentWindow.postMessage(messageData, "*");
      } else {
        console.log("[CONTENT] WebLLM not ready yet, waiting...");
        setTimeout(waitForWebLLMReady, 500);
      }
    };
    
    waitForWebLLMReady();
  });
}


function getMainText() {
  const body = document.body.innerText || "";
  return body.slice(0, 3000);
}

// Trigger page capture
chrome.runtime.sendMessage({
  type: "PAGE_CAPTURE",
  title: document.title,
  url: window.location.href,
  content: getMainText(),
});
console.log("[CONTENT] Sent PAGE_CAPTURE");
// Listen for message from background to summarize
// summarise.js
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "SUMMARIZE_WITH_WEBLLM") {
    console.log("[CONTENT] Received SUMMARIZE_WITH_WEBLLM, starting summarization");

    const { title, content, url } = msg;
    
    const summary = await summarizeWithWebLLM(content);
    console.log("[CONTENT] Summary generated:", summary);

    chrome.runtime.sendMessage({
      type: "SUMMARY_RESULT",
      title,
      summary,
      url,
      time: Date.now(),
    }, () => {
      console.log("[CONTENT] Sent SUMMARY_RESULT to background");
    });

    return true; // ✅ Ensure background gets the message!
  }
});
