<template>
  <view>
    <!-- 悬浮按钮 -->
    <view class="fab" @click="open">
      <text class="fab-icon">⚡</text>
    </view>

    <!-- 输入浮层 -->
    <view v-if="visible" class="mask" @click="close">
      <view class="popup" @click.stop>
        <view class="popup-header">
          <text class="popup-title">闪电输入</text>
          <view class="popup-close" @click="close">
            <text class="close-icon">×</text>
          </view>
        </view>

        <!-- 图片预览区 -->
        <view v-if="images.length > 0" class="image-preview">
          <view v-for="(img, idx) in images" :key="idx" class="preview-item">
            <image :src="img.url" class="preview-img" mode="aspectFill" />
            <view class="preview-del" @click="removeImage(idx)">
              <text class="del-icon">×</text>
            </view>
          </view>
          <view v-if="images.length < 9" class="preview-add" @click="chooseImage">
            <text class="add-icon">+</text>
          </view>
        </view>

        <textarea
          v-model="content"
          class="textarea"
          placeholder="3 秒录入灵感，零分类..."
          placeholder-class="placeholder"
          :auto-focus="true"
          :cursor-spacing="20"
          :adjust-position="true"
          :maxlength="5000"
        />
        <view class="popup-footer">
          <view class="footer-left">
            <view class="footer-btn" @click="chooseImage">
              <text class="footer-icon">🖼</text>
              <text class="footer-label">图片</text>
            </view>
            <view
              class="footer-btn voice-btn"
              :class="{ recording: recording, transcribing: transcribing }"
              @touchstart.prevent="startRecording"
              @touchend.prevent="stopRecording"
              @mousedown.prevent="startRecording"
              @mouseup.prevent="stopRecording"
              @mouseleave="stopRecordingIfActive"
            >
              <text v-if="transcribing" class="footer-icon">⏳</text>
              <text v-else-if="recording" class="footer-icon recording-icon">●</text>
              <text v-else class="footer-icon">🎤</text>
              <text class="footer-label">{{ voiceLabel }}</text>
            </view>
            <text class="char-count">{{ content.length }}/5000</text>
          </view>
          <view
            class="save-btn"
            :class="{ disabled: saving || (!content.trim() && images.length === 0) }"
            @click="save"
          >
            <text class="save-btn-text">{{ saving ? "保存中..." : "保存" }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref, computed, onUnmounted } from "vue";
import { createIdea } from "@/api/ideas.js";
import { transcribeAudio } from "@/api/voice.js";
import { webmToWav } from "@/utils/audio-utils.js";
import { getBaseUrl, getToken } from "@/api/request.js";

const visible = ref(false);
const content = ref("");
const saving = ref(false);
const images = ref([]); // [{ url, name, size }]

// 语音录入
const recording = ref(false);
const transcribing = ref(false);
let mediaRecorder = null;
let audioChunks = [];

const voiceLabel = computed(() => {
  if (transcribing.value) return "识别中";
  if (recording.value) return "松开";
  return "语音";
});

const emit = defineEmits(["saved"]);

function open() {
  content.value = "";
  images.value = [];
  visible.value = true;
}

function close() {
  if (recording.value) {
    try {
      mediaRecorder?.stop();
    } catch {
      // ignore
    }
    recording.value = false;
  }
  visible.value = false;
  content.value = "";
  images.value = [];
}

// ===== 图片选择 =====
function chooseImage() {
  if (images.value.length >= 9) {
    uni.showToast({ title: "最多 9 张图片", icon: "none" });
    return;
  }
  uni.chooseImage({
    count: 9 - images.value.length,
    sizeType: ["compressed"],
    sourceType: ["album", "camera"],
    success: async (res) => {
      for (const tempPath of res.tempFilePaths) {
        await uploadImage(tempPath);
      }
    },
  });
}

async function uploadImage(tempPath) {
  uni.showLoading({ title: "上传中..." });
  try {
    const baseUrl = getBaseUrl();
    const token = getToken();
    const formData = new FormData();
    // H5 模式下 uni.chooseImage 返回的是 blob URL，用 fetch 获取 blob
    const blob = await fetch(tempPath).then((r) => r.blob());
    formData.append("file", blob, `image-${Date.now()}.jpg`);

    const resp = await fetch(`${baseUrl}/api/upload`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `上传失败 (${resp.status})`);
    }

    const data = await resp.json();
    images.value.push({
      url: baseUrl + data.url,
      name: data.name,
      size: data.size,
    });
  } catch (e) {
    uni.showToast({ title: e.message || "图片上传失败", icon: "none" });
  } finally {
    uni.hideLoading();
  }
}

function removeImage(idx) {
  images.value.splice(idx, 1);
}

async function save() {
  const hasContent = content.value.trim();
  const hasImages = images.value.length > 0;
  if ((!hasContent && !hasImages) || saving.value) return;
  saving.value = true;
  try {
    const attachments = images.value.map((img) => ({
      type: "image",
      name: img.name,
      url: img.url.replace(getBaseUrl(), ""),
    }));
    await createIdea(content.value.trim() || "(图片灵感)", "lightning", "inbox", attachments);
    uni.showToast({ title: "已捕获", icon: "success" });
    emit("saved");
    close();
  } catch (e) {
    uni.showToast({ title: e.message || "保存失败", icon: "none" });
  } finally {
    saving.value = false;
  }
}

// ===== 语音录入 =====
async function startRecording() {
  if (recording.value || transcribing.value) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks = [];
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };
    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      if (audioChunks.length === 0) return;
      await transcribeChunks();
    };
    mediaRecorder.start();
    recording.value = true;
  } catch (e) {
    uni.showToast({ title: "无法访问麦克风", icon: "none" });
  }
}

function stopRecording() {
  if (!recording.value) return;
  try {
    mediaRecorder?.stop();
  } catch {
    // ignore
  }
  recording.value = false;
}

function stopRecordingIfActive() {
  if (recording.value) stopRecording();
}

async function transcribeChunks() {
  transcribing.value = true;
  try {
    const blob = new Blob(audioChunks, { type: "audio/webm" });
    const wavBlob = await webmToWav(blob);
    const res = await transcribeAudio(wavBlob);
    const text = (res.text || "").trim();
    if (text) {
      content.value = content.value ? `${content.value} ${text}` : text;
      uni.showToast({ title: "已识别", icon: "success", duration: 800 });
    } else {
      uni.showToast({ title: "未识别到内容", icon: "none" });
    }
  } catch (e) {
    uni.showToast({ title: e.message || "语音识别失败", icon: "none" });
  } finally {
    transcribing.value = false;
    audioChunks = [];
  }
}

onUnmounted(() => {
  if (recording.value) {
    try {
      mediaRecorder?.stop();
    } catch {
      // ignore
    }
  }
});
</script>

<style scoped>
.fab {
  position: fixed;
  right: 40rpx;
  bottom: calc(180rpx + env(safe-area-inset-bottom));
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background: linear-gradient(135deg, #f59e0b, #f97316);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(245, 158, 11, 0.35);
  z-index: 100;
}
.fab-icon {
  font-size: 48rpx;
}

.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}
.popup {
  width: 100%;
  background-color: #ffffff;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
}
.popup-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}
.popup-title {
  font-size: 32rpx;
  font-weight: 600;
  color: #1d1d1f;
}
.popup-close {
  padding: 8rpx 16rpx;
}
.close-icon {
  font-size: 48rpx;
  color: #86868b;
}

/* 图片预览 */
.image-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 16rpx;
  margin-bottom: 20rpx;
}
.preview-item {
  position: relative;
  width: 160rpx;
  height: 160rpx;
  border-radius: 12rpx;
  overflow: hidden;
}
.preview-img {
  width: 100%;
  height: 100%;
}
.preview-del {
  position: absolute;
  top: 4rpx;
  right: 4rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-del .del-icon {
  color: #ffffff;
  font-size: 24rpx;
  line-height: 1;
}
.preview-add {
  width: 160rpx;
  height: 160rpx;
  border: 2rpx dashed #d1d1d6;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.preview-add .add-icon {
  font-size: 48rpx;
  color: #c7c7cc;
}

.textarea {
  width: 100%;
  height: 240rpx;
  background-color: #f2f2f7;
  border: none;
  border-radius: 16rpx;
  padding: 24rpx;
  color: #1d1d1f;
  font-size: 30rpx;
  box-sizing: border-box;
}
.placeholder {
  color: #aeaeb2;
}
.popup-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
}
.footer-left {
  display: flex;
  align-items: center;
  gap: 16rpx;
}
.footer-btn {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 10rpx 20rpx;
  border-radius: 32rpx;
  background-color: rgba(59, 130, 246, 0.1);
  user-select: none;
}
.footer-icon {
  font-size: 28rpx;
}
.footer-label {
  font-size: 22rpx;
  color: #3b82f6;
}
.voice-btn.recording {
  background-color: rgba(239, 68, 68, 0.15);
}
.voice-btn.transcribing {
  opacity: 0.6;
}
.recording-icon {
  color: #ef4444;
  animation: pulse 1s infinite;
}
.voice-btn.recording .footer-label {
  color: #ef4444;
}
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
.char-count {
  color: #aeaeb2;
  font-size: 24rpx;
}
.save-btn {
  background: linear-gradient(135deg, #f59e0b, #f97316);
  border-radius: 12rpx;
  padding: 0 40rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4rpx 12rpx rgba(245, 158, 11, 0.2);
}
.save-btn.disabled {
  opacity: 0.4;
}
.save-btn-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}
</style>
