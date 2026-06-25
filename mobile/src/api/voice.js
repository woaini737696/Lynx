import { get, put, post, del } from "./request.js";

/**
 * 语音识别（ASR）
 * 后端契约：POST /api/ai/asr multipart/form-data，字段 file
 * 返回 { text: "识别结果" }
 */
export async function transcribeAudio(blob) {
  const { getBaseUrl, getToken } = await import("./request.js");
  const form = new FormData();
  form.append("file", blob, "audio.wav");
  const res = await fetch(`${getBaseUrl()}/api/ai/asr`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `ASR 失败 (${res.status})`);
  }
  const data = await res.json();
  return data.text || "";
}

/**
 * 非流式 TTS
 * 后端契约：POST /api/ai/tts { text, voice? }
 * 返回 Blob（audio/wav）
 */
export async function synthesizeTTS(text, voice) {
  const { getBaseUrl, getToken } = await import("./request.js");
  const res = await fetch(`${getBaseUrl()}/api/ai/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`TTS 失败 (${res.status})`);
  return await res.blob();
}

/**
 * 流式 TTS（SSE 逐句合成）
 * 后端契约：POST /api/ai/tts/stream { text, voice? }
 * 返回 { onSentence: (text, audioBlob) => void, done: Promise<void> }
 */
export async function streamTTS(text, voice, onSentence) {
  const { getBaseUrl, getToken } = await import("./request.js");
  const res = await fetch(`${getBaseUrl()}/api/ai/tts/stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ text, voice }),
  });
  if (!res.ok) throw new Error(`流式 TTS 失败 (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";
    for (const line of lines) {
      if (line.startsWith("data: ")) {
        try {
          const evt = JSON.parse(line.slice(6));
          if (evt.type === "sentence" && evt.audioBase64) {
            const audioBlob = base64ToBlob(evt.audioBase64, "audio/wav");
            await onSentence(evt.text, audioBlob, evt.index);
          } else if (evt.type === "done") {
            return;
          } else if (evt.type === "error") {
            throw new Error(evt.message || "TTS 流式响应异常");
          }
        } catch (e) {
          // 忽略解析错误
        }
      }
    }
  }
}

/** base64 转 Blob */
function base64ToBlob(base64, mime) {
  const bytes = atob(base64);
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    arr[i] = bytes.charCodeAt(i);
  }
  return new Blob([arr], { type: mime });
}

/**
 * 获取 AI 设置（含语音配置）
 * 后端契约：GET /api/ai/settings
 */
export function getAISettings() {
  return get("/api/ai/settings");
}

/**
 * 更新 AI 设置
 * 后端契约：PUT /api/ai/settings { ...fields }
 */
export function updateAISettings(data) {
  return put("/api/ai/settings", data);
}

/**
 * 上传音色复刻
 * 后端契约：POST /api/ai/voice-clone multipart/form-data，字段 file + name
 */
export async function cloneVoice(blob, name) {
  const { getBaseUrl, getToken } = await import("./request.js");
  const form = new FormData();
  form.append("file", blob, "voice.wav");
  form.append("name", name || "我的音色");
  const res = await fetch(`${getBaseUrl()}/api/ai/voice-clone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: form,
  });
  if (!res.ok) throw new Error(`音色复刻失败 (${res.status})`);
  return await res.json();
}

/** 删除复刻音色 */
export async function deleteClonedVoice() {
  const { getBaseUrl, getToken } = await import("./request.js");
  const res = await fetch(`${getBaseUrl()}/api/ai/voice-clone`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`删除音色失败 (${res.status})`);
  return await res.json();
}
