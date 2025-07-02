document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle");
  const mode = document.getElementById("mode");

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
