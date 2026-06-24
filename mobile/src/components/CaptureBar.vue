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
          <text class="char-count">{{ content.length }}/5000</text>
          <view
            class="save-btn"
            :class="{ disabled: saving || !content.trim() }"
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
  background-color: rgba(0, 0, 0, 0.4);
  z-index: 200;
  display: flex;
  align-items: flex-end;
}
.popup {
  width: 100%;
  background-color: #ffffff;
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
  color: #1d1d1f;
}
.popup-close {
  padding: 8rpx 16rpx;
}
.close-icon {
  font-size: 48rpx;
  color: #86868b;
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
