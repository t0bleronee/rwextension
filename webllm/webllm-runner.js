console.log("[WEBLLM-RUNNER] Starting WebLLM runner...");
(async () => {
  console.log("[WEBLLM-RUNNER] Checking for webllm...");
  if (!window.webllm) {
    console.error("[WEBLLM-RUNNER] webllm not available!");
    return;
  }
  console.log("[WEBLLM-RUNNER] webllm found, initializing...");
  const engine = new window.webllm.MLCEngine();
  console.log("[WEBLLM-RUNNER] Engine initialized:", engine);
  await engine.reload("TinyLlama-1.1B-Chat-v0.4-q4f16_1-MLC", {
    temperature: 0.7,
    top_p: 0.95,
  });
  console.log("[WEBLLM-RUNNER] Model reloaded successfully");
// Notify parent that WebLLM is ready
console.log("[WEBLLM-RUNNER] Notifying parent that WebLLM is ready");
window.parent.postMessage({ type: "WEBLLM_READY" }, "*");

  window.addEventListener("message", async (event) => {
    console.log("[WEBLLM-RUNNER] TEST - Any message received:", event.data);
  console.log("[WEBLLM-RUNNER] TEST - Event origin:", event.origin);
  console.log("[WEBLLM-RUNNER] TEST - Event source:", event.source);
  
  if (!event.data || !event.data.id || !event.data.content) {
    console.log("[WEBLLM-RUNNER] TEST - Message missing required fields");
    return;
  }
    console.log("[WEBLLM-RUNNER] Received message from parent:", event.data);
    const { content, id } = event.data;

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
      window.parent.postMessage({ id, reply: "Error running model." }, "*");
    }
  });
})();
