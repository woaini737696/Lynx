# Tasks

## 任务 1：悬浮抽屉改为极简聊天组件
- [ ] Task 1.1：新建 `src/components/ai/AssistantChat.tsx`，极简聊天组件：
  - 消息列表（user/assistant 气泡，支持流式响应光标）
  - 输入框 + 发送按钮
  - 调用 `/api/ai/chat` 流式接口
  - 多轮对话上下文（维护 messages state）
  - 加载状态、错误处理
  - 不含技能面板/设置/全双工语音
- [ ] Task 1.2：修改 `src/components/ai/AssistantDrawer.tsx`，删除 iframe 逻辑，改用 `<AssistantChat />`
- [ ] Task 1.3：修改 `src/components/ai/AssistantGlobalEntry.tsx`：
  - 桌面端也支持点击空白处收回（添加全屏点击层，但 pointer-events 仅在 open 时生效，且不遮挡主内容操作——用透明背景层）
  - 动画 duration 从 300ms 改为 200ms
- [ ] Task 1.4：修改 `src/components/ai/AssistantDrawer.tsx` 动画 duration 为 200ms
- [ ] Task 1.5：验证：点击悬浮按钮快速弹出极简聊天、点击空白收回、Alt+J 唤出/收起、可正常对话

## 任务 2：未登录弹窗引导
- [ ] Task 2.1：修改 `src/components/ai/AssistantGlobalEntry.tsx`，新增未登录检测：
  - 调用 `/api/auth/session` 检查登录状态（或用 useSession hook）
  - 未登录时点击悬浮按钮 → 弹窗"登录已过期，请重新登录" + "去登录"按钮
  - "去登录"按钮跳转 `/login`（或 NextAuth signIn）
  - 不打开聊天抽屉
- [ ] Task 2.2：验证：未登录点击悬浮按钮弹窗引导，登录后正常打开聊天

## 任务 3：顶部 header 栏 + 用户菜单
- [ ] Task 3.1：`prisma/schema.prisma` User 模型新增 `profession String? @db.VarChar(100)` 和 `avatarUrl String? @db.VarChar(500)`，运行 `npx prisma db push`
- [ ] Task 3.2：新建 `src/components/layout/UserMenu.tsx`：
  - 用 useSession 获取当前用户
  - 显示头像（avatarUrl 或默认首字母）+ 昵称（displayName）
  - hover 显示下拉菜单：个人资料设置、退出登录
  - 退出登录调用 signOut 跳转登录页
- [ ] Task 3.3：新建 `src/app/settings/profile/page.tsx` 个人资料设置页：
  - 头像 URL 输入（或上传）
  - 昵称、姓名（username 只读）、职业输入
  - 角色显示（admin/editor/viewer，只读）
  - 保存按钮 PUT 到 `/api/user/profile`
- [ ] Task 3.4：新建 `src/app/api/user/profile/route.ts`：
  - GET 返回当前用户 profile（displayName/username/profession/avatarUrl/role）
  - PUT 更新 displayName/profession/avatarUrl（不允许改 username/role）
- [ ] Task 3.5：修改 `src/components/layout/AppShell.tsx`，新增顶部 header 栏（h-14 border-b）：
  - 左侧：logo + 当前页面标题（用 usePathname 映射）
  - 右侧：`<UserMenu />`
  - Sidebar 和 main 区域调整为 `flex-1 overflow-hidden`
- [ ] Task 3.6：修改 `src/auth.ts` session callback，将 displayName/avatarUrl/profession 注入 session.user
- [ ] Task 3.7：验证：header 栏显示、用户菜单 hover 出现、个人资料设置保存、退出登录跳转

## 任务 4：技能岗位分类
- [ ] Task 4.1：修改 `src/app/skills/page.tsx` CATEGORIES：
  - 替换为 12 岗位分类：产品经理(pm)/设计师(designer)/前端工程师(frontend)/后端工程师(backend)/数据分析师(data)/运营(operations)/市场(marketing)/HR(hr)/财务(finance)/项目经理(project)/内容创作者(creator)/创业者(founder) + hermes + custom
  - 更新 CATEGORY_BADGE / CATEGORY_LABEL / SOURCE_LABEL
- [ ] Task 4.2：修改 `src/app/skills/market/page.tsx` 同步岗位分类
- [ ] Task 4.3：修改 `src/app/api/skills/route.ts`，category 过滤支持新岗位 key
- [ ] Task 4.4：新建/扩展 `prisma/seed-skills.ts`，为 12 个岗位各预置 3-5 个代表性技能（如产品经理：PRD撰写/需求评审/竞品分析；设计师：设计规范/组件库/Figma交付；前端：组件开发/性能优化/单元测试等）
- [ ] Task 4.5：运行 seed 脚本写入预置技能
- [ ] Task 4.6：验证：技能管理/市场显示 12 岗位分类、点击分类显示对应技能

## 任务 5：AI 助理一句话生成飞书任务
- [ ] Task 5.1：`src/lib/lark-sync.ts` 暴露 `createLarkTask(params)` 函数：调用 `lark-cli task +create --summary --assignees --due` 创建飞书任务，返回任务 guid 和 url
- [ ] Task 5.2：`src/lib/ai-assistant-tools.ts` 新增 `createLarkTask` 工具定义：
  - 参数：summary(标题)/assignees(负责人，姓名数组)/due(截止时间，ISO)/description(描述，可选)
  - 返回：任务卡片数据（title/assignees/due/url）供前端渲染预览
  - 工具不直接创建，仅返回解析后的任务数据
- [ ] Task 5.3：`src/app/api/lark-tasks/create/route.ts`（新建）POST 接口：
  - 接收 summary/assignees/due/description
  - 调用 lark-sync createLarkTask 创建飞书任务
  - 返回任务 guid+url
- [ ] Task 5.4：修改 `src/app/ai/assistant/page.tsx` 和 `src/components/ai/AssistantChat.tsx`：
  - AI 工具调用返回 `createLarkTask` 类型时，渲染飞书任务卡片（标题/负责人/截止时间/"下发到飞书"按钮）
  - 点击"下发到飞书" → POST `/api/lark-tasks/create` → 返回链接 → 卡片更新为"已下发"+任务链接
- [ ] Task 5.5：验证：AI 助理输入"给张三下发任务：本周五前完成需求文档评审" → 显示任务卡片 → 点击下发 → 返回飞书链接

## 任务 6：自测与规范落地
- [ ] Task 6.1：`npx tsc --noEmit` 编译通过
- [ ] Task 6.2：手动验证悬浮抽屉极简聊天、未登录弹窗、header 用户菜单、技能岗位分类、飞书任务下发
- [ ] Task 6.3：更新 `DEV_LOG.md` 新增迭代31
- [ ] Task 6.4：`git add` + `commit` + `push origin master`

# Task Dependencies
- Task 1（极简聊天）和 Task 2（未登录检测）可并行，都改 AssistantGlobalEntry
- Task 3.1（User schema）是 Task 3.3-3.4 的前置
- Task 4.1-4.3（分类改 key）可并行，Task 4.4（seed）依赖分类 key 确定
- Task 5.1（lark-sync）是 Task 5.3（API）前置，Task 5.2（工具）是 Task 5.4（渲染）前置
- Task 6 依赖 Task 1-5 完成
