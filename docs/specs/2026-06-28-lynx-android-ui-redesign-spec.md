# Lynx Android UI 重构设计规范 v3

> 本文档是 Lynx Android App（Kotlin + Jetpack Compose）iOS 26 液态玻璃风格重构的权威设计规范。所有 Android 端 UI 开发必须遵循本规范，确保视觉、交互、动效与最新视觉稿 `lynx-android-ui-preview-v3.html` 保持一致。

## 1. 设计定位

- **风格**：iOS 26 液态玻璃（Liquid Glass）+ 深邃星空蓝 + 极简人性
- **核心隐喻**：猞猁（Lynx）—— 夜行、精准、智慧、低调强大
- **设计原则**：
  1. **极简**：无卡通图标，全部使用 iOS 26 风格细线图标
  2. **即时反馈**：每个可交互元素都有 0.15s 按压态
  3. **点击优先**：手势作为增强，任何滑动操作都有明确点击入口
  4. **通透层次**：玻璃模糊、高光边缘、药丸圆角贯穿全局

## 2. 色彩系统

| 角色 | 变量名 | Hex | 用途 |
|------|--------|-----|------|
| 深邃背景 | `--void` | `#02040c` | 页面底色 |
| 次级背景 | `--deep` | `#070b18` | 浮层、卡片底层 |
| 品牌蓝 | `--primary` | `#4B9FFF` | 主按钮、选中态、强调 |
| 品牌深蓝 | `--primary-deep` | `#2563EB` | 渐变终点、阴影 |
| Agent 青 | `--agent` | `#30D6B5` | 在线状态、成功、Agent 标识 |
| Think 琥珀 | `--think` | `#FFC857` | 警告、待处理、记忆标签 |
| Danger 红 | `--danger` | `#FF5A5A` | 挂断、删除、退出 |
| 主文本 | `--text` | `#F6F8FF` | 标题、正文 |
| 辅助文本 | `--muted` | `#8A93A8` | 时间、描述、提示 |
| 玻璃高光 | `--liquid-highlight` | `rgba(255,255,255,0.35)` | 玻璃上边缘高光 |
| 玻璃边框 | `--liquid-border` | `rgba(255,255,255,0.22)` | 玻璃卡片边框 |
| 玻璃表层 | `--liquid-2` | `rgba(255,255,255,0.08)` | 玻璃卡片背景 |
| 玻璃底层 | `--liquid-3` | `rgba(255,255,255,0.04)` | 较弱玻璃背景 |

### 2.1 渐变规范

- 主按钮渐变：`linear-gradient(135deg, #4B9FFF, #2563EB)`
- 呼吸球渐变：
  ```
  radial-gradient(circle at 30% 25%, rgba(255,255,255,0.25), transparent 45%),
  radial-gradient(circle at 50% 50%, rgba(75,159,255,0.35), rgba(37,99,235,0.12) 55%, transparent 70%),
  linear-gradient(135deg, rgba(75,159,255,0.4), rgba(48,214,181,0.15))
  ```
- 页面背景渐变：深空蓝径向渐变 + 品牌青/蓝散点光晕

## 3. 字体与字号

- **字体族**：`-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif`
- **Android 对应**：`FontFamily.Default` + 系统字体回退

| 层级 | 字号 | 字重 | 用途 |
|------|------|------|------|
| 页面大标题 | 20sp | 700 | 设置、任务、记忆页标题 |
| 问候语 | 17sp | 700 | 首页「早上好，Lynn」 |
| 列表标题 | 14sp | 600 | 任务标题、记忆标题 |
| 正文 | 13.5sp | 400 | 气泡文字、时间流摘要 |
| 辅助说明 | 12sp | 400 | 元信息、标签 |
| 小标签 | 11sp | 500 | 状态 pill、分类标签 |
| Dock 标签 | 9sp | 500 | 底部导航文字 |

## 4. 间距与圆角

### 4.1 间距系统（dp）

`4 / 8 / 10 / 12 / 14 / 16 / 18 / 20 / 22 / 24 / 28 / 32 / 36 / 42 / 52 / 60 / 66`

### 4.2 圆角规范

| 名称 | 值 | 用途 |
|------|-----|------|
| 小圆角 | 12dp | 设置行图标、小标签 |
| 中圆角 | 18dp | 玻璃小卡片、输入框 |
| 大圆角 | 24dp | 玻璃卡片、面板 |
| 药丸 | 999dp | Dock、Tab、按钮、状态 pill |
| 圆形 | 50% | 头像、呼吸球、FAB、挂断按钮 |
| 侧滑面板 | 28dp 左上/左下 | 设置面板左侧圆角 |

## 5. 玻璃材质规范

所有卡片、浮层、面板统一使用以下玻璃材质：

```kotlin
// Compose 伪代码
.background(
    color = Color.White.copy(alpha = 0.08f),
    shape = RoundedCornerShape(24.dp)
)
.border(
    width = 1.dp,
    color = Color.White.copy(alpha = 0.22f),
    shape = RoundedCornerShape(24.dp)
)
// 顶部高光通过渐变叠加实现
```

**玻璃小卡片（glass-sm）**：`rgba(255,255,255,0.04)` 背景 + `rgba(255,255,255,0.10)` 边框 + 18dp 圆角

## 6. 图标规范

- **风格**：iOS 26 细线风格，stroke-only，无填充，无卡通
- **统一属性**：
  - 默认尺寸：24dp
  - 描边粗细：1.6dp（小图标 1.5dp，大图标 1.3dp）
  - 线帽/连接：round
  - 颜色：跟随 `currentColor`，默认 `--text`（浅色）
- **禁止**：emoji、多色卡通 SVG、黑色图标在深色背景上
- **Dock 四个核心图标**：
  - 首页：home outline
  - Lynx 助理：message-circle outline
  - 任务：edit-3 / check outline
  - 记忆：layers outline

## 7. 动效规范

| 场景 | 时长 | 缓动曲线 | 说明 |
|------|------|----------|------|
| 页面切换 | 350ms | `cubic-bezier(0.22, 1, 0.36, 1)` | 水平/垂直滑入 |
| 按钮按压 | 150ms | ease | scale 0.97 |
| 卡片浮起 | 300ms | `cubic-bezier(0.22, 1, 0.36, 1)` | translateY(-2dp) |
| 呼吸球呼吸 | 4000ms | ease-in-out | scale 1 → 1.05 |
| 通话波纹 | 2400ms | ease-out | scale 0.75 → 1.65，opacity 0.7 → 0 |
| Toast | 300ms | ease | fade + translateY |
| Dock 显示/隐藏 | 350ms | `cubic-bezier(0.22, 1, 0.36, 1)` | translateY + opacity |
| 设置侧滑 | 400ms | `cubic-bezier(0.22, 1, 0.36, 1)` | translateX(110%) → 0 |
| 气泡进入 | 350ms | `cubic-bezier(0.22, 1, 0.36, 1)` | fadeInUp |

## 8. 页面架构

### 8.1 四核心页面 + 设置侧滑面板

```
┌─────────────────────────────────────┐
│  首页    Lynx 助理    任务    记忆   │  ← 底部 Dock 切换
│              ↑ 也可左右滑动切换      │
└─────────────────────────────────────┘
```

- **首页**：呼吸球 + 时间流 + 右下角灵感 FAB + 右上角头像
- **Lynx 助理**：聊天列表 + 底部输入栏（文本 + 语音）
- **任务**：顶部药丸 Tab + 任务列表
- **记忆**：搜索栏 + 分类标签 + 记忆卡片
- **设置**：右侧 88% 宽度侧滑面板（非全屏），所有核心页面右上角头像点击进入

### 8.2 子页面/浮层

| 页面 | 进入方式 | 返回方式 | Dock |
|------|----------|----------|------|
| 灵感速记 | 首页右下角 FAB / 上滑 | 下滑 / 返回按钮 | 隐藏 |
| 全双工通话 | 点击呼吸球 | 挂断按钮 | 隐藏 |
| 设置面板 | 点击头像 | 返回按钮 / 点击遮罩 / 右滑 | 隐藏 |

## 9. 各页面详细规范

### 9.1 首页 Home

- **顶部**：左侧「早上好，Lynn」（根据时间动态），右侧用户头像（进入设置）
- **Agent 状态**：胶囊 pill「Lynx Agent 在线」，带呼吸绿点
- **中央呼吸球**：
  - 尺寸：140dp × 140dp
  - 中央：纯白猞猁 logo，68dp
  - 动画：4s 呼吸缩放 + 外圈 orb 漂浮
  - 点击：进入全双工通话
- **时间流**：
  - 顶部 18dp 渐变消融，与呼吸球柔和过渡
  - 卡片为玻璃材质，左滑不触发页面切换
  - 内部滚动独立，不触发页面切换
- **右下角 FAB**：灵感速记入口，距底 132dp，52dp 圆形，主色渐变

### 9.2 Lynx 助理 Assistant

- **顶部**：左侧标题「Lynx Agent」，右侧在线状态 pill + 用户头像
- **聊天区**：
  - 用户气泡：品牌蓝渐变，右下角小圆角
  - Agent 气泡：玻璃材质，左下角小圆角
  - 进入动画：fadeInUp
- **输入栏**：
  - 位置：距底 106dp，避免 Dock 遮挡
  - 左侧语音按钮，右侧发送按钮
  - 药丸形玻璃背景

### 9.3 任务 Tasks

- **顶部**：左侧标题「任务」，右侧用户头像
- **Tab**：药丸形分段器「进行中 / 已完成」
- **列表项**：左侧勾选圆圈 + 标题/元信息 + 右侧优先级光点
- **无返回按钮**（核心页面）

### 9.4 记忆 Memory

- **顶部**：左侧标题「记忆」，右侧用户头像
- **搜索栏**：玻璃材质，左侧搜索图标
- **分类标签**：横向滚动，药丸形，选中态品牌蓝
- **卡片**：玻璃材质，标题 + 摘要 + 分类/时间元信息
- **无返回按钮**（核心页面）

### 9.5 设置面板 Settings

- **形态**：右侧 88% 宽度侧滑面板，非全屏
- **左侧圆角**：28dp
- **遮罩**：半透明深色 + 轻微模糊
- **顶部**：返回按钮 + 标题「设置」
- **用户卡片**：大头像 + 用户名/角色
- **分组列表**：玻璃行，分组标题大写小字

### 9.6 灵感速记 IdeaPanel

- **形态**：从底部进入的浮层（视觉上覆盖全屏）
- **顶部**：返回按钮 + 标题
- **内容**：大输入框 + 胶囊分类标签 + 渐变保存按钮
- **交互**：支持下滑返回，无文字提示

### 9.7 全双工通话 CallScreen

- **中央**：三层液态波纹 + 头像
- **状态**：「Lynx 正在聆听」+ 计时器
- **控制**：仅两个按钮
  - 打断：方形图标，玻璃按钮
  - 挂断：电话图标，红色渐变

## 10. 交互与手势

### 10.1 底部 Dock

- 始终出现在四个核心页面底部
- 点击切换页面
- 选中态：品牌蓝 + 浅蓝背景高亮
- 子页面自动隐藏（带滑出动画）

### 10.2 核心页面左右滑动切换

- 触发区域：整个页面内容区（排除横向滚动子视图）
- 阈值：水平滑动 ≥ 60dp
- 方向：
  - 左滑：下一页（首页 → 助理 → 任务 → 记忆）
  - 右滑：上一页
- 边界：首页最左、记忆最右不可继续滑动

### 10.3 灵感速记下滑返回

- 触发：在灵感速记页面内向下滑动 ≥ 80dp
- 动作：返回首页

### 10.4 时间流滚动冲突

- 时间流列表区域内，上下滑动仅滚动列表
- 列表区域外，上下滑动不进入子页面
- 通过判断手势起始 Y 坐标是否在列表区域内实现

## 11. Android Compose 实现要点

### 11.1 必备依赖

- Material3
- Navigation Compose
- Compose Animation
- Accompanist（如需要系统 UI 控制）

### 11.2 文件映射

| 设计稿页面 | Android 文件 |
|------------|--------------|
| 首页 | `ui/screen/home/HomeScreen.kt` |
| Lynx 助理 | `ui/screen/assistant/AssistantScreen.kt` |
| 任务 | `ui/screen/tasks/TasksScreen.kt` |
| 记忆 | `ui/screen/memory/MemoryScreen.kt` |
| 设置面板 | `ui/screen/settings/SettingsPanel.kt` |
| 灵感速记 | `ui/screen/idea/IdeaPanel.kt` |
| 通话 | `ui/screen/call/CallScreen.kt` |
| Dock | `ui/navigation/BottomTab.kt` |
| 玻璃卡片 | `ui/component/GlassCard.kt` |
| 动效 | `ui/theme/Motion.kt` |

### 11.3 关键实现提示

1. **玻璃效果**：使用 `Modifier.background(Color.White.copy(alpha = 0.08f))` + `border` + 顶部 `drawBehind` 绘制高光
2. **呼吸球动画**：`rememberInfiniteTransition` + `animateFloat` 控制 `scale`
3. **Dock 显隐**：在 `NavHost` 外层根据当前路由控制 `AnimatedVisibility`
4. **侧滑设置**：使用 `AnimatedVisibility` + `slideInHorizontally` 从右侧进入，宽度 88%
5. **左右滑动切换**：在核心页面外层包裹 `pointerInput` 检测水平拖动
6. **列表滚动冲突**：通过 `onGloballyPositioned` 记录列表区域 Y 范围，手势起始点落在范围内则禁用页面滑动

## 12. 设计资产

| 资产 | 路径 | 说明 |
|------|------|------|
| 最新视觉稿 | `docs/design-assets/lynx-android-ui-preview-v3.html` | 浏览器可预览，永久保存 |
| 纯白猞猁 logo | `docs/design-assets/lynx-logo-white.png` | 透明背景，用于呼吸球 |
| 黑底猞猁 logo | `public/lynx-logo-black.png` | 原始 logo |

## 13. 版本记录

| 版本 | 日期 | 变更 |
|------|------|------|
| v3 | 2026-06-28 | 确定四核心页面架构、iOS 26 液态玻璃风格、Dock 导航、侧滑设置 |
