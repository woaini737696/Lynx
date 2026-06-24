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
          <text class="popup-close" @click="close">×</text>
        </view>
        <textarea
          v-model="content"
          class="textarea"
          placeholder="3 秒录入灵感，零分类..."
          placeholder-class="placeholder"
          :auto-focus="true"
          :maxlength="5000"
        />
        <view class="popup-footer">
          <text class="char-count">{{ content.length }}/5000</text>
          <button class="save-btn" :disabled="saving || !content.trim()" @click="save">
            {{ saving ? "保存中..." : "保存 (Enter)" }}
          </button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup>
import { ref } from "vue";
import { createIdea } from "@/api/ideas.js";

const visible = ref(false);
const content = ref("");
const saving = ref(false);

const emit = defineEmits(["saved"]);

function open() {
  content.value = "";
  visible.value = true;
}

function close() {
  visible.value = false;
  content.value = "";
}

async function save() {
  if (!content.value.trim() || saving.value) return;
  saving.value = true;
  try {
    await createIdea(content.value.trim());
    uni.showToast({ title: "已捕获", icon: "success" });
    emit("saved");
    close();
  } catch (e) {
    uni.showToast({ title: e.message || "保存失败", icon: "none" });
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.fab {
  position: fixed;
  right: 40rpx;
  bottom: 180rpx;
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background-color: #f6ad55;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(246, 173, 85, 0.4);
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
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.popup {
  width: 100%;
  background-color: #171717;
  border-radius: 32rpx 32rpx 0 0;
  padding: 32rpx;
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
  color: #f6ad55;
}
.popup-close {
  font-size: 48rpx;
  color: #737373;
  padding: 0 16rpx;
}
.textarea {
  width: 100%;
  height: 240rpx;
  background-color: #0a0a0a;
  border: 1rpx solid #262626;
  border-radius: 16rpx;
  padding: 24rpx;
  color: #f5f5f5;
  font-size: 30rpx;
  box-sizing: border-box;
}
.placeholder {
  color: #525252;
}
.popup-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 24rpx;
}
.char-count {
  color: #525252;
  font-size: 24rpx;
}
.save-btn {
  background-color: #f6ad55;
  color: #0a0a0a;
  font-size: 28rpx;
  font-weight: 600;
  border-radius: 12rpx;
  padding: 0 40rpx;
  height: 72rpx;
  line-height: 72rpx;
  border: none;
}
.save-btn[disabled] {
  opacity: 0.4;
}
</style>
