<template>
  <view class="md-render">
    <view v-for="(block, idx) in blocks" :key="idx">
      <!-- 代码块 -->
      <view v-if="block.type === 'code'" class="md-code-block">
        <view class="md-code-header">
          <text class="md-code-lang">{{ block.lang || "code" }}</text>
          <text class="md-code-copy" @click="copyCode(block.content)">复制</text>
        </view>
        <text class="md-code-content">{{ block.content }}</text>
      </view>

      <!-- 文本块 -->
      <template v-else>
        <view v-for="(line, lidx) in block.lines" :key="lidx">
          <!-- 标题 -->
          <text v-if="line.type === 'h1'" class="md-h1">{{ line.text }}</text>
          <text v-else-if="line.type === 'h2'" class="md-h2">{{ line.text }}</text>
          <text v-else-if="line.type === 'h3'" class="md-h3">{{ line.text }}</text>
          <text v-else-if="line.type === 'h4'" class="md-h4">{{ line.text }}</text>

          <!-- 引用 -->
          <view v-else-if="line.type === 'quote'" class="md-quote">
            <text class="md-quote-text">{{ line.text }}</text>
          </view>

          <!-- 有序列表 -->
          <view v-else-if="line.type === 'ol'" class="md-ol-item">
            <text class="md-ol-num">{{ line.num }}.</text>
            <view class="md-list-content">
              <text v-for="(seg, sidx) in line.segments" :key="sidx" :class="seg.class">{{ seg.text }}</text>
            </view>
          </view>

          <!-- 无序列表 -->
          <view v-else-if="line.type === 'ul'" class="md-ul-item">
            <text class="md-ul-dot">•</text>
            <view class="md-list-content">
              <text v-for="(seg, sidx) in line.segments" :key="sidx" :class="seg.class">{{ seg.text }}</text>
            </view>
          </view>

          <!-- 段落 -->
          <view v-else-if="line.type === 'p'" class="md-p">
            <text v-for="(seg, sidx) in line.segments" :key="sidx" :class="seg.class">{{ seg.text }}</text>
          </view>

          <!-- 空行 -->
          <view v-else-if="line.type === 'empty'" class="md-empty"></view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  content: { type: String, default: "" },
});

const blocks = computed(() => parseMarkdown(props.content));

function parseMarkdown(text) {
  if (!text) return [];
  const result = [];
  // 先按代码块分割
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // 代码块前的文本
    if (match.index > lastIndex) {
      const textBlock = text.substring(lastIndex, match.index);
      result.push({ type: "text", lines: parseTextBlock(textBlock) });
    }
    // 代码块
    result.push({
      type: "code",
      lang: match[1] || "",
      content: match[2].replace(/\n$/, ""),
    });
    lastIndex = match.index + match[0].length;
  }
  // 末尾文本
  if (lastIndex < text.length) {
    const textBlock = text.substring(lastIndex);
    result.push({ type: "text", lines: parseTextBlock(textBlock) });
  }
  return result;
}

function parseTextBlock(text) {
  const lines = text.split("\n");
  return lines.map((line) => parseLine(line));
}

function parseLine(line) {
  const trimmed = line.trim();

  if (!trimmed) return { type: "empty" };

  // 标题
  if (/^####\s+/.test(trimmed)) return { type: "h4", text: trimmed.replace(/^####\s+/, "") };
  if (/^###\s+/.test(trimmed)) return { type: "h3", text: trimmed.replace(/^###\s+/, "") };
  if (/^##\s+/.test(trimmed)) return { type: "h2", text: trimmed.replace(/^##\s+/, "") };
  if (/^#\s+/.test(trimmed)) return { type: "h1", text: trimmed.replace(/^#\s+/, "") };

  // 引用
  if (/^>\s+/.test(trimmed)) return { type: "quote", text: trimmed.replace(/^>\s+/, "") };

  // 有序列表
  const olMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
  if (olMatch) {
    return { type: "ol", num: olMatch[1], segments: parseInline(olMatch[2]) };
  }

  // 无序列表
  const ulMatch = trimmed.match(/^[-*+]\s+(.*)/);
  if (ulMatch) {
    return { type: "ul", segments: parseInline(ulMatch[1]) };
  }

  // 段落
  return { type: "p", segments: parseInline(trimmed) };
}

/** 解析行内样式：`代码` **加粗** *斜体* [链接](url) */
function parseInline(text) {
  const segments = [];
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.substring(lastIndex, match.index), class: "md-text" });
    }
    const token = match[0];
    if (token.startsWith("`")) {
      segments.push({ text: token.slice(1, -1), class: "md-inline-code" });
    } else if (token.startsWith("**")) {
      segments.push({ text: token.slice(2, -2), class: "md-bold" });
    } else if (token.startsWith("*")) {
      segments.push({ text: token.slice(1, -1), class: "md-italic" });
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (linkMatch) {
        segments.push({ text: linkMatch[1], class: "md-link" });
      }
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.substring(lastIndex), class: "md-text" });
  }
  return segments.length > 0 ? segments : [{ text, class: "md-text" }];
}

function copyCode(code) {
  uni.setClipboardData({
    data: code,
    success: () => uni.showToast({ title: "已复制", icon: "none", duration: 800 }),
  });
}
</script>

<style scoped>
.md-render {
  width: 100%;
}

/* 代码块 */
.md-code-block {
  background-color: #1e1e2e;
  border-radius: 12rpx;
  margin: 16rpx 0;
  overflow: hidden;
}
.md-code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 16rpx;
  background-color: #2a2a3e;
}
.md-code-lang {
  font-size: 20rpx;
  color: #8b8ba7;
}
.md-code-copy {
  font-size: 20rpx;
  color: #89b4fa;
}
.md-code-content {
  display: block;
  padding: 16rpx;
  font-size: 24rpx;
  color: #cdd6f4;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-all;
}

/* 标题 */
.md-h1 { display: block; font-size: 36rpx; font-weight: 700; color: #1d1d1f; margin: 16rpx 0 8rpx; }
.md-h2 { display: block; font-size: 32rpx; font-weight: 700; color: #1d1d1f; margin: 14rpx 0 6rpx; }
.md-h3 { display: block; font-size: 28rpx; font-weight: 600; color: #1d1d1f; margin: 12rpx 0 4rpx; }
.md-h4 { display: block; font-size: 26rpx; font-weight: 600; color: #1d1d1f; margin: 10rpx 0 4rpx; }

/* 引用 */
.md-quote {
  border-left: 6rpx solid #f59e0b;
  padding: 8rpx 16rpx;
  margin: 8rpx 0;
  background-color: rgba(245, 158, 11, 0.06);
}
.md-quote-text {
  font-size: 26rpx;
  color: #6e6e73;
  font-style: italic;
}

/* 列表 */
.md-ol-item, .md-ul-item {
  display: flex;
  align-items: flex-start;
  padding: 4rpx 0;
}
.md-ol-num {
  font-size: 28rpx;
  color: #f59e0b;
  font-weight: 600;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.md-ul-dot {
  font-size: 28rpx;
  color: #f59e0b;
  margin-right: 12rpx;
  flex-shrink: 0;
}
.md-list-content {
  flex: 1;
}

/* 段落 */
.md-p {
  padding: 4rpx 0;
}
.md-text {
  font-size: 28rpx;
  color: #1d1d1f;
  line-height: 1.7;
}
.md-empty {
  height: 8rpx;
}

/* 行内样式 */
.md-inline-code {
  font-size: 24rpx;
  color: #8b5cf6;
  background-color: rgba(139, 92, 246, 0.1);
  padding: 2rpx 8rpx;
  border-radius: 6rpx;
}
.md-bold {
  font-size: 28rpx;
  color: #1d1d1f;
  font-weight: 700;
}
.md-italic {
  font-size: 28rpx;
  color: #1d1d1f;
  font-style: italic;
}
.md-link {
  font-size: 28rpx;
  color: #3b82f6;
  text-decoration: underline;
}
</style>
