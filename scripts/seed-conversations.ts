/**
 * 对话资产测试数据 seed 脚本
 * 运行：node scripts/seed-conversations.compiled.js
 * 或在本地开发环境：npx tsx scripts/seed-conversations.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const LYNN_USER_ID = "clynn_user_id_0001";

interface SeedConversation {
  source: string;
  title: string;
  rawContent: string;
  conclusions: string[];
  todos: string[];
  prompts: string[];
  data: string[];
  capturedAt: Date;
}

const seedConversations: SeedConversation[] = [
  {
    source: "kimi",
    title: "LynnHub 产品架构讨论",
    rawContent: "用户：我想做一个 AI 工作站，集成灵感管理、任务看板、记忆图谱...\nKimi：建议采用 Next.js + Prisma + MySQL 技术栈，前端用 iOS 26 液态玻璃设计...",
    conclusions: [
      "采用 Next.js + Prisma + MySQL 技术栈",
      "前端使用 iOS 26 液态玻璃设计规范",
      "核心模块：灵感管理、任务看板、记忆图谱、AI 助理",
    ],
    todos: [
      "搭建 Next.js 项目骨架",
      "设计数据库 Schema",
      "实现灵感 Inbox 模块",
    ],
    prompts: [
      "请帮我设计一个 AI 工作站的产品架构",
      "推荐适合的技术栈",
    ],
    data: ["技术栈：Next.js + Prisma + MySQL", "设计规范：iOS 26 液态玻璃"],
    capturedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
  },
  {
    source: "claude",
    title: "HermesAgent 集成方案",
    rawContent: "用户：如何集成 HermesAgent 让 AI 助理能操控电脑？\nClaude：可以通过 child_process 调用 hermes CLI，启动 dashboard 服务...",
    conclusions: [
      "通过 child_process 调用 hermes CLI",
      "启动 hermes dashboard 服务（端口 9119）",
      "Hermes 模式 8 秒超时回退到 LLM",
    ],
    todos: [
      "实现 installHermesAgent 函数",
      "实现 startHermesAgent/stopHermesAgent",
      "集成到 AI 助理聊天路由",
    ],
    prompts: [
      "如何让 AI 助理操控电脑？",
      "hermes CLI 的启动命令是什么？",
    ],
    data: ["端口：9119", "超时：8秒", "回退：LLM Function Calling"],
    capturedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
  },
  {
    source: "codex",
    title: "飞书任务同步实现",
    rawContent: "讨论如何通过 lark-cli 同步飞书任务到本地...",
    conclusions: [
      "通过 child_process 调用 lark-cli 命令",
      "支持同步/异步双版本",
      "三级降级：lark-cli → DB 缓存 → 错误响应",
    ],
    todos: [
      "封装 lark-sync.ts 核心库",
      "实现任务 CRUD API",
      "添加 Webhook 实时同步",
    ],
    prompts: ["lark-cli task tasklists list 命令格式"],
    data: ["缓存 TTL：5分钟", "降级策略：三级"],
    capturedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    source: "gpt",
    title: "记忆图谱可视化方案",
    rawContent: "讨论记忆图谱的前端可视化实现...",
    conclusions: [
      "使用 SVG + 力导向布局算法",
      "支持聚类着色和二级关联展开",
      "节点双击展开二级关联",
    ],
    todos: ["实现 computeClusters 聚类算法", "添加节点选中/悬停高亮"],
    prompts: ["如何实现力导向图布局？"],
    data: ["布局：力导向", "聚类：并查集算法"],
    capturedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
  },
  {
    source: "kimi",
    title: "iOS 26 液态玻璃设计规范",
    rawContent: "讨论 iOS 26 设计规范在 Web 端的实现...",
    conclusions: [
      "白色半透明玻璃(0.72) + 米白渐变背景",
      "iOS 蓝色板 + 深色文字",
      "所有弹窗使用毛玻璃效果但保持高对比度",
    ],
    todos: ["定义 CSS 变量", "实现 btn-glass 等组件样式", "统一卡片圆角和阴影"],
    prompts: ["iOS 26 液态玻璃的 CSS 实现"],
    data: ["透明度：0.72", "模糊：28px"],
    capturedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    source: "claude",
    title: "桌面端 Tauri 2.x 集成",
    rawContent: "讨论 Tauri 2.x 桌面端客户端的实现...",
    conclusions: [
      "使用 Tauri 2.x + React + TypeScript",
      "窗口尺寸 1280×800 居中",
      "通过 TcpStream::connect_timeout 检测本地服务器",
    ],
    todos: ["搭建 Tauri 项目骨架", "实现服务器检测逻辑", "打包 NSIS 安装程序"],
    prompts: ["Tauri 2.x 的 invoke API 路径"],
    data: ["框架：Tauri 2.x", "窗口：1280×800"],
    capturedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    source: "codex",
    title: "AI 巡检规则引擎设计",
    rawContent: "讨论 AI 巡检模块的规则引擎实现...",
    conclusions: [
      "支持定时巡检和手动触发",
      "规则支持通知渠道配置（飞书/邮件）",
      "可接管为 Hermes Cron 任务",
    ],
    todos: ["实现 PatrolRule 数据模型", "开发巡检规则配置 UI", "集成 Hermes Cron"],
    prompts: ["如何实现定时巡检？"],
    data: ["通知渠道：飞书+邮件", "Cron：5字段表达式"],
    capturedAt: new Date(Date.now() - 1.5 * 24 * 60 * 60 * 1000),
  },
  {
    source: "gpt",
    title: "技能市场与分享机制",
    rawContent: "讨论技能市场的设计...",
    conclusions: [
      "技能支持 4 类来源：内置/hermes-learned/hermes-imported/自定义",
      "市场支持评论和评分",
      "技能可导入到本地库",
    ],
    todos: ["实现技能 CRUD API", "开发市场页面", "添加评论评分系统"],
    prompts: ["技能市场的数据模型设计"],
    data: ["来源：4类", "评分：1-5星"],
    capturedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
  },
  {
    source: "kimi",
    title: "语音通话 ASR/TTS 集成",
    rawContent: "讨论语音通话功能的实现...",
    conclusions: [
      "ASR 使用小米 MiMo mimo-v2.5-asr 模型",
      "TTS 使用 mimo-v2.5-tts，支持流式合成",
      "音色复刻使用 mimo-v2.5-tts-voiceclone",
    ],
    todos: ["实现 ASR API 路由", "实现流式 TTS", "添加音色复刻功能"],
    prompts: ["小米 MiMo ASR 的调用格式"],
    data: ["ASR模型：mimo-v2.5-asr", "TTS模型：mimo-v2.5-tts"],
    capturedAt: new Date(Date.now() - 12 * 60 * 60 * 1000),
  },
  {
    source: "claude",
    title: "灵感收敛工作流",
    rawContent: "讨论灵感从 Inbox 到看板的收敛流程...",
    conclusions: [
      "灵感支持 4 种归宿：北极星/战役/任务/墓地",
      "AI 自动建议归位列和标签",
      "支持批量操作",
    ],
    todos: ["实现 converge 页面", "集成 AI idea-finalize API", "添加批量操作"],
    prompts: ["灵感收敛的 AI 建议逻辑"],
    data: ["归宿：4种", "AI建议：自动归位"],
    capturedAt: new Date(Date.now() - 8 * 60 * 60 * 1000),
  },
  {
    source: "codex",
    title: "部署架构与零构建约束",
    rawContent: "讨论服务器部署架构...",
    conclusions: [
      "服务器 2C2G 禁止任何构建操作",
      "本地构建后上传 standalone 产物",
      "PM2 管理进程，nginx 反向代理",
    ],
    todos: ["编写 deploy.py 部署脚本", "配置 PM2 ecosystem", "设置 nginx 反代"],
    prompts: ["Next.js standalone 部署方式"],
    data: ["服务器：2C2G", "部署方式：standalone"],
    capturedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
  },
  {
    source: "gpt",
    title: "认证系统与万能验证码",
    rawContent: "讨论 NextAuth 认证配置...",
    conclusions: [
      "使用 NextAuth v5 + Credentials Provider",
      "支持手机号+密码和手机号+验证码两种模式",
      "万能验证码存储在 SystemConfig 表，可动态开关",
    ],
    todos: ["配置 NextAuth v5", "实现万能验证码管理", "添加登录限流"],
    prompts: ["NextAuth v5 的 cookie 配置"],
    data: ["认证：NextAuth v5", "限流：10次/分钟"],
    capturedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
  },
  {
    source: "kimi",
    title: "认知库与知识提取",
    rawContent: "讨论认知库模块的设计...",
    conclusions: [
      "认知从对话/灵感中自动提取",
      "支持 4 种类型：结论/待办/提示词/数据",
      "与记忆图谱关联，支持语义搜索",
    ],
    todos: ["实现 Cognition 数据模型", "开发 AI 自动提取", "集成向量搜索"],
    prompts: ["认知提取的 AI prompt 设计"],
    data: ["类型：4种", "搜索：向量+TF-IDF"],
    capturedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
  },
  {
    source: "claude",
    title: "Webhook 实时同步机制",
    rawContent: "讨论飞书 Webhook 事件订阅的实现...",
    conclusions: [
      "通过 SSE (Server-Sent Events) 推送事件",
      "支持 5 种事件类型：created/updated/completed/deleted/reopened",
      "5 分钟自动同步兜底",
    ],
    todos: ["实现 SSE 端点", "配置 Webhook 向导", "添加模拟事件测试"],
    prompts: ["SSE 的实现方式"],
    data: ["协议：SSE", "事件：5种", "兜底：5分钟"],
    capturedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
  },
];

async function main() {
  console.log("开始 seed 对话资产测试数据...");

  // 清空旧数据（仅 lynn 用户的对话数据）
  const deleted = await prisma.conversation.deleteMany({
    where: { userId: LYNN_USER_ID },
  });
  console.log(`已清空旧数据: ${deleted.count} 条`);

  // 创建数据
  for (const conv of seedConversations) {
    await prisma.conversation.create({
      data: {
        source: conv.source,
        title: conv.title,
        rawContent: conv.rawContent,
        conclusions: conv.conclusions,
        todos: conv.todos,
        prompts: conv.prompts,
        data: conv.data,
        capturedAt: conv.capturedAt,
        userId: LYNN_USER_ID,
      },
    });
  }

  const total = await prisma.conversation.count({
    where: { userId: LYNN_USER_ID },
  });
  console.log(`✅ seed 完成，共 ${total} 条对话资产`);
}

main()
  .catch((e) => {
    console.error("seed 失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
