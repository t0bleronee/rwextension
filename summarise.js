// content.js

let webllmFrame;
let webllmReady = false;
let pendingCallbacks = {};
let initializationTimeout;

console.log("[CONTENT] Script injected and running");

// Fallback summarization function
function fallbackSummarize(text) {
  // Simple extractive summarization
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const words = text.toLowerCase().split(/\s+/);
  
  // Count word frequency
  const wordFreq = {};
  words.forEach(word => {
    if (word.length > 3) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }
  });
  
  // Score sentences by word frequency
  const sentenceScores = sentences.map(sentence => {
    const sentenceWords = sentence.toLowerCase().split(/\s+/);
    const score = sentenceWords.reduce((sum, word) => sum + (wordFreq[word] || 0), 0);
    return { sentence: sentence.trim(), score };
  });
  
  // Get top 3 sentences
  const topSentences = sentenceScores
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(item => item.sentence)
    .filter(s => s.length > 20);
  
  return topSentences.join('. ') + '.';
}

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
      clearTimeout(initializationTimeout);
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
  
  // Set a timeout for WebLLM initialization
  initializationTimeout = setTimeout(() => {
    if (!webllmReady) {
      console.warn("[CONTENT] WebLLM initialization timeout, will use fallback");
      webllmReady = true; // Allow processing to continue
    }
  }, 15000); // 15 second timeout
}

function summarizeWithWebLLM(text) {
  return new Promise((resolve) => {
    initWebLLMFrame();
    
    const waitForWebLLMReady = () => {
      console.log("[CONTENT] Checking if WebLLM is ready...", webllmReady);
      
      if (webllmReady && webllmFrame.contentWindow) {
        const id = crypto.randomUUID();
        pendingCallbacks[id] = (reply) => {
          // Check if WebLLM returned an error
          if (reply && reply.includes("Error")) {
            console.log("[CONTENT] WebLLM failed, using fallback");
            resolve(fallbackSummarize(text));
          } else {
            resolve(reply);
          }
        };
        
        const messageData = { content: text, id };
        console.log("[CONTENT] Sending message to ready WebLLM:", messageData);
        
        try {
          webllmFrame.contentWindow.postMessage(messageData, "*");
        } catch (error) {
          console.error("[CONTENT] Error sending message to WebLLM:", error);
          resolve(fallbackSummarize(text));
        }
      } else {
        console.log("[CONTENT] WebLLM not ready yet, waiting...");
        setTimeout(waitForWebLLMReady, 1000); // Check every second
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
chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
  if (msg.type === "SUMMARIZE_WITH_WEBLLM") {
    console.log("[CONTENT] Received SUMMARIZE_WITH_WEBLLM, starting summarization");

    const { title, content, url } = msg;
    
    try {
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
    } catch (error) {
      console.error("[CONTENT] Error during summarization:", error);
      
      // Use fallback summarization
      const fallbackSummary = fallbackSummarize(content);
      
      chrome.runtime.sendMessage({
        type: "SUMMARY_RESULT",
        title,
        summary: fallbackSummary,
        url,
        time: Date.now(),
      });
    }

    return true; // ✅ Ensure background gets the message!
  }
});
