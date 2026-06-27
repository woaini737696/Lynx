# Lynx 官网设计系统与主题配色方案

> 本文档定义 Lynx 品牌（Web 端 / 官网 / 桌面端 / 安卓端）统一的视觉语言、配色、字体、组件、动效规范，供后续 UI 优化改造使用。

## 1. 品牌定位

- **产品名**：Lynx（猞猁）
- **Slogan**：Lynx AI 工作台，不用学，直接干
- **Logo**：黑底白色猞猁剪影（圆角方形图标）
- **品牌人格**：敏捷、智慧、低调、强大、会进化
- **核心隐喻**：猞猁 — 夜行者、潜伏捕猎、精准一击，对应 AI 助理"自动学习、关键时刻精准出手"的产品哲学

## 2. 设计风格

### 2.1 整体风格
**深空宇宙 × 液态玻璃 × 精准科技感**

- 官网（web_Lynx）：纯深空黑底 + 玻璃拟态卡片 + 流光渐变 + 平滑滚动
- Web 端（app）：支持浅色 / 深色 / 系统自适应，浅色极净白 + 深色深蓝黑
- 桌面端：跟随 Web 端主题系统（next-themes）
- 安卓端：浅色为主（参考豆包 APP），关键卡片支持深色

### 2.2 设计原则
1. **克制留白**：大间距、少装饰、内容优先
2. **玻璃质感**：所有浮层 / 卡片 / 导航栏使用 backdrop-filter 模糊
3. **流光暗示**：主色 + 强调色双向渐变，体现"会进化"
4. **精准动效**：cubic-bezier(0.22, 1, 0.36, 1) 弹性曲线，时长 0.25-0.8s
5. **数据可读**：等宽字体显示数字、统计、Token 用量

## 3. 主题配色方案

### 3.1 主色板（Brand Colors）

| 角色 | 名称 | Hex | HSL | 用途 |
|------|------|-----|-----|------|
| 主色 | 深海宇宙蓝 | `#0F62FE` | `217 99% 53%` | Primary CTA、品牌识别、链接、北极星 |
| 强调色 | 科技青 | `#00B8D4` | `189 100% 42%` | Accent、战役色、流光、AI 能力标识 |
| 成功色 | 翠羽绿 | `#22C55E` | `142 50% 45%` | Task 色、成功状态、在线指示 |
| 警告色 | 琥珀金 | `#F59E0B` | `38 92% 50%` | 警告、Tab 选中、待处理 |
| 危险色 | 朱砂红 | `#DC2626` | `0 72% 51%` | Graveyard、删除、 destructive |
| 认知色 | 墨蓝 | `#1E3A5F` | `222 47% 30%` | Cognition、深度思考 |

### 3.2 背景与文本色

#### 浅色主题（Light）
| 角色 | Hex | HSL | 用途 |
|------|-----|-----|------|
| 背景 | `#FFFFFF` | `0 0% 100%` | 页面底色 |
| 前景 | `#0B1220` | `222 47% 8%` | 主文本 |
| 卡片 | `#FFFFFF` | `0 0% 100%` | 卡片底色 |
| 次级 | `#F5F5F7` | `220 14% 96%` | 次级背景、分隔 |
| 边框 | `#E5E7EB` | `220 13% 91%` | 默认边框 |
| 次要文本 | `#6B7280` | `220 9% 46%` | 辅助说明 |

#### 深色主题（Dark）
| 角色 | Hex | HSL | 用途 |
|------|-----|-----|------|
| 背景 | `#030816` | `220 60% 4%` | 深空黑（官网 / 深色模式） |
| 前景 | `#F0F4F8` | `210 25% 94%` | 主文本 |
| 卡片 | `#0A1428` | `220 50% 7%` | 卡片底色 |
| 次级 | `#1A2333` | `220 35% 13%` | 次级背景 |
| 边框 | `#243044` | `220 30% 18%` | 默认边框 |
| 次要文本 | `#7A8896` | `217 18% 56%` | 辅助说明 |
| 主色（亮） | `#4B7BFF` | `217 99% 62%` | 深色模式下加亮 10% |
| 强调色（亮） | `#22D3EE` | `189 100% 52%` | 深色模式下加亮 10% |

### 3.3 渐变与发光

```css
/* 品牌双向渐变 */
--gradient-brand: linear-gradient(135deg, #0F62FE 0%, #00B8D4 100%);

/* 流光强调 */
--gradient-accent: linear-gradient(135deg, #00B8D4 0%, #0F62FE 100%);

/* 深空背景 */
--gradient-cosmos: radial-gradient(ellipse at top, #0A1428 0%, #030816 70%);

/* 发光（深色模式） */
--glow-primary: 0 0 32px hsl(217 99% 62% / 0.35);
--glow-accent: 0 0 32px hsl(189 100% 52% / 0.35);
```

### 3.4 语义色映射

| 业务概念 | 颜色 | CSS 变量 |
|----------|------|----------|
| 北极星（指标） | 深海宇宙蓝 | `--northstar` |
| 战役（campaign） | 科技青 | `--campaign` |
| 任务（task） | 翠羽绿 | `--task` |
| 灵感墓地 | 朱砂红 | `--graveyard` |
| 认知库 | 墨蓝 | `--cognition` |
| Lynx Agent 节点 | 青绿（#2DD4BF, h:160 s:70 l:45） | `hermes` |

## 4. 字体系统

### 4.1 字体族

```css
/* 主字体（中文优先） */
--font-sans: -apple-system, BlinkMacSystemFont, "PingFang SC",
             "Microsoft YaHei", "Helvetica Neue", "Segoe UI",
             system-ui, sans-serif;

/* 等宽字体（数字、代码、Token） */
--font-mono: "JetBrains Mono", "SF Mono", "Cascadia Code",
             ui-monospace, monospace;
```

### 4.2 字号阶梯

| 名称 | 大小 | 行高 | 字重 | 用途 |
|------|------|------|------|------|
| display | `clamp(32px, 5vw, 64px)` | 1.1 | 700 | 首屏主标题 |
| h1 | `clamp(28px, 4vw, 48px)` | 1.15 | 700 | 页面主标题 |
| h2 | `clamp(24px, 3.5vw, 42px)` | 1.2 | 600 | 区块标题 |
| h3 | `18-20px` | 1.4 | 600 | 卡片标题 |
| body | `15px` | 1.75 | 400 | 正文 |
| body-sm | `13-14px` | 1.6 | 400 | 辅助文本 |
| caption | `11-12px` | 1.5 | 500 | 标签、说明 |
| mono-data | `12-13px` | 1.5 | 500 | 数字、Token、统计 |

### 4.3 字重规范
- 700：display / h1
- 600：h2 / h3 / 按钮
- 500：导航 / 标签 / 数字
- 400：正文

## 5. 间距与圆角

### 5.1 间距系统（4px 基准）
```
4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 80 / 96 / 128
```

### 5.2 圆角
| 名称 | 值 | 用途 |
|------|-----|------|
| sm | `0.5rem` (8px) | 标签、小按钮 |
| md | `0.85rem` (14px) | 默认按钮、输入框 |
| lg | `1.1rem` (18px) | 卡片、Modal |
| xl | `1.5rem` (24px) | 大卡片、容器 |
| 2xl | `2rem` (32px) | 玻璃面板 |
| full | `9999px` | 胶囊按钮、头像 |

## 6. 核心组件规范

### 6.1 液态玻璃卡片（ios-glass）

```css
.ios-glass {
  background:
    linear-gradient(135deg,
      hsl(var(--glass-highlight) / 0.12) 0%,
      hsl(var(--glass-highlight) / 0.04) 50%,
      hsl(var(--glass-highlight) / 0.08) 100%),
    hsl(var(--card) / 0.55);
  backdrop-filter: saturate(200%) blur(24px);
  border: 1px solid hsl(var(--glass-border) / 0.45);
  box-shadow:
    inset 0 1px 1px hsl(var(--glass-highlight) / 0.18),
    inset 0 -1px 1px hsl(0 0% 0% / 0.06),
    0 8px 32px -8px hsl(0 0% 0% / 0.12);
  border-radius: 1.1rem;
  transition: all 0.3s cubic-bezier(0.22, 1, 0.36, 1);
}
.ios-glass:hover {
  transform: translateY(-1px);
  box-shadow: 0 12px 40px -10px hsl(0 0% 0% / 0.18);
}
```

**使用场景**：所有卡片、浮层、Modal、下拉菜单

### 6.2 胶囊按钮（ios-pill）

```css
.ios-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 9999px;
  font-size: 13px;
  font-weight: 500;
  background: hsl(var(--muted) / 0.6);
  border: 1px solid hsl(var(--glass-border) / 0.5);
  backdrop-filter: blur(12px);
  transition: all 0.2s;
}
.ios-pill:hover {
  background: hsl(var(--primary) / 0.1);
  border-color: hsl(var(--primary) / 0.3);
}
```

### 6.3 主按钮（btn-primary）

```css
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
  color: white;
  background: linear-gradient(135deg, #0F62FE 0%, #00B8D4 100%);
  box-shadow: 0 4px 16px hsl(217 99% 53% / 0.3);
  transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
}
.btn-primary:hover {
  transform: translateY(-1px);
  box-shadow: 0 8px 24px hsl(217 99% 53% / 0.45);
}
```

### 6.4 顶部导航栏（glass-bar）

```css
.glass-bar {
  background: hsl(var(--background) / 0.72);
  backdrop-filter: saturate(200%) blur(28px);
  border-bottom: 1px solid hsl(var(--glass-border) / 0.45);
  position: sticky;
  top: 0;
  z-index: 50;
}
```

### 6.5 输入框

```css
.input-glass {
  background: hsl(var(--muted) / 0.5);
  border: 1px solid hsl(var(--glass-border) / 0.5);
  border-radius: 0.85rem;
  padding: 10px 14px;
  font-size: 14px;
  backdrop-filter: blur(12px);
  transition: all 0.2s;
}
.input-glass:focus {
  border-color: hsl(var(--primary));
  box-shadow: 0 0 0 3px hsl(var(--primary) / 0.12);
  outline: none;
}
```

## 7. 动效规范

### 7.1 缓动函数
```css
--ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);   /* 主弹性曲线 */
--ease-in-out-circ: cubic-bezier(0.85, 0, 0.15, 1); /* 进出场 */
```

### 7.2 时长
- 微交互（hover / focus）：0.2-0.25s
- 卡片浮起：0.3s
- 区块入场：0.8s
- 首屏大动画：1.2s

### 7.3 滚动入场动画
- 使用 `IntersectionObserver` 监听元素进入视口
- 阈值 `0.1-0.2`
- 入场效果：`opacity 0→1 + translateY 40px→0`
- 官网使用 Lenis 平滑滚动（`lerp: 0.08`）

### 7.4 流光暗示
- Logo 闪光：`logo-flash-overlay` 伪元素从左到右扫过
- 主按钮：渐变背景在 hover 时微微旋转
- 加载态：`animate-pulse` 骨架屏

## 8. 图标与插画

### 8.1 图标库
- **Lucide React**（按需引入，optimizePackageImports）
- 线条粗细：1.5（默认）/ 2（强调）
- 尺寸阶梯：12 / 14 / 16 / 20 / 24 / 32

### 8.2 Logo 使用
- 黑底白色猞猁：`/lynx-logo-black.png`（圆角方形）
- 尺寸：16/24/32/48/64/128/256/512
- Favicon：`/lynx-icon-256.png`
- 桌面端图标：`desktop/src-tauri/icons/icon.ico`
- 安卓端图标：`mipmap-*` 全套

## 9. 阴影系统

```css
--shadow-soft: 0 2px 15px -3px hsl(var(--foreground) / 0.07),
               0 4px 6px -4px hsl(var(--foreground) / 0.05);

--shadow-card: 0 8px 32px -8px hsl(0 0% 0% / 0.12);

--shadow-hover: 0 12px 40px -10px hsl(0 0% 0% / 0.18);

--shadow-glow-primary: 0 0 32px hsl(217 99% 53% / 0.35);
--shadow-glow-accent: 0 0 32px hsl(189 100% 42% / 0.35);
```

## 10. 响应式断点

| 断点 | 宽度 | 设备 |
|------|------|------|
| sm | ≥640px | 大手机横屏 |
| md | ≥768px | 平板 |
| lg | ≥1024px | 桌面 |
| xl | ≥1280px | 大屏 |

- 移动端优先：`base` 样式针对手机，`md:` 以上增强
- 官网最大宽度：`max-w-[1280px]`
- 卡片网格：移动端 1 列，md 2 列，lg 3-4 列

## 11. 三端适配策略

| 维度 | Web 端 | 桌面端 | 安卓端 |
|------|--------|--------|--------|
| 主题 | 浅 / 深 / 系统 | 浅 / 深 / 系统 | 浅色为主 |
| 窗口 | 全屏响应式 | 1280×800 居中 | 全屏移动端 |
| 字号 | clamp 响应式 | clamp 响应式 | 固定 px（rpx） |
| 玻璃 | ✅ backdrop-filter | ✅ WebView2 支持 | ⚠️ 降级为半透明 |
| 滚动 | Lenis 平滑 | 原生 | 原生 + 下拉刷新 |
| 动效 | 全量 framer-motion | 全量 | 轻量 CSS 动画 |

## 12. 设计 Token 速查

```css
:root {
  /* 主色 */
  --primary: 217 99% 53%;       /* #0F62FE */
  --accent: 189 100% 42%;       /* #00B8D4 */

  /* 语义 */
  --northstar: 217 99% 53%;
  --campaign: 189 100% 42%;
  --task: 142 50% 45%;
  --graveyard: 0 72% 51%;
  --cognition: 222 47% 30%;
  --hermes: 160 70% 45%;        /* Lynx Agent 节点色 */

  /* 圆角 */
  --radius: 0.85rem;

  /* 缓动 */
  --ease-out-expo: cubic-bezier(0.22, 1, 0.36, 1);
}
```

## 13. 落地建议（UI 优化改造）

### 13.1 优先级 P0
1. 全局统一 `--primary` / `--accent` 为 `#0F62FE` / `#00B8D4`，移除残留的旧色值
2. 所有卡片统一使用 `ios-glass` 类，移除自定义阴影
3. 顶部导航栏统一 `glass-bar` 样式
4. 按钮统一三种：`btn-primary` / `ios-pill` / `ios-glass-sm`
5. 字体统一加入 `"PingFang SC"` 中文优先

### 13.2 优先级 P1
1. 所有数字 / Token 统计使用 `font-mono`
2. 列表项统一 framer-motion 入场动画
3. 操作反馈统一 Toast 样式（顶部居中，玻璃质感）
4. 空状态统一 `EmptyState` 组件

### 13.3 优先级 P2
1. 深色模式下增加发光效果（`--glow-primary`）
2. Logo 区域加入闪光动画
3. 首屏加入流光渐变背景
4. 卡片 hover 加入 3D 倾斜（`transform: perspective`）

---

> 本文档为 Lynx 全端视觉契约，任何 UI 改动需遵循此规范。新增组件需在此文档登记。
