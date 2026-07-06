# QA 测试流程规范

> **适用范围**：所有迭代开发、bug 修复、新功能开发
> **强制级别**：必须执行。未通过测试的代码不允许交付验收

---

## 1. 测试金字塔

```
        /\
       /E2E\        ← 5 个核心流程（auth/idea/board/search/backup），20+ 用例
      /------\
     /  集成  \      ← API 路由层（后续迭代补全）
    /----------\
   /   单元测试   \    ← src/lib/__tests__/，9 个文件 92+ 用例
  /--------------\
```

## 2. 测试框架

| 层级 | 框架 | 配置文件 | 命令 |
|------|------|----------|------|
| 单元测试 | Vitest 4.x | `vitest.config.ts` | `npm run test` |
| 单元+覆盖率 | Vitest + v8 | 同上 | `npm run test:coverage` |
| E2E 测试 | Playwright 1.61 | `playwright.config.ts` | `npm run test:e2e` |
| E2E UI 模式 | Playwright | 同上 | `npm run test:e2e:ui` |
| Lint | ESLint + next lint | `.eslintrc.json` | `npm run lint` |

## 3. CI 自动化测试流程

### 3.1 触发条件
- PR 到 `main` 分支
- Push 到 `main` 分支
- 手动触发 (`workflow_dispatch`)

### 3.2 执行流程（`.github/workflows/ci-test.yml`）

```
1. lint-and-unit job
   ├── npm ci
   ├── npx prisma generate
   ├── npm run lint            ← ESLint 静态检查
   └── npm run test:coverage   ← Vitest 单元测试 + 覆盖率
       └── 阈值：statements/branches/functions/lines ≥ 30%

2. e2e-test job (依赖 lint-and-unit 通过)
   ├── npm ci
   ├── npx prisma generate
   ├── npx playwright install --with-deps chromium
   ├── npx prisma db push      ← SQLite 测试库
   └── npm run test:e2e        ← Playwright E2E
       └── CI 中失败自动重试 2 次
       └── 失败时上传 trace + 截图 + 视频到 Artifact
```

### 3.3 产物归档
- `coverage-report`：覆盖率 HTML 报告（保留 14 天）
- `playwright-report`：E2E HTML 报告（保留 14 天）
- `playwright-traces`：失败时的 trace 文件（保留 7 天）

## 4. 单元测试规范

### 4.1 文件位置
```
src/lib/__tests__/<module-name>.test.ts
```

### 4.2 已覆盖模块（9 个）

| 模块 | 测试文件 | 用例数 | 关键覆盖点 |
|------|---------|--------|-----------|
| crypto | `crypto.test.ts` | 10 | 加解密、IV 随机性、密文篡改、空值 |
| jwt | `jwt.test.ts` | 9 | 签发/校验、签名篡改、过期、不同 secret |
| permissions | `permissions.test.ts` | 22 | 12 职业、75 权限、3 默认角色、admin-only |
| rate-limit | `rate-limit.test.ts` | 12 | 滑动窗口、key 隔离、窗口过期、IP 提取 |
| auth-utils | `auth-utils.test.ts` | 5 | buildUserFilter 数据隔离 |
| ai-provider | `ai-provider.test.ts` | 12 | 多模态识别、默认 Provider |
| semantic-match | `semantic-match.test.ts` | 7 | TF-IDF 降级、阈值匹配 |
| flow-engine | `flow-engine.test.ts` | 6 | BFS 图遍历、条件分支、菱形汇聚 |
| flow-store | `flow-store.test.ts` | 9 | 时间格式化边界值 |

### 4.3 覆盖率阈值

`vitest.config.ts` 配置：
```ts
thresholds: {
  statements: 30,  // 起步门槛，后续迭代逐步提升到 60%+
  branches: 30,
  functions: 30,
  lines: 30,
}
```

**未达阈值的 CI 构建会失败**，禁止合并。

### 4.4 命名约定
- describe 块：模块名或函数名（如 `crypto encrypt/decrypt`）
- it 用例：中文描述行为（如 `加密后应以 enc: 前缀开头`）
- 测试数据：使用固定 key（如 `test-allow-1`），避免跨用例污染

### 4.5 新增测试规则
- 新增 `src/lib/` 下的工具函数：**必须**同步新增单元测试
- 修改安全相关模块（crypto/jwt/permissions/rate-limit）：**必须**更新对应测试
- 修复 bug：**必须**新增回归测试覆盖该 bug 场景

## 5. E2E 测试规范

### 5.1 测试文件位置
```
e2e/<feature>-flow.spec.ts
```

### 5.2 已覆盖流程（5 个）

| 流程 | 文件 | 关键路径 |
|------|------|---------|
| 认证 | `auth-flow.spec.ts` | 登录、登出、CSRF |
| 灵感 | `idea-flow.spec.ts` | 创建、编辑、删除、转看板 |
| 看板 | `board-flow.spec.ts` | 拖拽、状态流转 |
| 搜索 | `search-flow.spec.ts` | 全局搜索、语义匹配 |
| 备份 | `backup-flow.spec.ts` | 导出、校验、导入 |

### 5.3 运行环境
- **本地**：复用已运行的 `npm run dev`（端口 5176）
- **CI**：Playwright 自动启动 dev server，不复用，保证隔离
- **浏览器**：chromium（CI 通过 `npx playwright install --with-deps chromium` 安装）
- **本地 Edge**：通过 `channel: "msedge"` 复用系统 Edge，避免下载 Chromium

### 5.4 测试数据管理
- **登录态**：`e2e/global-setup.ts` 登录一次，保存到 `.auth/storage-state.json`，所有 spec 复用
- **测试数据**：内容前缀统一为 `E2E`，`e2e/helpers/auth.ts` 的 `cleanupTestData()` 自动清理
- **数据库兜底**：`scripts/cleanup-e2e-data.ts` 做数据库层清理（针对 Cognition 等无 DELETE API 的模块）
- **测试密码**：从 `TEST_ADMIN_PASSWORD` 环境变量读取（CI 中配置在 workflow env）

### 5.5 失败诊断
CI 中 E2E 失败时：
1. 下载 `playwright-traces` artifact
2. 运行 `npx playwright show-trace <trace.zip>` 查看逐步执行
3. 失败截图和视频也在 artifact 中

## 6. 本地测试工作流

### 6.1 开发中快速验证
```bash
# 单元测试（不输出覆盖率，最快）
npm run test

# 监听模式（开发时持续验证）
npm run test:watch

# 单个文件
npx vitest run src/lib/__tests__/crypto.test.ts
```

### 6.2 提交前完整验证
```bash
# 1. Lint
npm run lint

# 2. 单元测试 + 覆盖率
npm run test:coverage

# 3. E2E（需先启动 dev server 或让 Playwright 自动启动）
npm run test:e2e

# 4. 清理 E2E 测试数据
npx tsx scripts/cleanup-e2e-data.ts
```

### 6.3 UI 调试 E2E
```bash
npm run test:e2e:ui  # 打开 Playwright Inspector，可逐步执行、查看 DOM
```

## 7. 测试通过的交付标准

每次交付给用户验收前，**必须**满足：

- [x] `npm run lint` 0 error
- [x] `npm run test:coverage` 全部通过且达到阈值
- [x] `npm run test:e2e` 全部通过（CI 中重试 2 次仍失败的不允许交付）
- [x] E2E 测试数据已清理（无 `E2E` 前缀的脏数据残留）
- [x] 新增功能模块已补全对应测试
- [x] 修复的 bug 已新增回归测试

## 8. 后续迭代规划

### P0（本次已完成）
- ✅ CI 工作流集成 lint + unit + e2e
- ✅ 4 个安全关键模块单元测试（crypto/jwt/permissions/rate-limit）
- ✅ 覆盖率阈值 30%
- ✅ Playwright HTML 报告 + 失败截图/视频/trace

### P1（下一迭代）
- [ ] 补全 AI 对话模块测试（chat API、stream 解析、token 计费）
- [ ] 补全飞书集成测试（lark-task 同步、OAuth 回调）
- [ ] 补全记忆图谱测试（节点 CRUD、embedding 重建）
- [ ] 补全 HermesAgent 集成测试（远程命令、状态同步）
- [ ] 覆盖率阈值提升到 50%

### P2
- [ ] API 路由层集成测试（supertest）
- [ ] 视觉回归测试（Playwright screenshot 对比）
- [ ] 性能基准测试（k6 / autocannon）
- [ ] 覆盖率阈值提升到 70%
- [ ] 测试覆盖率徽章添加到 README

## 9. Branch Protection 配置建议

在 GitHub/Gitee 仓库设置中启用：
- ✅ Require status checks to pass before merging
- ✅ Required status checks: `Lint + Unit Test`, `E2E Test (Playwright)`
- ✅ Require branches to be up to date before merging
- ✅ Require conversation resolution before merging
- ✅ Do not allow bypassing the above settings
