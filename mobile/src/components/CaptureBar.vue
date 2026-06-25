<template>
  <view>
    <!-- 悬浮按钮 -->
    <view class="fab" @click="open">
      <Icon name="bolt" :size="48" color="#ffffff" />
    </view>

    <!-- 输入浮层 -->
    <view v-if="visible" class="mask" @click="close">
      <view class="popup" @click.stop>
        <view class="popup-header">
          <text class="popup-title">闪电输入</text>
          <view class="popup-close" @click="close">
            <Icon name="close" :size="32" :color="isDark ? '#f5f5f7' : '#1d1d1f'" />
          </view>
        </view>

        <!-- 图片预览区 -->
        <view v-if="images.length > 0" class="image-preview">
          <view
            v-for="(img, idx) in images"
            :key="idx"
            class="preview-item"
            @click="previewImage(idx)"
          >
            <image :src="img.serverUrl || img.previewUrl" class="preview-img" mode="aspectFill" />
            <view class="preview-del" @click.stop="removeImage(idx)">
              <Icon name="close" :size="22" color="#ffffff" />
            </view>
          </view>
          <view v-if="images.length < 9" class="preview-add" @click="chooseImage">
            <Icon name="plus" :size="36" :color="isDark ? '#98989d' : '#86868b'" />
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
              <Icon name="image" :size="32" :color="isDark ? '#f5f5f7' : '#1d1d1f'" />
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
              <Icon v-if="transcribing" name="clock" :size="32" color="#f59e0b" />
              <Icon v-else-if="recording" name="stop" :size="28" color="#ef4444" />
              <Icon v-else name="mic" :size="32" :color="isDark ? '#f5f5f7' : '#1d1d1f'" />
              <text class="footer-label">{{ voiceLabel }}</text>
            </view>
            <text class="char-count">{{ content.length }}/5000</text>
          </view>
          <view
            class="save-btn"
            :class="{ disabled: saving || (!content.trim() && images.length === 0) }"
            @click="save"
          >
            <Icon name="send" :size="28" color="#ffffff" />
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
import { uploadImageFromPath } from "@/api/upload.js";
import { resolveMediaUrl } from "@/utils/url.js";
import Icon from "@/components/Icon.vue";
import { useSettingsStore } from "@/store/settings.js";

const settingsStore = useSettingsStore();
const isDark = computed(() => settingsStore.theme === "dark");

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
    const data = await uploadImageFromPath(tempPath);
    const serverUrl = resolveMediaUrl(data.url);
    images.value.push({
      previewUrl: tempPath,
      serverUrl,
      url: serverUrl,
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

function previewImage(idx) {
  const urls = images.value.map((img) => img.serverUrl || img.previewUrl || img.url);
  uni.previewImage({
    current: urls[idx],
    urls,
    indicator: "number",
  });
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
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--shadow-fab);
  z-index: 100;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--bg-mask);
  z-index: 9999;
  display: flex;
  align-items: flex-end;
}
.popup {
  width: 100%;
  background-color: var(--bg-card);
  border-radius: var(--radius-xl) var(--radius-xl) 0 0;
  padding: 32rpx;
  padding-bottom: calc(32rpx + env(safe-area-inset-bottom));
  box-sizing: border-box;
  box-shadow: var(--shadow-elevated);
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
  color: var(--text-primary);
}
.popup-close {
  width: 56rpx;
  height: 56rpx;
  border-radius: 50%;
  background-color: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
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
  border-radius: 16rpx;
  overflow: hidden;
  background-color: var(--bg-input);
}
.preview-img {
  width: 100%;
  height: 100%;
}
.preview-del {
  position: absolute;
  top: 6rpx;
  right: 6rpx;
  width: 36rpx;
  height: 36rpx;
  border-radius: 50%;
  background-color: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2rpx 6rpx rgba(0, 0, 0, 0.15);
}
.preview-add {
  width: 160rpx;
  height: 160rpx;
  border-radius: 16rpx;
  background-color: var(--bg-input);
  display: flex;
  align-items: center;
  justify-content: center;
}

.textarea {
  width: 100%;
  height: 240rpx;
  background-color: var(--bg-input);
  border: none;
  border-radius: var(--radius-md);
  padding: 24rpx;
  color: var(--text-primary);
  font-size: 30rpx;
  box-sizing: border-box;
}
.placeholder {
  color: var(--text-tertiary);
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
  gap: 8rpx;
  padding: 12rpx 24rpx;
  border-radius: var(--radius-pill);
  background-color: var(--bg-input);
  user-select: none;
  transition: background-color 0.2s ease;
}
.footer-label {
  font-size: 24rpx;
  font-weight: 500;
  color: var(--text-secondary);
}
.voice-btn.recording {
  background-color: rgba(239, 68, 68, 0.12);
}
.voice-btn.recording .footer-label {
  color: var(--red);
}
.voice-btn.transcribing {
  opacity: 0.6;
}
.char-count {
  color: var(--text-tertiary);
  font-size: 24rpx;
}
.save-btn {
  background: var(--accent-gradient);
  border-radius: var(--radius-pill);
  padding: 0 36rpx;
  height: 72rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  box-shadow: var(--shadow-fab);
  transition: opacity 0.2s ease;
}
.save-btn.disabled {
  opacity: 0.45;
}
.save-btn-text {
  color: #ffffff;
  font-size: 28rpx;
  font-weight: 600;
}
</style>
