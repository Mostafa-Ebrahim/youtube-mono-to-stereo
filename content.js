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

function patchAudio(mode) {
  const videos = document.querySelectorAll("video, audio");

  videos.forEach((video) => {
    if (video._patched) return;
    video._patched = true;

    const audioCtx = new window.AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    const stereoOutput = convertToStereo(audioCtx, source, mode);

    stereoOutput.connect(audioCtx.destination);
    console.log("Stereo audio enabled with mode:", mode);
  });
}

chrome.storage.sync.get(["enabled", "mode"], (data) => {
  if (data.enabled) {
    const mode = data.mode || "average";
    patchAudio(mode);
    const observer = new MutationObserver(() => patchAudio(mode));
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
