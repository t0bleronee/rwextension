// webllm-loader.js

console.log("[LOADER] Starting WebLLM loader...");

const bundle = document.createElement("script");
bundle.src = "./lib/webllm-bundle.js";
bundle.onload = () => {
  console.log("[LOADER] webllm-bundle loaded");

  const runner = document.createElement("script");
  runner.src = "./webllm-runner.js";
  runner.type = "module";
  document.body.appendChild(runner);
    console.log("[LOADER] webllm-runner loaded and executed");
};

document.head.appendChild(bundle);
console.log("[LOADER] webllm-bundle script tag created");