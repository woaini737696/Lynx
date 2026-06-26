import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ============ 预置技能数据（12 岗位 × 5 技能 = 60 个）============
// 字段：name / description / category / content / promptTemplate
// source = "manual"，isPublic = false，userId = null（系统预置）

interface PresetSkill {
  name: string;
  description: string;
  category: string;
  content: string;
  promptTemplate: string;
}

const PRESET_SKILLS: PresetSkill[] = [
  // ============ 产品经理 (pm) ============
  {
    name: "PRD撰写模板",
    description: "结构化撰写产品需求文档（PRD），覆盖背景、目标、需求详述、验收标准",
    category: "pm",
    content:
      "# PRD 撰写\n\n## 1. 背景\n说明需求来源与业务背景。\n\n## 2. 目标\n- 业务目标：\n- 用户目标：\n\n## 3. 需求详述\n### 3.1 功能点\n### 3.2 流程图\n### 3.3 交互说明\n\n## 4. 验收标准\n\n## 5. 排期\n",
    promptTemplate:
      "你是一位资深产品经理。请基于以下信息撰写一份完整的 PRD：\n需求标题：{{title}}\n背景说明：{{background}}\n请输出包含背景、目标、需求详述、验收标准、排期建议的 PRD。",
  },
  {
    name: "需求评审清单",
    description: "需求评审前后的检查清单，确保需求完整、可执行、无遗漏",
    category: "pm",
    content:
      "# 需求评审清单\n\n## 评审前\n- [ ] PRD 已完成并自测\n- [ ] 流程图/原型已附\n- [ ] 异常场景已覆盖\n\n## 评审中\n- [ ] 需求背景说明清晰\n- [ ] 各方对验收标准达成一致\n- [ ] 技术可行性已确认\n\n## 评审后\n- [ ] 会议纪要已发送\n- [ ] 待修改项已指派\n- [ ] 排期已确认\n",
    promptTemplate:
      "你是一位产品经理。请根据以下需求生成一份评审清单，覆盖完整性、可行性、异常场景、验收标准：\n需求标题：{{title}}\n需求简述：{{description}}",
  },
  {
    name: "竞品分析框架",
    description: "从产品、功能、运营、商业等多维度对比竞品，输出结论与建议",
    category: "pm",
    content:
      "# 竞品分析\n\n## 1. 竞品选择\n| 竞品 | 定位 | 优势 | 劣势 |\n|------|------|------|------|\n\n## 2. 功能对比\n\n## 3. 数据对比\n\n## 4. 结论与建议\n",
    promptTemplate:
      "你是一位产品分析师。请对以下竞品进行多维度对比分析：\n本品：{{ourProduct}}\n竞品：{{competitors}}\n分析维度：产品定位、核心功能、运营策略、商业模式、用户口碑。\n请输出表格对比与策略建议。",
  },
  {
    name: "用户故事编写",
    description: "按 As a / I want / So that 格式编写用户故事，含验收标准",
    category: "pm",
    content:
      "# 用户故事\n\n## 角色\n## 故事\nAs a {{角色}}, I want {{需求}}, so that {{价值}}\n\n## 验收标准\n- Given ...\n- When ...\n- Then ...\n",
    promptTemplate:
      "你是一位产品经理。请将以下需求转化为标准的用户故事，并补充 3 条验收标准（Given/When/Then）：\n需求描述：{{requirement}}\n目标用户：{{userRole}}",
  },
  {
    name: "版本规划",
    description: "梳理版本节奏与功能优先级，输出里程碑与发布计划",
    category: "pm",
    content:
      "# 版本规划\n\n## 版本目标\n## 功能清单（按优先级）\n| 功能 | 优先级 | 版本 | 负责人 |\n## 里程碑\n## 风险\n",
    promptTemplate:
      "你是一位产品经理。请基于以下信息制定版本规划，包含功能优先级排序、里程碑、风险点：\n产品：{{product}}\n待规划功能：{{features}}\n版本节奏：{{cadence}}",
  },

  // ============ 设计师 (designer) ============
  {
    name: "设计规范文档",
    description: "统一颜色、字体、间距、组件等设计 token，沉淀团队设计语言",
    category: "designer",
    content:
      "# 设计规范\n\n## 1. 色彩\n- 主色：\n- 辅助色：\n- 中性色：\n\n## 2. 字体\n- 字号阶梯：\n- 字重：\n\n## 3. 间距\n- 4 / 8 / 12 / 16 / 24 / 32\n\n## 4. 组件\n",
    promptTemplate:
      "你是一位资深设计师。请基于以下品牌信息输出一份设计规范，包含色彩、字体、间距、圆角、阴影、组件 token：\n品牌名：{{brand}}\n调性关键词：{{keywords}}\n主色参考：{{primaryColor}}",
  },
  {
    name: "组件库设计",
    description: "设计可复用组件库的结构、状态、交互规范",
    category: "designer",
    content:
      "# 组件库设计\n\n## 组件清单\n## 原子设计层级（Atom/Molecule/Organism）\n## 状态（default/hover/active/disabled）\n## 交互规范\n## 命名约定\n",
    promptTemplate:
      "你是一位设计系统负责人。请为以下产品规划组件库结构，包含组件清单、原子设计层级、各组件状态、命名约定：\n产品：{{product}}\n技术栈：{{stack}}\n已知页面：{{pages}}",
  },
  {
    name: "Figma交付清单",
    description: "设计稿交付前的自检清单，确保开发可顺利还原",
    category: "designer",
    content:
      "# Figma 交付清单\n\n- [ ] 图层命名规范\n- [ ] 组件已实例化\n- [ ] 自动布局已设置\n- [ ] 文本样式已应用\n- [ ] 颜色使用 token\n- [ ] 多状态已补全\n- [ ] 切图导出 1x/2x/3x\n- [ ] 标注清晰\n",
    promptTemplate:
      "你是一位设计师。请生成一份 Figma 设计稿交付前的自检清单，确保开发可顺利还原：\n项目：{{project}}\n交付对象：{{deliverTo}}\n平台：{{platform}}",
  },
  {
    name: "设计评审",
    description: "设计评审要点梳理，从可用性、一致性、美观性等维度把关",
    category: "designer",
    content:
      "# 设计评审\n\n## 评审维度\n- 可用性\n- 一致性\n- 美观性\n- 可实现性\n- 无障碍\n\n## 问题记录\n| 序号 | 问题 | 维度 | 负责人 | 状态 |\n",
    promptTemplate:
      "你是一位设计评审专家。请对以下设计方案进行多维度评审，输出问题清单与改进建议：\n设计稿说明：{{designDescription}}\n评审重点：{{focus}}",
  },
  {
    name: "视觉走查",
    description: "开发实现后与设计稿对比的视觉走查清单",
    category: "designer",
    content:
      "# 视觉走查\n\n## 走查范围\n## 对比项\n- 间距\n- 字体\n- 颜色\n- 圆角\n- 阴影\n- 图标\n- 交互状态\n\n## 缺陷清单\n| 页面 | 问题 | 严重度 | 负责人 |\n",
    promptTemplate:
      "你是一位设计师。请生成一份视觉走查清单，用于开发实现与设计稿的对比：\n页面：{{page}}\n设计稿链接：{{figmaUrl}}\n实现环境：{{env}}",
  },

  // ============ 前端工程师 (frontend) ============
  {
    name: "组件开发规范",
    description: "统一组件命名、Props 设计、目录结构等开发规范",
    category: "frontend",
    content:
      "# 组件开发规范\n\n## 1. 命名\n- 组件：PascalCase\n- Props：camelCase\n- 事件：onXxx\n\n## 2. Props 设计\n- 单一职责\n- 合理默认值\n- TypeScript 类型\n\n## 3. 目录结构\n```\ncomponents/\n  Button/\n    index.tsx\n    styles.ts\n    __tests__/\n```\n",
    promptTemplate:
      "你是一位资深前端工程师。请基于以下技术栈输出一份组件开发规范，覆盖命名、Props 设计、目录结构、类型约定：\n框架：{{framework}}\nUI 库：{{uiLibrary}}\n项目规模：{{scale}}",
  },
  {
    name: "性能优化清单",
    description: "前端性能优化的检查清单，覆盖加载、渲染、运行时",
    category: "frontend",
    content:
      "# 性能优化清单\n\n## 加载\n- [ ] 代码分割\n- [ ] 懒加载\n- [ ] 图片优化（WebP/懒加载）\n- [ ] CDN\n\n## 渲染\n- [ ] 虚拟列表\n- [ ] 减少 reflow\n- [ ] 防抖节流\n\n## 运行时\n- [ ] 内存泄漏排查\n- [ ] Web Worker\n",
    promptTemplate:
      "你是一位前端性能优化专家。请针对以下场景生成性能优化清单，覆盖加载、渲染、运行时三个维度：\n应用类型：{{appType}}\n已知瓶颈：{{bottleneck}}\n目标指标：{{metrics}}",
  },
  {
    name: "单元测试模板",
    description: "前端单元测试编写模板，含用例组织与断言示例",
    category: "frontend",
    content:
      "# 单元测试模板\n\n## 用例组织（AAA）\n- Arrange：准备\n- Act：执行\n- Assert：断言\n\n## 示例\n```ts\ndescribe('Button', () => {\n  it('点击触发 onClick', () => {\n    const fn = jest.fn();\n    render(<Button onClick={fn} />);\n    fireEvent.click(screen.getByRole('button'));\n    expect(fn).toHaveBeenCalled();\n  });\n});\n```\n",
    promptTemplate:
      "你是一位前端测试工程师。请为以下组件生成单元测试用例，覆盖核心交互、边界条件、异常情况：\n组件名：{{componentName}}\n组件功能：{{feature}}\n测试框架：{{framework}}",
  },
  {
    name: "Code Review",
    description: "前端 Code Review 的检查要点，确保代码质量与一致性",
    category: "frontend",
    content:
      "# Code Review 清单\n\n## 功能\n- [ ] 需求实现完整\n- [ ] 边界条件处理\n\n## 代码质量\n- [ ] 命名清晰\n- [ ] 无重复代码\n- [ ] 类型完整\n\n## 性能\n- [ ] 无不必要渲染\n- [ ] 资源合理使用\n\n## 安全\n- [ ] XSS 防护\n- [ ] 敏感信息未泄露\n",
    promptTemplate:
      "你是一位资深前端工程师。请对以下代码进行 Code Review，输出问题清单与改进建议：\n代码片段：{{code}}\n业务背景：{{context}}",
  },
  {
    name: "技术选型",
    description: "前端技术选型对比框架，从多维度评估候选方案",
    category: "frontend",
    content:
      "# 技术选型\n\n## 候选方案\n## 评估维度\n- 功能满足度\n- 性能\n- 生态\n- 学习成本\n- 维护性\n- 社区活跃度\n\n## 对比矩阵\n| 维度 | 方案 A | 方案 B |\n\n## 结论\n",
    promptTemplate:
      "你是一位前端架构师。请对以下候选技术方案进行多维度对比，输出选型建议：\n选型目标：{{goal}}\n候选方案：{{candidates}}\n团队现状：{{teamContext}}",
  },

  // ============ 后端工程师 (backend) ============
  {
    name: "API设计规范",
    description: "RESTful / RPC API 设计规范，含命名、版本、错误码约定",
    category: "backend",
    content:
      "# API 设计规范\n\n## 1. URL\n- 资源用名词复数\n- 小写连字符\n- 版本前缀 /v1/\n\n## 2. 方法\n- GET 查询\n- POST 创建\n- PATCH 更新\n- DELETE 删除\n\n## 3. 错误码\n| code | 含义 |\n\n## 4. 分页与排序\n",
    promptTemplate:
      "你是一位资深后端工程师。请基于以下业务场景输出 API 设计规范，含 URL 规则、方法约定、错误码、分页方案：\n业务领域：{{domain}}\n技术栈：{{stack}}\n客户端：{{clients}}",
  },
  {
    name: "数据库设计",
    description: "数据库表结构设计模板，含字段、索引、关系说明",
    category: "backend",
    content:
      "# 数据库设计\n\n## 1. 表结构\n### 表名：xxx\n| 字段 | 类型 | 约束 | 说明 |\n\n## 2. 索引\n## 3. 关系图\n## 4. 性能考虑\n## 5. 迁移脚本\n",
    promptTemplate:
      "你是一位数据库设计师。请基于以下业务需求设计数据库表结构，含字段、索引、关系、性能考虑：\n业务需求：{{requirement}}\n数据库：{{dbType}}\n预估数据量：{{scale}}",
  },
  {
    name: "性能调优",
    description: "后端性能调优 checklist，覆盖 SQL、缓存、并发",
    category: "backend",
    content:
      "# 性能调优\n\n## SQL\n- [ ] 慢查询排查\n- [ ] 索引优化\n- [ ] N+1 检测\n\n## 缓存\n- [ ] 热点数据缓存\n- [ ] 缓存失效策略\n- [ ] 防穿透/雪崩\n\n## 并发\n- [ ] 异步化\n- [ ] 连接池\n- [ ] 限流降级\n",
    promptTemplate:
      "你是一位后端性能优化专家。请针对以下场景生成性能调优清单，覆盖 SQL、缓存、并发、资源：\n服务：{{service}}\n已知瓶颈：{{bottleneck}}\n当前 QPS：{{qps}}",
  },
  {
    name: "接口文档",
    description: "标准接口文档模板，含请求、响应、示例",
    category: "backend",
    content:
      "# 接口文档\n\n## 接口名\n## 请求\n- Method：\n- URL：\n- Headers：\n- Params：\n\n## 响应\n- 状态码：\n- Body：\n\n## 示例\n```json\n{}\n```\n\n## 错误码\n",
    promptTemplate:
      "你是一位后端工程师。请为以下接口生成完整的接口文档，含请求、响应、示例、错误码：\n接口名：{{apiName}}\n功能：{{feature}}\n方法：{{method}}",
  },
  {
    name: "部署清单",
    description: "服务上线部署前的检查清单",
    category: "backend",
    content:
      "# 部署清单\n\n## 代码\n- [ ] 分支已合并\n- [ ] 版本号已更新\n\n## 配置\n- [ ] 环境变量已配置\n- [ ] 配置中心已同步\n\n## 数据库\n- [ ] 迁移脚本已执行\n- [ ] 索引已创建\n\n## 验证\n- [ ] 健康检查通过\n- [ ] 监控告警就绪\n- [ ] 回滚方案已准备\n",
    promptTemplate:
      "你是一位后端工程师。请生成一份服务部署清单，覆盖代码、配置、数据库、验证、监控、回滚：\n服务名：{{service}}\n部署环境：{{env}}\n依赖服务：{{dependencies}}",
  },

  // ============ 数据分析师 (data) ============
  {
    name: "数据分析报告",
    description: "结构化数据分析报告模板，从背景到结论建议",
    category: "data",
    content:
      "# 数据分析报告\n\n## 1. 背景与目标\n## 2. 数据来源\n## 3. 分析方法\n## 4. 关键发现\n## 5. 结论与建议\n## 6. 附录（图表/SQL）\n",
    promptTemplate:
      "你是一位资深数据分析师。请基于以下信息撰写一份数据分析报告，含背景、方法、关键发现、结论建议：\n分析主题：{{topic}}\n数据摘要：{{dataSummary}}\n业务问题：{{question}}",
  },
  {
    name: "指标体系设计",
    description: "从北极星指标拆解到各级指标的设计方法",
    category: "data",
    content:
      "# 指标体系\n\n## 1. 北极星指标\n## 2. 一级指标\n## 3. 二级指标\n## 4. 指标定义\n| 指标 | 定义 | 计算公式 | 数据源 |\n## 5. 监控看板\n",
    promptTemplate:
      "你是一位数据分析师。请为以下业务设计指标体系，从北极星指标拆解到二三级指标，并给出定义与公式：\n业务：{{business}}\n阶段：{{stage}}\n核心目标：{{goal}}",
  },
  {
    name: "SQL查询模板",
    description: "常用 SQL 查询模板：留存、漏斗、环比同比等",
    category: "data",
    content:
      "# SQL 查询模板\n\n## 1. 留存率\n```sql\nSELECT login_date,\n  COUNT(DISTINCT user_id) AS dau\nFROM logs\nGROUP BY login_date;\n```\n\n## 2. 漏斗\n## 3. 环比同比\n## 4. Top N\n",
    promptTemplate:
      "你是一位数据分析师。请基于以下需求编写 SQL 查询，并加上注释说明：\n分析目标：{{goal}}\n表结构：{{schema}}\n数据库：{{dbType}}",
  },
  {
    name: "数据可视化",
    description: "选择合适图表类型与设计可视化看板",
    category: "data",
    content:
      "# 数据可视化\n\n## 1. 图表选择\n- 趋势：折线\n- 对比：柱状\n- 占比：饼图\n- 分布：直方图\n\n## 2. 看板布局\n## 3. 配色与标注\n## 4. 交互设计\n",
    promptTemplate:
      "你是一位数据可视化专家。请基于以下数据特征推荐图表类型并设计看板布局：\n数据特征：{{dataFeatures}}\n受众：{{audience}}\n核心信息：{{keyMessage}}",
  },
  {
    name: "AB测试",
    description: "AB 测试方案设计与结果评估模板",
    category: "data",
    content:
      "# AB 测试\n\n## 1. 假设\n## 2. 指标\n- 主指标：\n- 辅助指标：\n- 护栏指标：\n\n## 3. 样本量计算\n## 4. 实验分组\n## 5. 结果评估\n- 显著性\n- 效应量\n- 置信区间\n",
    promptTemplate:
      "你是一位数据分析师。请基于以下信息设计 AB 测试方案，含假设、指标、样本量、评估方法：\n实验目的：{{goal}}\n实验变量：{{variant}}\n预期提升：{{expectedLift}}",
  },

  // ============ 运营 (operations) ============
  {
    name: "运营计划",
    description: "运营阶段性工作计划，含目标、策略、动作、排期",
    category: "operations",
    content:
      "# 运营计划\n\n## 1. 目标\n## 2. 策略\n## 3. 关键动作\n| 动作 | 负责人 | 排期 | 指标 |\n## 4. 资源需求\n## 5. 风险与预案\n",
    promptTemplate:
      "你是一位资深运营。请基于以下信息制定运营计划，含目标、策略、关键动作、排期、资源：\n产品：{{product}}\n阶段：{{stage}}\n目标：{{goal}}\n周期：{{period}}",
  },
  {
    name: "活动方案",
    description: "运营活动策划方案，含玩法、预算、节奏、复盘",
    category: "operations",
    content:
      "# 活动方案\n\n## 1. 活动背景\n## 2. 目标与指标\n## 3. 玩法设计\n## 4. 时间节奏\n## 5. 预算\n## 6. 推广渠道\n## 7. 风险预案\n## 8. 复盘指标\n",
    promptTemplate:
      "你是一位运营策划专家。请基于以下信息输出活动方案，含玩法、节奏、预算、推广、复盘：\n活动主题：{{theme}}\n目标用户：{{audience}}\n预算：{{budget}}\n周期：{{period}}",
  },
  {
    name: "用户增长",
    description: "用户增长策略框架，从拉新到留存到裂变",
    category: "operations",
    content:
      "# 用户增长\n\n## 1. 增长公式\n## 2. 拉新渠道\n## 3. 激活路径\n## 4. 留存策略\n## 5. 裂变机制\n## 6. 指标漏斗\n| 环节 | 指标 | 现状 | 目标 |\n",
    promptTemplate:
      "你是一位增长运营专家。请基于以下信息制定用户增长策略，覆盖拉新、激活、留存、裂变：\n产品：{{product}}\n当前 DAU：{{dau}}\n目标 DAU：{{targetDau}}\n周期：{{period}}",
  },
  {
    name: "内容排期",
    description: "内容运营排期表，含主题、渠道、发布时间",
    category: "operations",
    content:
      "# 内容排期\n\n## 周排期\n| 日期 | 主题 | 渠道 | 负责人 | 状态 |\n\n## 选题池\n## 素材库\n## 数据复盘\n",
    promptTemplate:
      "你是一位内容运营。请基于以下信息制定内容排期表，含主题、渠道、发布时间、负责人：\n账号：{{account}}\n渠道：{{channels}}\n本周目标：{{goal}}\n发布频率：{{frequency}}",
  },
  {
    name: "数据复盘",
    description: "运营数据复盘模板，对比目标与实际，提炼经验",
    category: "operations",
    content:
      "# 数据复盘\n\n## 1. 目标回顾\n## 2. 实际结果\n| 指标 | 目标 | 实际 | 达成率 |\n## 3. 差异分析\n## 4. 经验沉淀\n## 5. 下一步动作\n",
    promptTemplate:
      "你是一位运营专家。请基于以下信息进行数据复盘，含目标回顾、差异分析、经验沉淀、下一步：\n复盘周期：{{period}}\n目标：{{goal}}\n实际数据：{{actualData}}\n关键事件：{{events}}",
  },

  // ============ 市场 (marketing) ============
  {
    name: "市场调研",
    description: "市场规模、竞品、用户、趋势的调研框架",
    category: "marketing",
    content:
      "# 市场调研\n\n## 1. 市场规模\n## 2. 竞争格局\n## 3. 用户画像\n## 4. 趋势分析\n## 5. 机会与风险\n## 6. 结论建议\n",
    promptTemplate:
      "你是一位市场研究专家。请基于以下信息输出市场调研报告，含规模、竞品、用户、趋势、机会：\n行业：{{industry}}\n产品：{{product}}\n调研目的：{{objective}}",
  },
  {
    name: "品牌策划",
    description: "品牌定位、价值观、视觉、传播的策划框架",
    category: "marketing",
    content:
      "# 品牌策划\n\n## 1. 品牌定位\n## 2. 核心价值\n## 3. 品牌人格\n## 4. 视觉系统\n## 5. 传播主张\n## 6. 落地动作\n",
    promptTemplate:
      "你是一位品牌策划专家。请基于以下信息输出品牌策划方案，含定位、价值、人格、视觉、传播：\n品牌名：{{brand}}\n行业：{{industry}}\n目标用户：{{audience}}\n差异化点：{{differentiator}}",
  },
  {
    name: "投放方案",
    description: "广告投放方案，含渠道、预算、素材、效果预估",
    category: "marketing",
    content:
      "# 投放方案\n\n## 1. 投放目标\n## 2. 渠道选择\n| 渠道 | 受众 | 预算 | KPI |\n## 3. 素材规划\n## 4. 出价策略\n## 5. 效果预估\n## 6. 优化机制\n",
    promptTemplate:
      "你是一位投放优化专家。请基于以下信息输出广告投放方案，含渠道、预算、素材、出价、预估：\n产品：{{product}}\n总预算：{{budget}}\n目标：{{goal}}\n周期：{{period}}",
  },
  {
    name: "PR稿件",
    description: "公关稿件撰写模板，含新闻点、引语、事实",
    category: "marketing",
    content:
      "# PR 稿件\n\n## 标题\n## 导语（5W1H）\n## 正文\n- 新闻点\n- 数据支撑\n- 引语\n- 行业背景\n## 关于公司\n## 媒体联系\n",
    promptTemplate:
      "你是一位公关撰稿人。请基于以下信息撰写一份 PR 稿件，含新闻点、数据、引语、行业背景：\n发布主体：{{company}}\n新闻事件：{{event}}\n核心信息：{{keyMessage}}\n目标媒体：{{media}}",
  },
  {
    name: "活动策划",
    description: "市场活动策划方案，含主题、流程、执行、复盘",
    category: "marketing",
    content:
      "# 活动策划\n\n## 1. 主题与目标\n## 2. 时间地点\n## 3. 参与人员\n## 4. 流程安排\n## 5. 物料清单\n## 6. 预算\n## 7. 推广\n## 8. 风险预案\n## 9. 复盘指标\n",
    promptTemplate:
      "你是一位市场活动策划专家。请基于以下信息输出活动策划方案，含主题、流程、物料、预算、推广：\n活动类型：{{type}}\n主题：{{theme}}\n规模：{{scale}}\n预算：{{budget}}",
  },

  // ============ HR (hr) ============
  {
    name: "招聘JD模板",
    description: "标准岗位 JD 模板，含职责、要求、福利",
    category: "hr",
    content:
      "# {{岗位名}}\n\n## 岗位职责\n## 任职要求\n- 学历：\n- 经验：\n- 技能：\n## 加分项\n## 薪酬福利\n## 工作地点\n",
    promptTemplate:
      "你是一位 HR。请基于以下信息撰写一份岗位 JD，含职责、要求、加分项、福利：\n岗位名：{{position}}\n部门：{{department}}\n级别：{{level}}\n核心职责：{{responsibilities}}",
  },
  {
    name: "面试评估",
    description: "结构化面试评估表，含维度、评分、评语",
    category: "hr",
    content:
      "# 面试评估表\n\n## 候选人信息\n## 评估维度\n| 维度 | 评分(1-5) | 评码 |\n- 专业能力\n- 沟通表达\n- 逻辑思维\n- 团队协作\n- 文化匹配\n## 综合结论\n- 推荐 / 待定 / 不推荐\n## 备注\n",
    promptTemplate:
      "你是一位 HR 面试官。请基于以下信息生成结构化面试评估表，含评估维度、评分、结论：\n岗位：{{position}}\n面试轮次：{{round}}\n候选人亮点：{{highlights}}\n关注点：{{concerns}}",
  },
  {
    name: "入职流程",
    description: "新员工入职流程清单，覆盖准备、当天、首周、首月",
    category: "hr",
    content:
      "# 入职流程\n\n## 入职前\n- [ ] Offer 发送\n- [ ] 账号开通\n- [ ] 工位准备\n\n## 入职当天\n- [ ] 签订合同\n- [ ] 办公设备发放\n- [ ] 公司介绍\n\n## 首周\n- [ ] 团队介绍\n- [ ] 培训计划\n\n## 首月\n- [ ] 试用期目标确认\n- [ ] 月度沟通\n",
    promptTemplate:
      "你是一位 HR。请基于以下信息生成新员工入职流程清单，覆盖入职前、当天、首周、首月：\n岗位：{{position}}\n部门：{{department}}\n办公形式：{{workMode}}",
  },
  {
    name: "绩效面谈",
    description: "绩效面谈话术与流程，含回顾、反馈、目标",
    category: "hr",
    content:
      "# 绩效面谈\n\n## 1. 开场\n## 2. 业绩回顾\n- 亮点：\n- 不足：\n## 3. 反馈\n- 上级评价\n- 自我评价\n## 4. 目标对齐\n## 5. 改进计划\n## 6. 结语\n",
    promptTemplate:
      "你是一位 HR。请基于以下信息生成绩效面谈话术与流程，含回顾、反馈、目标、改进：\n员工：{{employee}}\n周期：{{period}}\n绩效等级：{{grade}}\n关键事件：{{events}}",
  },
  {
    name: "培训方案",
    description: "员工培训方案设计，含目标、课程、考核",
    category: "hr",
    content:
      "# 培训方案\n\n## 1. 培训目标\n## 2. 受训对象\n## 3. 课程体系\n| 课程 | 形式 | 时长 | 讲师 |\n## 4. 考核方式\n## 5. 效果评估\n## 6. 预算\n",
    promptTemplate:
      "你是一位 HR 培训专家。请基于以下信息设计培训方案，含目标、课程、考核、评估：\n培训主题：{{topic}}\n受训对象：{{audience}}\n人数：{{count}}\n周期：{{period}}",
  },

  // ============ 财务 (finance) ============
  {
    name: "财务报告",
    description: "财务报告撰写模板，含三表分析、经营解读",
    category: "finance",
    content:
      "# 财务报告\n\n## 1. 报告期\n## 2. 关键指标\n- 营收\n- 毛利\n- 净利\n- 现金流\n## 3. 三表分析\n- 利润表\n- 资产负债表\n- 现金流量表\n## 4. 经营解读\n## 5. 风险提示\n## 6. 建议\n",
    promptTemplate:
      "你是一位财务分析师。请基于以下信息撰写财务报告，含关键指标、三表分析、经营解读：\n报告期：{{period}}\n财务摘要：{{summary}}\n同比变化：{{yoy}}\n关注重点：{{focus}}",
  },
  {
    name: "预算编制",
    description: "年度/季度预算编制模板，含收入、成本、费用",
    category: "finance",
    content:
      "# 预算编制\n\n## 1. 收入预算\n## 2. 成本预算\n## 3. 费用预算\n- 销售\n- 管理\n- 研发\n## 4. 资本支出\n## 5. 现金流预算\n## 6. 假设与说明\n",
    promptTemplate:
      "你是一位财务经理。请基于以下信息编制预算，含收入、成本、费用、资本支出、现金流：\n预算周期：{{period}}\n业务目标：{{goal}}\n历史数据：{{history}}\n关键假设：{{assumptions}}",
  },
  {
    name: "成本分析",
    description: "成本结构与变动分析，识别优化空间",
    category: "finance",
    content:
      "# 成本分析\n\n## 1. 成本结构\n| 项目 | 金额 | 占比 | 同比 |\n## 2. 变动分析\n## 3. 优化建议\n## 4. 落地动作\n",
    promptTemplate:
      "你是一位成本分析师。请基于以下信息进行成本分析，含结构、变动、优化建议：\n分析周期：{{period}}\n成本明细：{{costDetails}}\n业务量：{{volume}}\n对标基准：{{benchmark}}",
  },
  {
    name: "税务筹划",
    description: "税务筹划方案，合理利用政策降低税负",
    category: "finance",
    content:
      "# 税务筹划\n\n## 1. 现状\n- 税种\n- 税率\n- 税负\n## 2. 适用政策\n## 3. 筹划方案\n## 4. 风险评估\n## 5. 落地步骤\n",
    promptTemplate:
      "你是一位税务专家。请基于以下信息输出税务筹划方案，含政策适用、筹划方案、风险评估：\n企业类型：{{entityType}}\n行业：{{industry}}\n营收规模：{{revenue}}\n当前税负：{{taxBurden}}",
  },
  {
    name: "审计清单",
    description: "财务审计前的自查清单，覆盖凭证、账务、资产",
    category: "finance",
    content:
      "# 审计清单\n\n## 凭证\n- [ ] 原始凭证完整\n- [ ] 记账凭证合规\n## 账务\n- [ ] 科目余额核对\n- [ ] 往来款清理\n## 资产\n- [ ] 盘点完成\n- [ ] 折旧计提\n## 报表\n- [ ] 报表勾稽\n- [ ] 附注完整\n",
    promptTemplate:
      "你是一位审计师。请基于以下信息生成审计自查清单，覆盖凭证、账务、资产、报表：\n审计期间：{{period}}\n企业类型：{{entityType}}\n重点科目：{{keyAccounts}}\n已知问题：{{issues}}",
  },

  // ============ 项目经理 (project) ============
  {
    name: "项目计划",
    description: "项目计划模板，含目标、范围、WBS、排期",
    category: "project",
    content:
      "# 项目计划\n\n## 1. 项目目标\n## 2. 范围\n- 包含：\n- 不包含：\n## 3. WBS\n## 4. 排期（甘特图）\n## 5. 资源\n## 6. 沟通机制\n## 7. 风险\n",
    promptTemplate:
      "你是一位项目经理。请基于以下信息制定项目计划，含目标、范围、WBS、排期、资源、风险：\n项目名：{{project}}\n目标：{{goal}}\n交付物：{{deliverables}}\n周期：{{period}}",
  },
  {
    name: "风险登记",
    description: "项目风险登记册，含识别、评估、应对",
    category: "project",
    content:
      "# 风险登记册\n\n| 编号 | 风险 | 类别 | 概率 | 影响 | 等级 | 应对策略 | 负责人 |\n\n## 应对策略\n- 规避\n- 缓解\n- 转移\n- 接受\n",
    promptTemplate:
      "你是一位项目经理。请基于以下信息建立风险登记册，含识别、评估（概率/影响）、应对策略：\n项目：{{project}}\n阶段：{{phase}}\n已知风险：{{knownRisks}}\n历史教训：{{lessons}}",
  },
  {
    name: "里程碑管理",
    description: "项目里程碑定义与跟踪模板",
    category: "project",
    content:
      "# 里程碑管理\n\n## 里程碑清单\n| 里程碑 | 日期 | 交付物 | 验收标准 | 状态 |\n\n## 跟踪机制\n## 延误处理\n",
    promptTemplate:
      "你是一位项目经理。请基于以下信息定义项目里程碑，含日期、交付物、验收标准：\n项目：{{project}}\n总周期：{{period}}\n关键节点：{{keyDates}}\n验收方：{{stakeholders}}",
  },
  {
    name: "站会模板",
    description: "每日站会话术与记录模板",
    category: "project",
    content:
      "# 站会记录\n\n## 日期：\n## 参与人：\n## 三问\n1. 昨日完成\n2. 今日计划\n3. 阻塞问题\n\n## 待跟进\n| 事项 | 负责人 | 截止 |\n",
    promptTemplate:
      "你是一位项目经理。请基于以下信息生成站会模板与今日记录要点：\n项目：{{project}}\n团队规模：{{teamSize}}\n当前阶段：{{phase}}\n已知阻塞：{{blockers}}",
  },
  {
    name: "复盘报告",
    description: "项目复盘报告，含目标达成、经验、改进",
    category: "project",
    content:
      "# 项目复盘\n\n## 1. 项目概况\n## 2. 目标达成\n| 目标 | 计划 | 实际 | 达成率 |\n## 3. 亮点\n## 4. 不足\n## 5. 经验沉淀\n## 6. 改进动作\n",
    promptTemplate:
      "你是一位项目经理。请基于以下信息撰写项目复盘报告，含目标达成、亮点、不足、经验、改进：\n项目：{{project}}\n周期：{{period}}\n目标与实际：{{results}}\n关键事件：{{events}}",
  },

  // ============ 内容创作者 (creator) ============
  {
    name: "选题策划",
    description: "内容选题策划方法，含热点、痛点、差异化",
    category: "creator",
    content:
      "# 选题策划\n\n## 1. 受众画像\n## 2. 选题来源\n- 热点\n- 痛点\n- 评论\n- 对标\n## 3. 选题评估\n| 选题 | 流量潜力 | 差异化 | 可执行性 |\n## 4. 排期\n",
    promptTemplate:
      "你是一位内容策划专家。请基于以下信息输出选题清单，含选题来源、评估、排期：\n账号定位：{{positioning}}\n目标受众：{{audience}}\n平台：{{platform}}\n产出频率：{{frequency}}",
  },
  {
    name: "内容大纲",
    description: "内容大纲结构模板，含钩子、主体、结尾",
    category: "creator",
    content:
      "# 内容大纲\n\n## 标题\n## 钩子（前 3 秒/前 100 字）\n## 主体\n### 要点 1\n### 要点 2\n### 要点 3\n## 案例/数据\n## 结尾（行动召唤）\n## 标签\n",
    promptTemplate:
      "你是一位内容创作者。请基于以下选题输出内容大纲，含钩子、主体要点、案例、结尾：\n选题：{{topic}}\n形式：{{format}}\n平台：{{platform}}\n目标：{{goal}}",
  },
  {
    name: "标题优化",
    description: "标题优化方法，含结构、关键词、情绪点",
    category: "creator",
    content:
      "# 标题优化\n\n## 标题公式\n- 数字+利益：3 个方法让你...\n- 提问：为什么...？\n- 对比：A vs B\n- 悬念：没想到...\n\n## 关键词\n## 情绪点\n## A/B 测试\n",
    promptTemplate:
      "你是一位标题优化专家。请基于以下内容生成 5 个备选标题，并说明各自的钩子策略：\n内容摘要：{{summary}}\n平台：{{platform}}\n目标受众：{{audience}}\n调性：{{tone}}",
  },
  {
    name: "排版规范",
    description: "图文/视频排版规范，统一视觉风格",
    category: "creator",
    content:
      "# 排版规范\n\n## 字体\n- 标题：\n- 正文：\n## 间距\n- 行距：\n- 段距：\n## 配色\n## 图片\n- 封面尺寸：\n- 正文配图：\n## 标点\n## 结构标记\n",
    promptTemplate:
      "你是一位内容排版专家。请基于以下信息输出排版规范，含字体、间距、配色、图片、标点：\n平台：{{platform}}\n内容类型：{{contentType}}\n品牌调性：{{brandTone}}\n参考账号：{{references}}",
  },
  {
    name: "分发策略",
    description: "内容多平台分发策略，含改编、节奏、互动",
    category: "creator",
    content:
      "# 分发策略\n\n## 1. 平台矩阵\n| 平台 | 形式 | 节奏 | 目标 |\n## 2. 内容改编\n## 3. 发布时间\n## 4. 互动机制\n## 5. 数据复盘\n",
    promptTemplate:
      "你是一位内容运营专家。请基于以下信息输出多平台分发策略，含平台矩阵、改编、节奏、互动：\n主内容：{{mainContent}}\n目标平台：{{platforms}}\n核心目标：{{goal}}\n产能：{{capacity}}",
  },

  // ============ 创业者 (founder) ============
  {
    name: "商业计划书",
    description: "商业计划书（BP）撰写框架，含问题、方案、市场、模式",
    category: "founder",
    content:
      "# 商业计划书\n\n## 1. 问题与机会\n## 2. 解决方案\n## 3. 市场规模\n## 4. 商业模式\n## 5. 竞争分析\n## 6. 团队\n## 7. 数据与里程碑\n## 8. 融资计划\n",
    promptTemplate:
      "你是一位创业顾问。请基于以下信息撰写商业计划书，含问题、方案、市场、模式、竞争、团队、融资：\n项目名：{{project}}\n一句话介绍：{{pitch}}\n阶段：{{stage}}\n核心数据：{{metrics}}",
  },
  {
    name: "融资BP",
    description: "面向投资人的融资路演 BP 模板",
    category: "founder",
    content:
      "# 融资 BP\n\n## 封面\n## 问题\n## 方案\n## 市场（TAM/SAM/SOM）\n## 产品\n## 商业模式\n## 数据\n## 竞争\n## 团队\n## 财务预测\n## 融资需求\n",
    promptTemplate:
      "你是一位融资顾问。请基于以下信息生成融资 BP 大纲与要点，含问题、方案、市场、模式、数据、团队、融资：\n项目：{{project}}\n轮次：{{round}}\n融资额：{{amount}}\n亮点：{{highlights}}",
  },
  {
    name: "团队管理",
    description: "创业团队管理框架，含招聘、文化、绩效",
    category: "founder",
    content:
      "# 团队管理\n\n## 1. 组织架构\n## 2. 招聘规划\n## 3. 文化建设\n- 价值观\n- 仪式\n## 4. 目标管理（OKR）\n## 5. 激励机制\n## 6. 沟通机制\n",
    promptTemplate:
      "你是一位创业团队管理顾问。请基于以下信息输出团队管理方案，含架构、招聘、文化、绩效、激励：\n公司阶段：{{stage}}\n团队规模：{{size}}\n业务方向：{{business}}\n管理痛点：{{painPoints}}",
  },
  {
    name: "战略规划",
    description: "公司战略规划框架，含愿景、目标、路径",
    category: "founder",
    content:
      "# 战略规划\n\n## 1. 愿景与使命\n## 2. 战略目标（3 年）\n## 3. 年度目标\n## 4. 关键路径\n## 5. 资源配置\n## 6. 风险与应对\n## 7. 复盘机制\n",
    promptTemplate:
      "你是一位战略顾问。请基于以下信息输出战略规划，含愿景、3 年目标、年度目标、关键路径、资源：\n公司：{{company}}\n行业：{{industry}}\n当前阶段：{{stage}}\n核心优势：{{strengths}}",
  },
  {
    name: "OKR制定",
    description: "OKR 制定模板，含目标、关键结果、对齐",
    category: "founder",
    content:
      "# OKR\n\n## 周期：\n## Objective\n## Key Results\n| KR | 基线 | 目标 | 当前 |\n## 对齐关系\n## 风险\n## 复盘节奏\n",
    promptTemplate:
      "你是一位 OKR 教练。请基于以下信息制定 OKR，含目标、3-5 条关键结果、对齐关系、风险：\n周期：{{period}}\n团队：{{team}}\n战略目标：{{strategy}}\n当前基线：{{baseline}}",
  },
];

// ============ 主流程 ============

async function upsertSkill(skill: PresetSkill): Promise<boolean> {
  // 按 name + category + userId(null) 查找既有预置技能（系统预置无归属用户）
  const existing = await prisma.skill.findFirst({
    where: {
      name: skill.name,
      category: skill.category,
      userId: null,
      source: "manual",
    },
  });

  const data = {
    name: skill.name,
    description: skill.description,
    category: skill.category,
    content: skill.content,
    promptTemplate: skill.promptTemplate,
    source: "manual",
    isPublic: false,
    userId: null,
  };

  if (existing) {
    await prisma.skill.update({
      where: { id: existing.id },
      data,
    });
    return false;
  }

  await prisma.skill.create({
    data,
  });
  return true;
}

async function main() {
  console.log("🌱 开始写入预置技能...");

  let created = 0;
  let updated = 0;

  for (const skill of PRESET_SKILLS) {
    const isCreated = await upsertSkill(skill);
    if (isCreated) {
      created++;
    } else {
      updated++;
    }
  }

  console.log(`✅ 已写入 ${PRESET_SKILLS.length} 个预置技能（新增 ${created}，更新 ${updated}）`);
}

main()
  .catch((e) => {
    console.error("❌ 写入预置技能失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
