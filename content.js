function convertToStereo(audioContext, sourceNode, mode) {
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);

  sourceNode.connect(splitter);

  switch (mode) {
    case "left":
      splitter.connect(merger, 0, 0);
      splitter.connect(merger, 0, 1);
      break;
    case "right":
      splitter.connect(merger, 1, 0);
      splitter.connect(merger, 1, 1);
      break;
    case "average":
      const gainL = audioContext.createGain();
      const gainR = audioContext.createGain();

      gainL.gain.value = 0.5;
      gainR.gain.value = 0.5;

      splitter.connect(gainL, 0);
      splitter.connect(gainR, 1);

      const avgLeft = audioContext.createGain();
      const avgRight = audioContext.createGain();

      gainL.connect(avgLeft);
      gainR.connect(avgLeft);
      gainL.connect(avgRight);
      gainR.connect(avgRight);

      avgLeft.connect(merger, 0, 0);
      avgRight.connect(merger, 0, 1);
      break;
  }

  return merger;
}

let globalAudioContext = null;

function getAudioContext() {
  if (!globalAudioContext || globalAudioContext.state === "closed") {
    globalAudioContext = new (window.AudioContext ||
      window.webkitAudioContext)();
  }
  return globalAudioContext;
}

async function resumeAudioContext(audioCtx) {
  if (audioCtx.state === "suspended") {
    try {
      await audioCtx.resume();
    } catch (error) {
      console.warn("Failed to resume audio context:", error);
    }
  }
}

function patchAudio(mode) {
  const videos = document.querySelectorAll("video, audio");

  videos.forEach(async (video) => {
    if (video._patched) return;

    try {
      if (video.muted || video.volume === 0) return;

      video._patched = true;
      video._originalVolume = video.volume;

      const audioCtx = getAudioContext();

      await resumeAudioContext(audioCtx);

      let source;
      try {
        source = audioCtx.createMediaElementSource(video);
      } catch (error) {
        video._patched = false;
        return;
      }

      const stereoOutput = convertToStereo(audioCtx, source, mode);

      const gainNode = audioCtx.createGain();
      gainNode.gain.value = video.volume;

      stereoOutput.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      const originalVolumeProperty = Object.getOwnPropertyDescriptor(
        HTMLMediaElement.prototype,
        "volume"
      );
      Object.defineProperty(video, "volume", {
        get: function () {
          return originalVolumeProperty.get.call(this);
        },
        set: function (value) {
          originalVolumeProperty.set.call(this, value);
          if (gainNode) {
            gainNode.gain.value = value;
          }
        },
      });

      video._audioContext = audioCtx;
      video._gainNode = gainNode;
      video._stereoOutput = stereoOutput;
    } catch (error) {
      video._patched = false;
    }
  });
}

function handleUserInteraction() {
  if (globalAudioContext && globalAudioContext.state === "suspended") {
    resumeAudioContext(globalAudioContext);
  }
}

document.addEventListener("click", handleUserInteraction, { once: true });
document.addEventListener("keydown", handleUserInteraction, { once: true });
document.addEventListener("touchstart", handleUserInteraction, { once: true });

chrome.storage.sync.get(["enabled", "mode"], (data) => {
  if (data.enabled) {
    const mode = data.mode || "average";

    patchAudio(mode);

    const observer = new MutationObserver((mutations) => {
      let shouldPatch = false;
      mutations.forEach((mutation) => {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === 1) {
              if (
                node.tagName === "VIDEO" ||
                node.tagName === "AUDIO" ||
                node.querySelector("video, audio")
              ) {
                shouldPatch = true;
              }
            }
          });
        }
      });

      if (shouldPatch) {
        clearTimeout(observer._timeout);
        observer._timeout = setTimeout(() => patchAudio(mode), 100);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }
});
