// WAV 编码器 - 纯 TypeScript，三端通用
// 从 src/lib/audio-utils.ts 的 encodeWav + writeString 抽离
// 将 PCM Int16 数据编码为 WAV 文件 ArrayBuffer

/**
 * 将 PCM Int16 数据编码为 WAV 格式 ArrayBuffer
 * @param samples Float32Array 音频样本（-1.0 ~ 1.0）
 * @param sampleRate 采样率（如 16000、44100）
 * @returns WAV 格式的 ArrayBuffer
 */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // WAV 文件头
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true);  // block align
  view.setUint16(34, 16, true); // bits per sample
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  // PCM 数据（Float32 → Int16）
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

/** 向 DataView 写入 ASCII 字符串 */
function writeString(view: DataView, offset: number, str: string): void {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

/**
 * 将两个 Int16 PCM 帧合并（用于音频拼接）
 */
export function concatInt16Pcm(chunks: Int16Array[]): Int16Array {
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Int16Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}

/**
 * 将 Float32 样本转换为 Int16 PCM
 */
export function float32ToInt16(samples: Float32Array): Int16Array {
  const result = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    result[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return result;
}
