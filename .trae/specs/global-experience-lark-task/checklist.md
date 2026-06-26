# Checklist

## 任务 1：悬浮抽屉极简聊天
- [ ] `AssistantChat.tsx` 新建，仅含消息列表+输入框+发送+流式响应
- [ ] `AssistantDrawer.tsx` 删除 iframe，改用 `<AssistantChat />`
- [ ] 桌面端点击空白处收回（透明点击层）
- [ ] 动画 duration 200ms（丝滑）
- [ ] 验证：快速弹出/收回、可正常对话、无 iframe 加载延迟

## 任务 2：未登录弹窗引导
- [ ] `AssistantGlobalEntry.tsx` 新增未登录检测（/api/auth/session 或 useSession）
- [ ] 未登录点击悬浮按钮 → 弹窗"登录已过期"+"去登录"按钮
- [ ] "去登录"跳转登录页，不打开聊天抽屉
- [ ] 验证：未登录弹窗引导、登录后正常

## 任务 3：顶部 header + 用户菜单
- [ ] User 表新增 `profession` / `avatarUrl` 字段，prisma db push 成功
- [ ] `UserMenu.tsx` 新建，显示头像+昵称，hover 下拉菜单
- [ ] `settings/profile/page.tsx` 新建，可设置头像/昵称/职业，显示角色（只读）
- [ ] `/api/user/profile` GET/POST 实现持久化
- [ ] `AppShell.tsx` 新增顶部 header 栏（h-14），含 logo+标题+UserMenu
- [ ] `auth.ts` session 注入 displayName/avatarUrl/profession
- [ ] 退出登录跳转登录页
- [ ] 验证：header 显示、菜单 hover、资料保存、退出跳转

## 任务 4：技能岗位分类
- [ ] `skills/page.tsx` CATEGORIES 改为 12 岗位分类 + hermes + custom
- [ ] `skills/market/page.tsx` 同步岗位分类
- [ ] `/api/skills` category 过滤支持新 key
- [ ] seed 脚本预置 12 岗位代表性技能（每类 3-5 个）
- [ ] 验证：技能管理/市场显示 12 岗位分类、点击显示对应技能

## 任务 5：AI 一句话生成飞书任务
- [ ] `lark-sync.ts` 暴露 `createLarkTask(params)` 函数
- [ ] `ai-assistant-tools.ts` 新增 `createLarkTask` 工具（返回任务卡片数据）
- [ ] `/api/lark-tasks/create` POST 接口实现
- [ ] AI 助理页面渲染飞书任务卡片（标题/负责人/截止/下发按钮）
- [ ] 点击"下发到飞书"创建任务并返回链接
- [ ] 验证：一句话生成任务卡片、确认下发、返回飞书链接

## 任务 6：自测与规范落地
- [ ] `npx tsc --noEmit` 编译通过
- [ ] 手动验证 5 大任务核心场景
- [ ] `DEV_LOG.md` 新增迭代31
- [ ] `git commit` + `push origin master` 成功
- [ ] `git log origin/master..HEAD` 为空
