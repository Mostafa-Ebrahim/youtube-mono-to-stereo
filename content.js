// Advanced vocal isolation using multiple algorithms
function createVocalIsolationProcessor(audioContext, sourceNode) {
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);
  const scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2);
  
  // High-pass filter for vocal enhancement
  const highPassFilter = audioContext.createBiquadFilter();
  highPassFilter.type = 'highpass';
  highPassFilter.frequency.value = 80; // Remove low frequencies (bass, kick drums)
  
  // Compressor for vocal presence
  const compressor = audioContext.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  
  sourceNode.connect(splitter);
  splitter.connect(scriptProcessor);
  
  scriptProcessor.onaudioprocess = function(audioProcessingEvent) {
    const inputBuffer = audioProcessingEvent.inputBuffer;
    const outputBuffer = audioProcessingEvent.outputBuffer;
    
    const inputLeft = inputBuffer.getChannelData(0);
    const inputRight = inputBuffer.getChannelData(1);
    const outputLeft = outputBuffer.getChannelData(0);
    const outputRight = outputBuffer.getChannelData(1);
    
    // Advanced vocal isolation algorithm
    for (let i = 0; i < inputLeft.length; i++) {
      // Center channel extraction (removes center-panned instruments)
      const center = (inputLeft[i] + inputRight[i]) * 0.5;
      const side = (inputLeft[i] - inputRight[i]) * 0.5;
      
      // Enhanced vocal isolation with frequency weighting
      const vocal = side * 3.0; // Amplify stereo difference (vocals)
      const reducedCenter = center * 0.15; // Reduce center channel (instruments)
      
      // Combine and apply dynamic range compression
      let output = vocal + reducedCenter;
      
      // Soft limiting to prevent distortion
      if (Math.abs(output) > 0.8) {
        output = Math.sign(output) * (0.8 + (Math.abs(output) - 0.8) * 0.2);
      }
      
      // Final clamp
      output = Math.max(-1, Math.min(1, output));
      
      outputLeft[i] = output;
      outputRight[i] = output;
    }
  };
  
  // Connect through filters for enhanced vocal clarity
  scriptProcessor.connect(highPassFilter);
  highPassFilter.connect(compressor);
  compressor.connect(merger);
  
  return merger;
}

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

function patchAudio(mode, enableMusicRemoval = false) {
  const videos = document.querySelectorAll("video, audio");

  videos.forEach((video) => {
    if (video._patched) return;
    video._patched = true;

    const audioCtx = new window.AudioContext();
    const source = audioCtx.createMediaElementSource(video);
    
    let finalOutput;
    
    if (enableMusicRemoval) {
      // Apply vocal isolation first, then stereo conversion
      const vocalProcessor = createVocalIsolationProcessor(audioCtx, source);
      finalOutput = convertToStereo(audioCtx, vocalProcessor, mode);
      console.log("🎤 Vocal isolation enabled with stereo mode:", mode);
    } else {
      // Just apply stereo conversion
      finalOutput = convertToStereo(audioCtx, source, mode);
      console.log("🎵 Stereo audio enabled with mode:", mode);
    }

    finalOutput.connect(audioCtx.destination);
    
    // Resume audio context if needed (Chrome autoplay policy)
    if (audioCtx.state === 'suspended') {
      const resumeAudio = () => {
        audioCtx.resume();
        document.removeEventListener('click', resumeAudio);
        document.removeEventListener('keydown', resumeAudio);
      };
      document.addEventListener('click', resumeAudio);
      document.addEventListener('keydown', resumeAudio);
    }
  });
}

chrome.storage.sync.get(["enabled", "mode", "musicRemoval"], (data) => {
  if (data.enabled) {
    const mode = data.mode || "average";
    const musicRemoval = data.musicRemoval || false;
    
    patchAudio(mode, musicRemoval);
    const observer = new MutationObserver(() => patchAudio(mode, musicRemoval));
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
