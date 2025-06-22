console.log("[WEBLLM-RUNNER] Starting WebLLM runner...");

let engine = null;
let isReady = false;

// Function to notify parent that WebLLM is ready
function notifyReady() {
  if (!isReady) {
    isReady = true;
    console.log("[WEBLLM-RUNNER] Notifying parent that WebLLM is ready");
    window.parent.postMessage({ type: "WEBLLM_READY" }, "*");
  }
}

// Initialize WebLLM
async function initializeWebLLM() {
  try {
    console.log("[WEBLLM-RUNNER] Checking for webllm...");
    if (!window.webllm) {
      console.error("[WEBLLM-RUNNER] webllm not available!");
      // Still notify ready so parent doesn't wait forever
      notifyReady();
      return;
    }
    
    console.log("[WEBLLM-RUNNER] webllm found, initializing...");
    engine = new window.webllm.MLCEngine();
    console.log("[WEBLLM-RUNNER] Engine initialized:", engine);
    
    console.log("[WEBLLM-RUNNER] Loading model...");
    await engine.reload("TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC", {
      temperature: 0.7,
      top_p: 0.95,
    });
    console.log("[WEBLLM-RUNNER] Model loaded successfully");
    
    // Notify parent that WebLLM is ready
    notifyReady();
    
  } catch (error) {
    console.error("[WEBLLM-RUNNER] Error initializing WebLLM:", error);
    // Notify ready even if there's an error so parent doesn't wait forever
    notifyReady();
  }
}

// Handle messages from parent
window.addEventListener("message", async (event) => {
  console.log("[WEBLLM-RUNNER] Received message:", event.data);
  
  // Handle ready check
  if (event.data && event.data.type === "CHECK_READY") {
    if (isReady) {
      window.parent.postMessage({ type: "WEBLLM_READY" }, "*");
    }
    return;
  }
  
  // Handle summarization requests
  if (event.data && event.data.id && event.data.content) {
    console.log("[WEBLLM-RUNNER] Processing summarization request");
    const { content, id } = event.data;

    if (!engine) {
      console.error("[WEBLLM-RUNNER] Engine not available");
      window.parent.postMessage({ id, reply: "Error: WebLLM engine not available." }, "*");
      return;
    }

    const prompt = `Please provide a concise 3-4 sentence summary of this article. Focus on the main topic, key points, and conclusion. Do not use bullet points or lists - write in paragraph form:\n\n${content.slice(0, 3000)}`;
    
    try {
      const completion = await engine.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful assistant that summarizes content." },
          { role: "user", content: prompt },
        ],
      });

      const reply = completion.choices[0].message.content;
      console.log("[WEBLLM-RUNNER] Summary generated:", reply);
      window.parent.postMessage({ id, reply }, "*");
    } catch (err) {
      console.error("[WEBLLM-RUNNER] WebLLM error:", err);
      window.parent.postMessage({ id, reply: "Error running model: " + err.message }, "*");
    }
  }
});

// Start initialization
initializeWebLLM();
