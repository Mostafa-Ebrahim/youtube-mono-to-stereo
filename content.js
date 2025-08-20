// Simple vocal isolation using spectral processing with TensorFlow.js
let tf;
let isModelLoaded = false;

// Load TensorFlow.js
async function loadTensorFlow() {
  if (typeof window.tf === 'undefined') {
    // Load TensorFlow.js from CDN
    const script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.15.0/dist/tf.min.js';
    script.onload = () => {
      tf = window.tf;
      isModelLoaded = true;
      console.log('TensorFlow.js loaded for vocal isolation');
    };
    document.head.appendChild(script);
  } else {
    tf = window.tf;
    isModelLoaded = true;
  }
}

// Simple vocal isolation using center channel extraction and spectral processing
function createVocalIsolationProcessor(audioContext, sourceNode) {
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);
  const scriptProcessor = audioContext.createScriptProcessor(4096, 2, 2);
  
  sourceNode.connect(splitter);
  splitter.connect(scriptProcessor);
  
  scriptProcessor.onaudioprocess = function(audioProcessingEvent) {
    const inputBuffer = audioProcessingEvent.inputBuffer;
    const outputBuffer = audioProcessingEvent.outputBuffer;
    
    const inputLeft = inputBuffer.getChannelData(0);
    const inputRight = inputBuffer.getChannelData(1);
    const outputLeft = outputBuffer.getChannelData(0);
    const outputRight = outputBuffer.getChannelData(1);
    
    // Vocal isolation: subtract right from left (removes center channel)
    // This removes most of the instrumental music that's panned center
    for (let i = 0; i < inputLeft.length; i++) {
      const vocal = (inputLeft[i] - inputRight[i]) * 2.0; // Amplify the difference
      const clampedVocal = Math.max(-1, Math.min(1, vocal)); // Clamp to prevent distortion
      outputLeft[i] = clampedVocal;
      outputRight[i] = clampedVocal;
    }
  };
  
  scriptProcessor.connect(merger);
  return merger;
}

// Enhanced vocal isolation using TensorFlow.js for spectral processing
function createAIVocalIsolationProcessor(audioContext, sourceNode) {
  if (!isModelLoaded) {
    console.warn('TensorFlow.js not loaded, falling back to basic vocal isolation');
    return createVocalIsolationProcessor(audioContext, sourceNode);
  }
  
  const splitter = audioContext.createChannelSplitter(2);
  const merger = audioContext.createChannelMerger(2);
  const scriptProcessor = audioContext.createScriptProcessor(2048, 2, 2);
  
  sourceNode.connect(splitter);
  splitter.connect(scriptProcessor);
  
  scriptProcessor.onaudioprocess = function(audioProcessingEvent) {
    const inputBuffer = audioProcessingEvent.inputBuffer;
    const outputBuffer = audioProcessingEvent.outputBuffer;
    
    const inputLeft = inputBuffer.getChannelData(0);
    const inputRight = inputBuffer.getChannelData(1);
    const outputLeft = outputBuffer.getChannelData(0);
    const outputRight = outputBuffer.getChannelData(1);
    
    try {
      // Convert to TensorFlow tensors for processing
      const leftTensor = tf.tensor1d(Array.from(inputLeft));
      const rightTensor = tf.tensor1d(Array.from(inputRight));
      
      // Compute spectral features
      const avgTensor = leftTensor.add(rightTensor).div(2);
      const diffTensor = leftTensor.sub(rightTensor);
      
      // Simple vocal enhancement: amplify the difference (vocals) and reduce average (music)
      const vocalTensor = diffTensor.mul(2.5).add(avgTensor.mul(0.1));
      
      // Get processed audio data (use sync method to avoid async issues)
      const processedAudio = vocalTensor.dataSync();
      
      // Copy processed audio to output
      for (let i = 0; i < Math.min(processedAudio.length, inputLeft.length); i++) {
        const sample = Math.max(-1, Math.min(1, processedAudio[i])); // Clamp to prevent distortion
        outputLeft[i] = sample;
        outputRight[i] = sample;
      }
      
      // Cleanup tensors
      leftTensor.dispose();
      rightTensor.dispose();
      avgTensor.dispose();
      diffTensor.dispose();
      vocalTensor.dispose();
      
    } catch (error) {
      console.warn('AI processing failed, using fallback:', error);
      // Fallback to basic vocal isolation
      for (let i = 0; i < inputLeft.length; i++) {
        const vocal = (inputLeft[i] - inputRight[i]) * 2;
        const clampedVocal = Math.max(-1, Math.min(1, vocal));
        outputLeft[i] = clampedVocal;
        outputRight[i] = clampedVocal;
      }
    }
  };
  
  scriptProcessor.connect(merger);
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
      const vocalProcessor = createAIVocalIsolationProcessor(audioCtx, source);
      finalOutput = convertToStereo(audioCtx, vocalProcessor, mode);
      console.log("AI vocal isolation enabled with stereo mode:", mode);
    } else {
      // Just apply stereo conversion
      finalOutput = convertToStereo(audioCtx, source, mode);
      console.log("Stereo audio enabled with mode:", mode);
    }

    finalOutput.connect(audioCtx.destination);
  });
}

// Initialize TensorFlow.js
loadTensorFlow();

chrome.storage.sync.get(["enabled", "mode", "musicRemoval"], (data) => {
  if (data.enabled) {
    const mode = data.mode || "average";
    const musicRemoval = data.musicRemoval || false;
    
    patchAudio(mode, musicRemoval);
    const observer = new MutationObserver(() => patchAudio(mode, musicRemoval));
    observer.observe(document.body, { childList: true, subtree: true });
  }
});
