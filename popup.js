document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle");
  const mode = document.getElementById("mode");

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const currentTab = tabs[0];
    const isYouTube = currentTab.url && currentTab.url.includes("youtube.com");

    if (!isYouTube) {
      toggle.disabled = true;
      mode.disabled = true;

      const controlGroups = document.querySelectorAll(".control-group");
      controlGroups.forEach((group) => {
        group.classList.add("disabled");
      });

      const container = document.querySelector(".container");
      const messageDiv = document.createElement("div");
      messageDiv.style.cssText = `
        background: rgba(255, 193, 7, 0.1);
        border: 1px solid rgba(255, 193, 7, 0.3);
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
        color: #ffc107;
        font-size: 12px;
        text-align: center;
      `;
      messageDiv.textContent = "⚠️ This extension only works on Youtube";
      container.insertBefore(messageDiv, container.children[1]);

      return;
    }

    chrome.storage.sync.get(["enabled", "mode"], (data) => {
      toggle.checked = data.enabled || false;
      mode.value = data.mode || "average";
    });

    toggle.addEventListener("change", () => {
      chrome.storage.sync.set({ enabled: toggle.checked }, () => {
        chrome.tabs.reload();
      });
    });

    mode.addEventListener("change", () => {
      chrome.storage.sync.set({ mode: mode.value }, () => {
        chrome.tabs.reload();
      });
    });
  });
});
