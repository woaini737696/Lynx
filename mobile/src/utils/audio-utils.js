/**
 * 音频工具：webm → wav 转换
 * MiMo ASR 仅支持 mp3/flac/m4a/wav/ogg，需将 MediaRecorder 输出的 webm 转为 16kHz 单声道 WAV
 */

/** 将 webm/opus Blob 转为 16kHz 单声道 16bit PCM WAV Blob */
export async function webmToWav(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const audioContext = new (window.AudioContext || window.webkitAudioContext)({
    sampleRate: 16000,
  });
  const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
  const wavBuffer = audioBufferToWav(audioBuffer);
  audioContext.close();
  return new Blob([wavBuffer], { type: "audio/wav" });
}

/** AudioBuffer → WAV ArrayBuffer（16bit PCM） */
function audioBufferToWav(audioBuffer) {
  const numChannels = 1; // 强制单声道
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // RIFF header
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");

  // fmt chunk
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // 16 bit

  // data chunk
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  // 写入 PCM 采样数据（取第 0 声道）
  const channelData = audioBuffer.getChannelData(0);
  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, str) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}
