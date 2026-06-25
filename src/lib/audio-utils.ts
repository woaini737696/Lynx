// 音频格式工具：将浏览器 MediaRecorder 输出的 webm/opus 转为 MiMo ASR 支持的 WAV
// MiMo ASR 仅支持 mp3/flac/m4a/wav/ogg，不支持 webm

/**
 * 将 webm/opus Blob 转换为 WAV 格式（单声道 16bit PCM）
 * 使用 AudioBuffer 的实际采样率编码 WAV，避免强制重采样导致的失真
 * @param blob 浏览器 MediaRecorder 录制的音频 Blob（通常为 audio/webm;codecs=opus）
 * @returns WAV 格式的 Blob
 */
export async function webmToWav(blob: Blob): Promise<Blob> {
  const arrayBuffer = await blob.arrayBuffer();
  // 不强制 sampleRate，让浏览器用原生采样率解码（避免部分浏览器忽略 sampleRate 选项导致错位）
  const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const sampleRate = audioBuffer.sampleRate;
  // 取单声道
  const channelData = audioBuffer.getChannelData(0);
  // 转为 16bit PCM
  const length = channelData.length;
  const pcmData = new Int16Array(length);
  for (let i = 0; i < length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    pcmData[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  // 构建 WAV 文件（使用实际采样率）
  const wavBuffer = encodeWav(pcmData, sampleRate);
  audioContext.close();
  return new Blob([wavBuffer], { type: "audio/wav" });
}

function encodeWav(samples: Int16Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    view.setInt16(44 + i * 2, samples[i], true);
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
