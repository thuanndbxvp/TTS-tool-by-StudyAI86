
const SAMPLE_RATE = 24000;
const BITS_PER_SAMPLE = 16;
const NUM_CHANNELS = 1;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / 8;

// Decodes a base64 string into a Uint8Array.
export function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Converts an ArrayBuffer (e.g. from MP3 fetch) to PCM Uint8Array using Web Audio API
// Supports speed adjustment via playbackRate
export async function decodeAudioDataToPcm(audioData: ArrayBuffer, speed: number = 1.0): Promise<Uint8Array> {
  // We use an OfflineAudioContext to decode and resample to our target SAMPLE_RATE (24000)
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass({ sampleRate: SAMPLE_RATE });
  
  // Decode the original audio data
  const audioBuffer = await audioCtx.decodeAudioData(audioData);

  // Calculate new duration based on speed
  // Speed > 1 means shorter duration, Speed < 1 means longer duration
  const newDuration = audioBuffer.duration / speed;

  const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, Math.ceil(newDuration * SAMPLE_RATE), SAMPLE_RATE);
  const source = offlineCtx.createBufferSource();
  source.buffer = audioBuffer;
  source.playbackRate.value = speed;
  source.connect(offlineCtx.destination);
  source.start();

  const renderedBuffer = await offlineCtx.startRendering();
  const channelData = renderedBuffer.getChannelData(0); // Mono
  
  // Convert Float32 to Int16 PCM
  const pcmData = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    // Clamp values to [-1, 1]
    const s = Math.max(-1, Math.min(1, channelData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }

  return new Uint8Array(pcmData.buffer);
}

// Process raw PCM data to change its speed
export async function changePcmSpeed(pcmData: Uint8Array, speed: number): Promise<Uint8Array> {
    if (speed === 1.0) return pcmData;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const tempCtx = new AudioContextClass({ sampleRate: SAMPLE_RATE });
    
    // Convert Int16 PCM to Float32 for Web Audio API
    const int16 = new Int16Array(pcmData.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / 32768.0;
    }

    // Create a temporary AudioBuffer
    const audioBuffer = tempCtx.createBuffer(NUM_CHANNELS, float32.length, SAMPLE_RATE);
    audioBuffer.copyToChannel(float32, 0);

    // Render with new speed
    const newDuration = audioBuffer.duration / speed;
    // Ensure minimum length to avoid errors
    const targetLength = Math.max(1, Math.ceil(newDuration * SAMPLE_RATE));
    
    const offlineCtx = new OfflineAudioContext(NUM_CHANNELS, targetLength, SAMPLE_RATE);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = speed;
    source.connect(offlineCtx.destination);
    source.start();

    const renderedBuffer = await offlineCtx.startRendering();
    const renderedData = renderedBuffer.getChannelData(0);

    // Convert back to Int16 PCM
    const resultInt16 = new Int16Array(renderedData.length);
    for (let i = 0; i < renderedData.length; i++) {
        const s = Math.max(-1, Math.min(1, renderedData[i]));
        resultInt16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    
    // Close the temp context if possible (though AudioContext implies GC usually)
    if (tempCtx.state !== 'closed') void tempCtx.close();

    return new Uint8Array(resultInt16.buffer);
}

// Creates a WAV file Blob from raw PCM data (16-bit, 24kHz, mono).
export function createWavBlob(pcmData: Uint8Array): Blob {
  const byteRate = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;
  const blockAlign = NUM_CHANNELS * BYTES_PER_SAMPLE;
  const dataSize = pcmData.length;
  const fileSize = 36 + dataSize;

  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, 'RIFF');
  view.setUint32(4, fileSize, true);
  writeString(view, 8, 'WAVE');

  // fmt sub-chunk
  writeString(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // Sub-chunk size
  view.setUint16(20, 1, true); // Audio format (1 for PCM)
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data sub-chunk
  writeString(view, 36, 'data');
  view.setUint32(40, dataSize, true);

  return new Blob([view, pcmData], { type: 'audio/wav' });
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}

// Creates a silent PCM data buffer for a given duration in seconds.
export function createSilence(durationSeconds: number): Uint8Array {
  if (durationSeconds <= 0) {
    return new Uint8Array(0);
  }
  const numberOfSamples = Math.round(durationSeconds * SAMPLE_RATE);
  const buffer = new ArrayBuffer(numberOfSamples * BYTES_PER_SAMPLE);
  // The buffer is initialized to zeros, which represents silence for PCM data.
  return new Uint8Array(buffer);
}

// Concatenates multiple Uint8Array PCM buffers into one.
export function concatenatePcm(buffers: Uint8Array[]): Uint8Array {
  const totalLength = buffers.reduce((acc, val) => acc + val.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const buffer of buffers) {
    result.set(buffer, offset);
    offset += buffer.length;
  }
  return result;
}

// Calculates the duration of a PCM data buffer in seconds.
export function getPcmDuration(pcmData: Uint8Array): number {
    const bytesPerSecond = SAMPLE_RATE * NUM_CHANNELS * BYTES_PER_SAMPLE;
    if (bytesPerSecond === 0) return 0;
    return pcmData.length / bytesPerSecond;
}
