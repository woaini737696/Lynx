"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Search, Command, ArrowRight, Target, Inbox, Brain, BookOpen, KanbanSquare, Skull, Moon, Settings, Sparkles, LayoutGrid, Workflow, Bot, Clock, TrendingUp, Zap, Terminal, Star } from "lucide-react";
import { cn } from "@/lib/utils";

type SearchResult = {
  id: string;
  title: string;
  subtitle?: string;
  type: "task" | "idea" | "cognition" | "memory" | "skill" | "nav";
  href: string;
  icon: React.ElementType;
  color: string;
};

type FilterTab = "all" | "nav" | "task" | "idea" | "cognition" | "memory" | "skill";

type QuickCommand = {
  id: string;
  input: string;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  kind: "navigate" | "event" | "search";
  target?: string;
};

const NAV_RESULTS: SearchResult[] = [
  { id: "nav-focus", title: "今日聚焦", type: "nav", href: "/", icon: Target, color: "text-northstar" },
  { id: "nav-board", title: "决策看板", type: "nav", href: "/board", icon: KanbanSquare, color: "text-campaign" },
  { id: "nav-inbox", title: "Inbox", type: "nav", href: "/inbox", icon: Inbox, color: "text-foreground" },
  { id: "nav-assets", title: "对话资产", type: "nav", href: "/assets", icon: Sparkles, color: "text-campaign" },
  { id: "nav-cognition", title: "认知库", type: "nav", href: "/cognition", icon: BookOpen, color: "text-cognition" },
  { id: "nav-memory", title: "记忆图谱", type: "nav", href: "/memory", icon: Brain, color: "text-cognition" },
  { id: "nav-graveyard", title: "灵感墓地", type: "nav", href: "/graveyard", icon: Skull, color: "text-graveyard" },
  { id: "nav-converge", title: "灵感收敛", type: "nav", href: "/converge", icon: Moon, color: "text-northstar" },
  { id: "nav-settings", title: "设置", type: "nav", href: "/settings", icon: Settings, color: "text-muted-foreground" },
  { id: "nav-skills", title: "技能库", type: "nav", href: "/skills", icon: Star, color: "text-campaign" },
  { id: "nav-ai-workspace", title: "AI 工作空间", type: "nav", href: "/ai/workspace", icon: LayoutGrid, color: "text-cognition" },
  { id: "nav-ai-flows", title: "AI 工作流", type: "nav", href: "/ai/flows", icon: Workflow, color: "text-cognition" },
  { id: "nav-ai-assistant", title: "Lynx超级助理", type: "nav", href: "/ai/assistant", icon: Bot, color: "text-cognition" },
];

const TYPE_LABELS: Record<SearchResult["type"], string> = {
  task: "任务",
  idea: "灵感",
  cognition: "认知",
  memory: "记忆",
  skill: "技能",
  nav: "页面",
};

const TABS: { key: FilterTab; label: string }[] = [
  { key: "all", label: "全部" },
  { key: "nav", label: "页面" },
  { key: "task", label: "任务" },
  { key: "idea", label: "灵感" },
  { key: "cognition", label: "认知" },
  { key: "memory", label: "记忆" },
  { key: "skill", label: "技能" },
];

const RECENT_KEY = "lynnhub:recent-searches";
const MAX_RECENT = 8;

// 空状态高频推荐（基于产品核心路径）
const TRENDING: SearchResult[] = [
  { id: "trend-1", title: "今日聚焦", subtitle: "查看今天的北极星任务", type: "nav", href: "/", icon: Target, color: "text-northstar" },
  { id: "trend-2", title: "决策看板", subtitle: "管理进行中的战役", type: "nav", href: "/board", icon: KanbanSquare, color: "text-campaign" },
  { id: "trend-3", title: "Inbox", subtitle: "处理待分类灵感", type: "nav", href: "/inbox", icon: Inbox, color: "text-foreground" },
  { id: "trend-4", title: "记忆图谱", subtitle: "探索知识关联", type: "nav", href: "/memory", icon: Brain, color: "text-cognition" },
  { id: "trend-5", title: "Lynx超级助理", subtitle: "与 AI 对话", type: "nav", href: "/ai/assistant", icon: Bot, color: "text-cognition" },
];

// 快捷命令（输入 > 开头触发）
const QUICK_COMMANDS: QuickCommand[] = [
  { id: "cmd-board", input: "board", label: "跳转到 决策看板", description: "/board", icon: KanbanSquare, color: "text-campaign", kind: "navigate", target: "/board" },
  { id: "cmd-memory", input: "memory", label: "跳转到 记忆图谱", description: "/memory", icon: Brain, color: "text-cognition", kind: "navigate", target: "/memory" },
  { id: "cmd-inbox", input: "inbox", label: "跳转到 Inbox", description: "/inbox", icon: Inbox, color: "text-foreground", kind: "navigate", target: "/inbox" },
  { id: "cmd-cognition", input: "cognition", label: "跳转到 认知库", description: "/cognition", icon: BookOpen, color: "text-cognition", kind: "navigate", target: "/cognition" },
  { id: "cmd-graveyard", input: "graveyard", label: "跳转到 灵感墓地", description: "/graveyard", icon: Skull, color: "text-graveyard", kind: "navigate", target: "/graveyard" },
  { id: "cmd-converge", input: "converge", label: "跳转到 灵感收敛", description: "/converge", icon: Moon, color: "text-northstar", kind: "navigate", target: "/converge" },
  { id: "cmd-assets", input: "assets", label: "跳转到 对话资产", description: "/assets", icon: Sparkles, color: "text-campaign", kind: "navigate", target: "/assets" },
  { id: "cmd-settings", input: "settings", label: "跳转到 设置", description: "/settings", icon: Settings, color: "text-muted-foreground", kind: "navigate", target: "/settings" },
  { id: "cmd-ai", input: "ai", label: "跳转到 AI 工作空间", description: "/ai/workspace", icon: LayoutGrid, color: "text-cognition", kind: "navigate", target: "/ai/workspace" },
  { id: "cmd-flows", input: "flows", label: "跳转到 AI 工作流", description: "/ai/flows", icon: Workflow, color: "text-cognition", kind: "navigate", target: "/ai/flows" },
  { id: "cmd-assistant", input: "assistant", label: "跳转到 Lynx超级助理", description: "/ai/assistant", icon: Bot, color: "text-cognition", kind: "navigate", target: "/ai/assistant" },
  { id: "cmd-lark", input: "lark", label: "跳转到 飞书任务", description: "/ai/lark-tasks", icon: Bot, color: "text-cognition", kind: "navigate", target: "/ai/lark-tasks" },
  { id: "cmd-skills", input: "skills", label: "跳转到 技能库", description: "/skills", icon: Star, color: "text-campaign", kind: "navigate", target: "/skills" },
  { id: "cmd-new", input: "new", label: "打开闪电输入", description: "触发闪电输入", icon: Zap, color: "text-northstar", kind: "event", target: "lynnhub:open-lightning" },
  { id: "cmd-search", input: "search", label: "全局搜索", description: ">search 关键词", icon: Search, color: "text-foreground", kind: "search" },
];

// 拼音首字母映射表（覆盖页面名称、常见任务/灵感/认知/记忆关键词，去重）
const PINYIN_MAP: Record<string, string> = {
  // a
  "阿": "a", "爱": "a", "安": "a", "暗": "a", "案": "a",
  // b
  "把": "b", "白": "b", "百": "b", "班": "b", "板": "b", "半": "b", "办": "b", "伴": "b", "包": "b", "保": "b", "宝": "b", "报": "b", "北": "b", "备": "b", "本": "b", "比": "b", "笔": "b", "必": "b", "毕": "b", "闭": "b", "避": "b", "边": "b", "变": "b", "标": "b", "表": "b", "别": "b", "病": "b", "不": "b", "步": "b", "部": "b", "倍": "b", "薄": "b",
  // c
  "才": "c", "材": "c", "财": "c", "采": "c", "菜": "c", "参": "c", "餐": "c", "册": "c", "侧": "c", "测": "c", "策": "c", "层": "c", "查": "c", "察": "c", "产": "c", "长": "c", "场": "c", "常": "c", "厂": "c", "创": "c", "词": "c", "此": "c", "次": "c", "从": "c", "聪": "c", "粗": "c", "促": "c", "存": "c", "错": "c", "处": "c", "除": "c", "持": "c", "出": "c", "充": "c", "冲": "c", "触": "c", "传": "c", "成": "c", "城": "c", "程": "c", "操": "c", "藏": "c", "辞": "c", "磁": "c", "脆": "c", "措": "c",
  // d
  "打": "d", "大": "d", "代": "d", "带": "d", "待": "d", "单": "d", "但": "d", "当": "d", "到": "d", "道": "d", "得": "d", "的": "d", "地": "d", "点": "d", "电": "d", "动": "d", "都": "d", "对": "d", "多": "d", "顿": "d", "低": "d", "底": "d", "短": "d", "段": "d", "断": "d", "独": "d", "读": "d", "度": "d", "定": "d", "东": "d", "冬": "d", "导": "d", "岛": "d", "档": "d", "灯": "d", "等": "d", "第": "d", "典": "d", "掉": "d", "顶": "d", "订": "d", "丢": "d", "懂": "d", "洞": "d", "斗": "d", "豆": "d", "毒": "d", "端": "d", "队": "d", "吨": "d",
  // e
  "而": "e", "儿": "e", "耳": "e", "二": "e", "恶": "e", "饿": "e", "额": "e", "恩": "e",
  // f
  "发": "f", "法": "f", "反": "f", "返": "f", "范": "f", "方": "f", "房": "f", "防": "f", "访": "f", "放": "f", "飞": "f", "非": "f", "费": "f", "分": "f", "纷": "f", "粉": "f", "丰": "f", "风": "f", "封": "f", "否": "f", "夫": "f", "服": "f", "浮": "f", "符": "f", "福": "f", "父": "f", "复": "f", "负": "f", "附": "f", "赋": "f", "妇": "f", "凡": "f", "烦": "f", "繁": "f", "翻": "f", "废": "f", "沸": "f", "肺": "f", "芬": "f", "坟": "f", "奋": "f", "份": "f",
  // g
  "改": "g", "盖": "g", "干": "g", "感": "g", "刚": "g", "高": "g", "搞": "g", "告": "g", "歌": "g", "格": "g", "个": "g", "各": "g", "给": "g", "根": "g", "更": "g", "工": "g", "公": "g", "共": "g", "关": "g", "观": "g", "管": "g", "光": "g", "广": "g", "归": "g", "规": "g", "过": "g", "国": "g", "果": "g", "功": "g", "故": "g", "顾": "g", "固": "g", "挂": "g", "怪": "g", "官": "g", "馆": "g", "贯": "g", "惯": "g", "轨": "g", "贵": "g", "滚": "g", "锅": "g",
  // h
  "哈": "h", "还": "h", "海": "h", "害": "h", "含": "h", "寒": "h", "汉": "h", "行": "h", "好": "h", "号": "h", "合": "h", "何": "h", "和": "h", "河": "h", "黑": "h", "很": "h", "红": "h", "后": "h", "候": "h", "护": "h", "花": "h", "化": "h", "话": "h", "坏": "h", "换": "h", "黄": "h", "回": "h", "会": "h", "活": "h", "火": "h", "或": "h", "货": "h", "获": "h", "湖": "h", "互": "h", "户": "h", "忽": "h", "呼": "h", "糊": "h", "虎": "h", "画": "h", "划": "h", "怀": "h", "欢": "h", "环": "h", "缓": "h", "幻": "h", "荒": "h", "慌": "h", "皇": "h", "灰": "h", "挥": "h", "辉": "h", "悔": "h", "汇": "h", "婚": "h", "惑": "h",
  // j
  "机": "j", "积": "j", "基": "j", "级": "j", "极": "j", "集": "j", "几": "j", "己": "j", "计": "j", "记": "j", "纪": "j", "技": "j", "际": "j", "济": "j", "继": "j", "加": "j", "家": "j", "假": "j", "价": "j", "坚": "j", "间": "j", "检": "j", "减": "j", "简": "j", "见": "j", "建": "j", "剑": "j", "健": "j", "将": "j", "江": "j", "讲": "j", "奖": "j", "交": "j", "郊": "j", "浇": "j", "骄": "j", "教": "j", "接": "j", "阶": "j", "节": "j", "结": "j", "截": "j", "解": "j", "介": "j", "界": "j", "借": "j", "进": "j", "近": "j", "今": "j", "金": "j", "紧": "j", "仅": "j", "尽": "j", "劲": "j", "经": "j", "精": "j", "警": "j", "境": "j", "静": "j", "旧": "j", "就": "j", "居": "j", "局": "j", "举": "j", "句": "j", "具": "j", "聚": "j", "决": "j", "绝": "j", "觉": "j", "军": "j", "均": "j", "俊": "j", "即": "j", "急": "j", "疾": "j", "忌": "j", "剂": "j", "寂": "j", "寄": "j", "佳": "j", "嘉": "j", "甲": "j", "兼": "j", "监": "j", "尖": "j", "煎": "j", "拣": "j", "俭": "j", "剪": "j", "鉴": "j", "键": "j", "箭": "j", "僵": "j", "疆": "j", "桨": "j", "胶": "j", "焦": "j", "角": "j", "脚": "j", "搅": "j", "缴": "j", "绞": "j", "较": "j", "竭": "j", "捷": "j", "姐": "j", "巾": "j", "筋": "j", "津": "j", "锦": "j", "谨": "j", "晋": "j", "禁": "j", "京": "j", "茎": "j", "惊": "j", "晶": "j", "睛": "j", "井": "j", "镜": "j", "敬": "j", "竞": "j", "净": "j", "纠": "j", "酒": "j", "救": "j", "舅": "j", "拘": "j", "驹": "j", "菊": "j", "矩": "j", "巨": "j", "拒": "j", "俱": "j", "剧": "j", "据": "j", "距": "j", "惧": "j", "锯": "j", "捐": "j", "卷": "j", "诀": "j", "掘": "j", "君": "j", "竣": "j",
  // k
  "开": "k", "看": "k", "康": "k", "考": "k", "靠": "k", "可": "k", "克": "k", "客": "k", "课": "k", "空": "k", "孔": "k", "口": "k", "枯": "k", "苦": "k", "库": "k", "快": "k", "宽": "k", "款": "k", "狂": "k", "况": "k", "矿": "k", "亏": "k", "昆": "k", "困": "k", "扩": "k", "括": "k", "卡": "k", "咖": "k", "凯": "k", "刊": "k", "勘": "k", "坎": "k", "砍": "k", "慷": "k", "扛": "k", "抗": "k", "炕": "k", "烤": "k", "科": "k", "棵": "k", "颗": "k", "壳": "k", "渴": "k", "刻": "k", "肯": "k", "恳": "k", "坑": "k", "恐": "k", "控": "k", "扣": "k", "哭": "k", "窟": "k", "酷": "k", "裤": "k", "块": "k", "筷": "k", "旷": "k", "葵": "k", "奎": "k", "魁": "k", "馈": "k", "捆": "k", "阔": "k",
  // l
  "拉": "l", "来": "l", "蓝": "l", "览": "l", "劳": "l", "老": "l", "乐": "l", "了": "l", "雷": "l", "类": "l", "累": "l", "冷": "l", "里": "l", "理": "l", "力": "l", "历": "l", "立": "l", "利": "l", "连": "l", "联": "l", "怜": "l", "脸": "l", "链": "l", "两": "l", "亮": "l", "量": "l", "料": "l", "列": "l", "林": "l", "临": "l", "灵": "l", "领": "l", "令": "l", "另": "l", "留": "l", "流": "l", "六": "l", "龙": "l", "楼": "l", "陆": "l", "录": "l", "路": "l", "律": "l", "绿": "l", "乱": "l", "略": "l", "论": "l", "落": "l", "兰": "l", "拦": "l", "栏": "l", "烂": "l", "郎": "l", "廊": "l", "朗": "l", "浪": "l", "捞": "l", "牢": "l", "佬": "l", "勒": "l", "蕾": "l", "磊": "l", "垒": "l", "泪": "l", "棱": "l", "愣": "l", "厘": "l", "梨": "l", "犁": "l", "黎": "l", "礼": "l", "李": "l", "丽": "l", "励": "l", "例": "l", "隶": "l", "粒": "l", "廉": "l", "莲": "l", "恋": "l", "良": "l", "凉": "l", "梁": "l", "粮": "l", "谅": "l", "僚": "l", "辽": "l", "劣": "l", "烈": "l", "猎": "l", "邻": "l", "伶": "l", "岭": "l", "溜": "l", "笼": "l", "隆": "l", "漏": "l", "露": "l", "卢": "l", "芦": "l", "炉": "l", "鲁": "l", "鹿": "l", "驴": "l", "旅": "l", "铝": "l", "率": "l", "掠": "l", "伦": "l", "轮": "l", "罗": "l", "螺": "l", "络": "l",
  // m
  "马": "m", "吗": "m", "买": "m", "卖": "m", "满": "m", "慢": "m", "忙": "m", "毛": "m", "冒": "m", "帽": "m", "貌": "m", "么": "m", "没": "m", "每": "m", "美": "m", "门": "m", "们": "m", "梦": "m", "米": "m", "密": "m", "蜜": "m", "面": "m", "苗": "m", "秒": "m", "庙": "m", "民": "m", "明": "m", "名": "m", "命": "m", "模": "m", "磨": "m", "末": "m", "莫": "m", "母": "m", "墓": "m", "幕": "m", "木": "m", "目": "m", "牧": "m", "麻": "m", "码": "m", "蚂": "m", "骂": "m", "麦": "m", "脉": "m", "蛮": "m", "曼": "m", "漫": "m", "盲": "m", "茫": "m", "芒": "m", "莽": "m", "矛": "m", "茂": "m", "贸": "m", "玫": "m", "枚": "m", "梅": "m", "媒": "m", "煤": "m", "眉": "m", "镁": "m", "妹": "m", "媚": "m", "萌": "m", "蒙": "m", "盟": "m", "猛": "m", "弥": "m", "迷": "m", "谜": "m", "秘": "m", "绵": "m", "棉": "m", "免": "m", "勉": "m", "描": "m", "灭": "m", "敏": "m", "鸣": "m", "谬": "m", "摸": "m", "膜": "m", "摩": "m", "魔": "m", "抹": "m", "墨": "m", "默": "m", "慕": "m", "暮": "m", "穆": "m",
  // n
  "拿": "n", "那": "n", "乃": "n", "奶": "n", "南": "n", "难": "n", "脑": "n", "闹": "n", "内": "n", "能": "n", "你": "n", "年": "n", "念": "n", "娘": "n", "鸟": "n", "宁": "n", "牛": "n", "农": "n", "弄": "n", "女": "n", "怒": "n", "暖": "n", "诺": "n", "哪": "n", "纳": "n", "娜": "n", "耐": "n", "男": "n", "囊": "n", "嫩": "n", "尼": "n", "泥": "n", "拟": "n", "逆": "n", "尿": "n", "捏": "n", "扭": "n", "纽": "n", "浓": "n", "奴": "n", "努": "n", "虐": "n",
  // o
  "哦": "o", "欧": "o", "偶": "o", "藕": "o",
  // p
  "拍": "p", "排": "p", "牌": "p", "派": "p", "盘": "p", "盼": "p", "旁": "p", "胖": "p", "抛": "p", "跑": "p", "配": "p", "喷": "p", "盆": "p", "朋": "p", "棚": "p", "蓬": "p", "批": "p", "皮": "p", "疲": "p", "匹": "p", "屁": "p", "篇": "p", "偏": "p", "片": "p", "漂": "p", "票": "p", "拼": "p", "贫": "p", "频": "p", "品": "p", "平": "p", "瓶": "p", "屏": "p", "坡": "p", "破": "p", "剖": "p", "铺": "p", "普": "p", "谱": "p", "朴": "p", "迫": "p", "庞": "p", "陪": "p", "培": "p", "赔": "p", "佩": "p", "鹏": "p", "披": "p", "劈": "p", "琵": "p", "僻": "p", "飘": "p", "瞥": "p", "聘": "p", "乒": "p", "苹": "p", "评": "p", "凭": "p", "泼": "p", "颇": "p", "婆": "p", "魄": "p",
  // q
  "七": "q", "期": "q", "齐": "q", "奇": "q", "骑": "q", "旗": "q", "企": "q", "起": "q", "气": "q", "弃": "q", "恰": "q", "千": "q", "迁": "q", "签": "q", "前": "q", "钱": "q", "潜": "q", "浅": "q", "欠": "q", "强": "q", "抢": "q", "悄": "q", "敲": "q", "桥": "q", "瞧": "q", "切": "q", "亲": "q", "勤": "q", "青": "q", "轻": "q", "清": "q", "情": "q", "晴": "q", "请": "q", "顷": "q", "穷": "q", "秋": "q", "求": "q", "球": "q", "区": "q", "曲": "q", "取": "q", "去": "q", "趣": "q", "全": "q", "权": "q", "劝": "q", "确": "q", "群": "q", "妻": "q", "欺": "q", "祈": "q", "乞": "q", "启": "q", "迄": "q", "汽": "q", "洽": "q", "牵": "q", "铅": "q", "谦": "q", "枪": "q", "腔": "q", "墙": "q", "巧": "q", "茄": "q", "钦": "q", "氢": "q", "驱": "q", "屈": "q", "趋": "q",
  // r
  "然": "r", "燃": "r", "让": "r", "绕": "r", "惹": "r", "热": "r", "人": "r", "忍": "r", "认": "r", "任": "r", "扔": "r", "仍": "r", "日": "r", "容": "r", "融": "r", "柔": "r", "肉": "r", "如": "r", "入": "r", "软": "r", "锐": "r", "瑞": "r", "润": "r", "若": "r", "弱": "r", "染": "r", "壤": "r", "嚷": "r", "饶": "r", "扰": "r", "妊": "r", "戎": "r", "荣": "r", "熔": "r", "乳": "r",
  // s
  "撒": "s", "赛": "s", "三": "s", "散": "s", "色": "s", "森": "s", "杀": "s", "沙": "s", "傻": "s", "筛": "s", "晒": "s", "山": "s", "闪": "s", "善": "s", "伤": "s", "商": "s", "上": "s", "烧": "s", "少": "s", "绍": "s", "舍": "s", "设": "s", "社": "s", "射": "s", "涉": "s", "申": "s", "身": "s", "深": "s", "神": "s", "生": "s", "声": "s", "胜": "s", "剩": "s", "失": "s", "十": "s", "时": "s", "实": "s", "识": "s", "史": "s", "使": "s", "始": "s", "世": "s", "市": "s", "试": "s", "事": "s", "势": "s", "视": "s", "适": "s", "收": "s", "手": "s", "守": "s", "首": "s", "寿": "s", "受": "s", "授": "s", "售": "s", "书": "s", "殊": "s", "输": "s", "熟": "s", "暑": "s", "属": "s", "树": "s", "数": "s", "帅": "s", "双": "s", "谁": "s", "水": "s", "睡": "s", "说": "s", "丝": "s", "思": "s", "私": "s", "司": "s", "死": "s", "四": "s", "似": "s", "松": "s", "宋": "s", "搜": "s", "苏": "s", "俗": "s", "素": "s", "速": "s", "宿": "s", "塑": "s", "酸": "s", "算": "s", "虽": "s", "随": "s", "岁": "s", "碎": "s", "孙": "s", "缩": "s", "锁": "s", "所": "s", "索": "s", "扫": "s", "塞": "s", "伞": "s", "桑": "s", "嗓": "s", "丧": "s", "骚": "s", "嫂": "s", "纱": "s", "煞": "s", "删": "s", "陕": "s", "擅": "s", "膳": "s", "扇": "s", "赏": "s", "尚": "s", "稍": "s", "哨": "s", "邵": "s", "奢": "s", "赊": "s", "蛇": "s", "摄": "s", "伸": "s", "沈": "s", "审": "s", "婶": "s", "肾": "s", "甚": "s", "渗": "s", "慎": "s", "升": "s", "牲": "s", "尸": "s", "师": "s", "诗": "s", "施": "s", "狮": "s", "拾": "s", "石": "s", "矢": "s", "驶": "s", "氏": "s", "侍": "s", "释": "s", "枢": "s", "抒": "s", "蔬": "s", "鼠": "s", "署": "s", "蜀": "s", "术": "s", "束": "s", "竖": "s", "甩": "s", "拴": "s", "霜": "s", "爽": "s", "税": "s", "斯": "s", "撕": "s", "寺": "s", "耸": "s", "送": "s", "蒜": "s", "穗": "s", "损": "s",
  // t
  "塌": "t", "他": "t", "她": "t", "它": "t", "台": "t", "太": "t", "谈": "t", "坦": "t", "探": "t", "汤": "t", "堂": "t", "塘": "t", "趟": "t", "逃": "t", "桃": "t", "陶": "t", "套": "t", "特": "t", "疼": "t", "提": "t", "题": "t", "体": "t", "替": "t", "天": "t", "田": "t", "挑": "t", "条": "t", "跳": "t", "铁": "t", "听": "t", "停": "t", "通": "t", "同": "t", "童": "t", "统": "t", "痛": "t", "头": "t", "投": "t", "透": "t", "突": "t", "图": "t", "徒": "t", "途": "t", "土": "t", "吐": "t", "推": "t", "退": "t", "吞": "t", "托": "t", "脱": "t", "驼": "t", "拓": "t", "抬": "t", "态": "t", "摊": "t", "贪": "t", "毯": "t", "碳": "t", "唐": "t", "膛": "t", "涛": "t", "淘": "t", "腾": "t", "藤": "t", "剔": "t", "梯": "t", "踢": "t", "蹄": "t", "甜": "t", "填": "t", "厅": "t", "烃": "t", "挺": "t", "铜": "t", "偷": "t", "涂": "t", "屠": "t", "兔": "t", "湍": "t", "团": "t", "颓": "t", "腿": "t", "屯": "t", "拖": "t", "陀": "t",
  // w
  "挖": "w", "瓦": "w", "袜": "w", "歪": "w", "外": "w", "弯": "w", "湾": "w", "丸": "w", "完": "w", "玩": "w", "顽": "w", "挽": "w", "晚": "w", "碗": "w", "万": "w", "亡": "w", "王": "w", "往": "w", "忘": "w", "望": "w", "危": "w", "威": "w", "微": "w", "为": "w", "围": "w", "违": "w", "唯": "w", "维": "w", "伟": "w", "伪": "w", "尾": "w", "委": "w", "卫": "w", "未": "w", "文": "w", "闻": "w", "稳": "w", "问": "w", "翁": "w", "我": "w", "握": "w", "污": "w", "屋": "w", "无": "w", "吴": "w", "武": "w", "五": "w", "午": "w", "舞": "w", "物": "w", "务": "w", "误": "w", "悟": "w", "雾": "w", "娃": "w", "蛙": "w", "豌": "w", "婉": "w", "宛": "w", "汪": "w", "窝": "w",
  // x
  "夕": "x", "西": "x", "吸": "x", "希": "x", "息": "x", "悉": "x", "惜": "x", "稀": "x", "溪": "x", "锡": "x", "习": "x", "喜": "x", "戏": "x", "系": "x", "细": "x", "虾": "x", "匣": "x", "侠": "x", "峡": "x", "狭": "x", "下": "x", "夏": "x", "吓": "x", "先": "x", "纤": "x", "掀": "x", "鲜": "x", "闲": "x", "贤": "x", "弦": "x", "咸": "x", "嫌": "x", "衔": "x", "显": "x", "险": "x", "现": "x", "线": "x", "限": "x", "宪": "x", "陷": "x", "相": "x", "香": "x", "厢": "x", "湘": "x", "乡": "x", "详": "x", "祥": "x", "享": "x", "响": "x", "想": "x", "向": "x", "项": "x", "象": "x", "像": "x", "消": "x", "宵": "x", "萧": "x", "销": "x", "小": "x", "晓": "x", "孝": "x", "效": "x", "校": "x", "笑": "x", "些": "x", "歇": "x", "协": "x", "邪": "x", "胁": "x", "斜": "x", "携": "x", "鞋": "x", "写": "x", "泄": "x", "卸": "x", "谢": "x", "心": "x", "辛": "x", "欣": "x", "新": "x", "信": "x", "兴": "x", "星": "x", "形": "x", "型": "x", "醒": "x", "杏": "x", "性": "x", "姓": "x", "凶": "x", "兄": "x", "胸": "x", "雄": "x", "熊": "x", "休": "x", "修": "x", "羞": "x", "朽": "x", "秀": "x", "绣": "x", "锈": "x", "嗅": "x", "须": "x", "虚": "x", "需": "x", "徐": "x", "许": "x", "序": "x", "叙": "x", "续": "x", "蓄": "x", "宣": "x", "悬": "x", "旋": "x", "选": "x", "眩": "x", "削": "x", "学": "x", "穴": "x", "雪": "x", "血": "x", "熏": "x", "寻": "x", "巡": "x", "询": "x", "循": "x", "训": "x", "讯": "x", "迅": "x",
  // y
  "压": "y", "押": "y", "鸦": "y", "鸭": "y", "牙": "y", "崖": "y", "雅": "y", "亚": "y", "咽": "y", "烟": "y", "淹": "y", "盐": "y", "严": "y", "研": "y", "延": "y", "言": "y", "颜": "y", "炎": "y", "沿": "y", "眼": "y", "演": "y", "宴": "y", "验": "y", "央": "y", "扬": "y", "羊": "y", "阳": "y", "杨": "y", "洋": "y", "仰": "y", "养": "y", "样": "y", "妖": "y", "腰": "y", "摇": "y", "遥": "y", "瑶": "y", "咬": "y", "药": "y", "要": "y", "耀": "y", "椰": "y", "爷": "y", "也": "y", "野": "y", "业": "y", "叶": "y", "页": "y", "夜": "y", "一": "y", "伊": "y", "衣": "y", "医": "y", "依": "y", "仪": "y", "宜": "y", "姨": "y", "移": "y", "遗": "y", "疑": "y", "乙": "y", "已": "y", "以": "y", "艺": "y", "忆": "y", "议": "y", "益": "y", "异": "y", "役": "y", "逸": "y", "意": "y", "毅": "y", "因": "y", "阴": "y", "音": "y", "银": "y", "引": "y", "饮": "y", "隐": "y", "印": "y", "应": "y", "英": "y", "樱": "y", "婴": "y", "鹰": "y", "迎": "y", "盈": "y", "营": "y", "蝇": "y", "赢": "y", "硬": "y", "拥": "y", "庸": "y", "永": "y", "咏": "y", "勇": "y", "涌": "y", "用": "y", "优": "y", "忧": "y", "悠": "y", "尤": "y", "由": "y", "邮": "y", "油": "y", "游": "y", "友": "y", "有": "y", "又": "y", "右": "y", "幼": "y", "于": "y", "予": "y", "余": "y", "鱼": "y", "娱": "y", "渔": "y", "逾": "y", "愚": "y", "与": "y", "宇": "y", "语": "y", "玉": "y", "育": "y", "浴": "y", "预": "y", "域": "y", "遇": "y", "御": "y", "裕": "y", "誉": "y", "豫": "y", "元": "y", "园": "y", "员": "y", "原": "y", "圆": "y", "缘": "y", "源": "y", "远": "y", "怨": "y", "院": "y", "愿": "y", "约": "y", "月": "y", "岳": "y", "阅": "y", "跃": "y", "云": "y", "匀": "y", "允": "y", "运": "y", "蕴": "y",
  // z
  "杂": "z", "砸": "z", "灾": "z", "栽": "z", "宰": "z", "载": "z", "再": "z", "在": "z", "咱": "z", "赞": "z", "暂": "z", "脏": "z", "葬": "z", "遭": "z", "糟": "z", "早": "z", "枣": "z", "造": "z", "噪": "z", "燥": "z", "躁": "z", "则": "z", "择": "z", "泽": "z", "责": "z", "怎": "z", "增": "z", "憎": "z", "赠": "z", "扎": "z", "眨": "z", "炸": "z", "榨": "z", "斋": "z", "摘": "z", "宅": "z", "窄": "z", "债": "z", "寨": "z", "沾": "z", "粘": "z", "盏": "z", "展": "z", "占": "z", "战": "z", "站": "z", "绽": "z", "章": "z", "张": "z", "掌": "z", "丈": "z", "仗": "z", "帐": "z", "障": "z", "招": "z", "朝": "z", "着": "z", "找": "z", "召": "z", "兆": "z", "照": "z", "罩": "z", "遮": "z", "折": "z", "哲": "z", "者": "z", "这": "z", "浙": "z", "珍": "z", "真": "z", "诊": "z", "阵": "z", "镇": "z", "震": "z", "争": "z", "征": "z", "挣": "z", "睁": "z", "蒸": "z", "整": "z", "正": "z", "证": "z", "郑": "z", "政": "z", "之": "z", "支": "z", "汁": "z", "芝": "z", "枝": "z", "知": "z", "织": "z", "脂": "z", "蜘": "z", "执": "z", "直": "z", "值": "z", "职": "z", "植": "z", "殖": "z", "止": "z", "只": "z", "旨": "z", "址": "z", "纸": "z", "指": "z", "至": "z", "志": "z", "制": "z", "质": "z", "治": "z", "中": "z", "忠": "z", "终": "z", "钟": "z", "种": "z", "众": "z", "重": "z", "周": "z", "州": "z", "洲": "z", "粥": "z", "轴": "z", "肘": "z", "咒": "z", "宙": "z", "昼": "z", "皱": "z", "骤": "z", "珠": "z", "株": "z", "蛛": "z", "猪": "z", "竹": "z", "烛": "z", "逐": "z", "主": "z", "煮": "z", "嘱": "z", "助": "z", "住": "z", "注": "z", "驻": "z", "柱": "z", "祝": "z", "著": "z", "筑": "z", "抓": "z", "爪": "z", "专": "z", "砖": "z", "转": "z", "赚": "z", "桩": "z", "装": "z", "壮": "z", "状": "z", "撞": "z", "追": "z", "准": "z", "捉": "z", "桌": "z", "卓": "z", "酌": "z", "啄": "z", "资": "z", "姿": "z", "滋": "z", "子": "z", "紫": "z", "字": "z", "自": "z", "宗": "z", "综": "z", "总": "z", "纵": "z", "走": "z", "奏": "z", "租": "z", "足": "z", "族": "z", "阻": "z", "组": "z", "祖": "z", "钻": "z", "嘴": "z", "最": "z", "罪": "z", "醉": "z", "尊": "z", "遵": "z", "昨": "z", "左": "z", "作": "z", "坐": "z", "座": "z", "做": "z",
};

// 取拼音首字母（仅中文字符参与，非中文返回空）
function getInitials(str: string): string {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    result += PINYIN_MAP[str[i]] || "";
  }
  return result;
}

// 取拼音首字母 + 对应原字符位置（用于高亮回填）
function getInitialsWithPositions(str: string): { initials: string; positions: number[] } {
  let initials = "";
  const positions: number[] = [];
  for (let i = 0; i < str.length; i++) {
    const p = PINYIN_MAP[str[i]];
    if (p) {
      initials += p;
      positions.push(i);
    }
  }
  return { initials, positions };
}

// 子序列匹配：query 的字符按顺序出现在 target 中（不要求连续）
function subsequenceMatch(query: string, target: string): boolean {
  if (!query) return true;
  if (!target) return false;
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti].toLowerCase() === query[qi].toLowerCase()) qi++;
  }
  return qi === query.length;
}

// 子序列匹配并返回 target 中匹配字符的索引（用于高亮）
function subsequenceIndices(query: string, target: string): number[] {
  if (!query) return [];
  const indices: number[] = [];
  let qi = 0;
  for (let ti = 0; ti < target.length && qi < query.length; ti++) {
    if (target[ti].toLowerCase() === query[qi].toLowerCase()) {
      indices.push(ti);
      qi++;
    }
  }
  return qi === query.length ? indices : [];
}

// fzf 风格模糊匹配：直接包含 / 子序列 / 拼音首字母
function fuzzyMatch(query: string, target: string): boolean {
  if (!query) return true;
  const lower = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  if (lowerTarget.includes(lower)) return true;
  if (subsequenceMatch(lower, lowerTarget)) return true;
  const initials = getInitials(target).toLowerCase();
  if (initials && subsequenceMatch(lower, initials)) return true;
  return false;
}

// 计算高亮位置：优先直接包含，其次子序列，最后拼音首字母（回填到原字符）
function getMatchIndices(query: string, target: string): number[] {
  if (!query) return [];
  const lower = query.toLowerCase();
  const lowerTarget = target.toLowerCase();
  const directIdx = lowerTarget.indexOf(lower);
  if (directIdx >= 0) {
    return Array.from({ length: lower.length }, (_, i) => directIdx + i);
  }
  const subIdx = subsequenceIndices(lower, lowerTarget);
  if (subIdx.length > 0) return subIdx;
  const { initials, positions } = getInitialsWithPositions(target);
  if (initials) {
    const initSubIdx = subsequenceIndices(lower, initials.toLowerCase());
    if (initSubIdx.length > 0) {
      return initSubIdx.map((i) => positions[i]).filter((v) => v !== undefined);
    }
  }
  return [];
}

function HighlightedText({ text, indices }: { text: string; indices: number[] }) {
  if (!indices.length) return <>{text}</>;
  const set = new Set(indices);
  const nodes: React.ReactNode[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (set.has(i)) {
      nodes.push(
        <mark key={i} className="rounded bg-primary/25 px-0.5 text-primary">
          {ch}
        </mark>,
      );
    } else {
      nodes.push(<span key={i}>{ch}</span>);
    }
  }
  return <>{nodes}</>;
}

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecent(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

type DisplayItem =
  | { kind: "result"; result: SearchResult }
  | { kind: "command"; command: QuickCommand };

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [recent, setRecent] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // 命令模式解析
  const isCommandMode = query.startsWith(">");
  const afterGt = isCommandMode ? query.slice(1) : "";
  const searchCmdMatch = afterGt.match(/^\s*search\s+(.+)$/i);
  const isSearchCommand = !!searchCmdMatch;
  const searchKeyword = searchCmdMatch ? searchCmdMatch[1].trim() : "";
  const commandQuery = afterGt.replace(/^\s*search\s*.*$/i, "").trim();

  // 全局快捷键 Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // 监听 CaptureBar 搜索按钮触发
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("lynnhub:open-command-palette", handler);
    return () => window.removeEventListener("lynnhub:open-command-palette", handler);
  }, []);

  // 打开时聚焦输入框 + 加载最近搜索
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
      setActiveTab("all");
      setRecent(loadRecent());
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // 搜索逻辑（使用模糊匹配）
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    const lower = q.toLowerCase();
    const navMatches = NAV_RESULTS.filter((r) => fuzzyMatch(lower, r.title));

    const fetchResults: SearchResult[] = [];
    const apis = [
      { url: "/api/tasks", type: "task" as const, icon: KanbanSquare, color: "text-campaign", dataKey: "tasks", titleKey: "content" },
      { url: "/api/ideas", type: "idea" as const, icon: Inbox, color: "text-foreground", dataKey: "ideas", titleKey: "content" },
      { url: "/api/cognitions", type: "cognition" as const, icon: BookOpen, color: "text-cognition", dataKey: "cognitions", titleKey: "content" },
      { url: "/api/memory", type: "memory" as const, icon: Brain, color: "text-cognition", dataKey: "nodes", titleKey: "label" },
      { url: "/api/skills", type: "skill" as const, icon: Star, color: "text-campaign", dataKey: "skills", titleKey: "name" },
    ];

    await Promise.allSettled(
      apis.map(async (api) => {
        try {
          const res = await fetch(api.url);
          if (!res.ok) return;
          const data = await res.json();
          const items = data[api.dataKey] || [];
          items.forEach((item: any) => {
            const title = item[api.titleKey] || "";
            // 技能额外匹配 description
            const desc = api.type === "skill" ? (item.description || "") : "";
            if (fuzzyMatch(lower, title) || (desc && fuzzyMatch(lower, desc))) {
              fetchResults.push({
                id: `${api.type}-${item.id}`,
                title: title.length > 60 ? title.slice(0, 60) + "…" : title,
                subtitle: api.type === "skill" ? (desc || TYPE_LABELS[api.type]) : TYPE_LABELS[api.type],
                type: api.type,
                href: api.type === "task" ? "/board" : api.type === "idea" ? "/inbox" : api.type === "cognition" ? "/cognition" : api.type === "memory" ? "/memory" : api.type === "skill" ? "/skills" : "/",
                icon: api.icon,
                color: api.color,
              });
            }
          });
        } catch {
          // ignore individual API failures
        }
      })
    );

    const combined = [...navMatches, ...fetchResults].slice(0, 30);
    setResults(combined);
    setActiveIndex(0);
    setLoading(false);
  }, []);

  // 防抖搜索：命令模式下若为 >search 关键词，则用关键词搜索；纯命令模式不触发搜索
  useEffect(() => {
    let term = "";
    if (isCommandMode) {
      if (isSearchCommand) {
        term = searchKeyword;
      } else {
        setResults([]);
        return;
      }
    } else {
      term = query;
    }
    const timer = setTimeout(() => doSearch(term), 150);
    return () => clearTimeout(timer);
  }, [query, doSearch, isCommandMode, isSearchCommand, searchKeyword]);

  // 模式切换时重置选中
  useEffect(() => {
    setActiveIndex(0);
  }, [isCommandMode, isSearchCommand]);

  // 按 Tab 筛选
  const filteredResults = activeTab === "all" ? results : results.filter((r) => r.type === activeTab);

  // 命令列表过滤
  const filteredCommands: QuickCommand[] = isCommandMode && !isSearchCommand
    ? QUICK_COMMANDS.filter((cmd) => {
        if (!commandQuery) return true;
        const q = commandQuery.toLowerCase();
        return (
          cmd.input.toLowerCase().includes(q) ||
          cmd.label.toLowerCase().includes(q) ||
          fuzzyMatch(q, cmd.label) ||
          fuzzyMatch(q, cmd.input)
        );
      })
    : [];

  // 统一展示列表
  const displayItems: DisplayItem[] = (() => {
    if (isCommandMode && !isSearchCommand) {
      return filteredCommands.map((c) => ({ kind: "command" as const, command: c }));
    }
    if (isSearchCommand) {
      return results.map((r) => ({ kind: "result" as const, result: r }));
    }
    if (query.trim()) {
      return filteredResults.map((r) => ({ kind: "result" as const, result: r }));
    }
    const base = activeTab === "all" ? TRENDING : filteredResults;
    return base.map((r) => ({ kind: "result" as const, result: r }));
  })();

  // 键盘导航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, displayItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = displayItems[activeIndex];
      if (selected) {
        selectItem(selected);
      }
    } else if (e.key === "Tab" && !isCommandMode) {
      // Tab 键切换筛选器（命令模式下禁用）
      e.preventDefault();
      const idx = TABS.findIndex((t) => t.key === activeTab);
      const next = e.shiftKey ? (idx - 1 + TABS.length) % TABS.length : (idx + 1) % TABS.length;
      setActiveTab(TABS[next].key);
      setActiveIndex(0);
    }
  };

  const selectResult = (result: SearchResult) => {
    // 保存到最近搜索
    const term = isSearchCommand ? searchKeyword : query;
    if (term.trim()) {
      const q = term.trim();
      const next = [q, ...recent.filter((r) => r !== q)].slice(0, MAX_RECENT);
      setRecent(next);
      saveRecent(next);
    }
    router.push(result.href);
    setOpen(false);
  };

  const selectCommand = (cmd: QuickCommand) => {
    if (cmd.kind === "navigate" && cmd.target) {
      router.push(cmd.target);
      setOpen(false);
    } else if (cmd.kind === "event" && cmd.target) {
      window.dispatchEvent(new Event(cmd.target));
      setOpen(false);
    } else if (cmd.kind === "search") {
      // 进入搜索命令模式，等待用户输入关键词
      setQuery(">search ");
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  };

  const selectItem = (item: DisplayItem) => {
    if (item.kind === "command") {
      selectCommand(item.command);
    } else {
      selectResult(item.result);
    }
  };

  // 从最近搜索记录恢复查询
  const restoreSearch = (q: string) => {
    setQuery(q);
    inputRef.current?.focus();
  };

  // 滚动到活跃项
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, activeTab, isCommandMode]);

  if (!open || typeof document === "undefined") return null;

  const showEmpty =
    (isCommandMode && !isSearchCommand && filteredCommands.length === 0 && commandQuery.length > 0) ||
    (isSearchCommand && !loading && results.length === 0) ||
    (!isCommandMode && query.trim() && !loading && displayItems.length === 0);

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center bg-black/30 p-4 pt-[10vh] backdrop-blur-xl"
      onClick={() => setOpen(false)}
    >
      <div
        className="glass-modal flex max-h-[80vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 搜索输入 */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          {isCommandMode ? (
            <Terminal className="h-4 w-4 shrink-0 text-primary" />
          ) : (
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          )}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="搜索任务、灵感、认知、记忆或跳转页面... 输入 > 进入命令模式"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60"
          />
          {loading && (
            <span className="shrink-0 animate-pulse text-[10px] text-muted-foreground">搜索中...</span>
          )}
          <kbd className="ios-glass-sm shrink-0 rounded px-1.5 py-0.5 text-[10px] text-muted-foreground">
            ESC
          </kbd>
        </div>

        {/* 类型筛选 Tab（命令模式下隐藏） */}
        {!isCommandMode && (
          <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
            {TABS.map((tab) => {
              const count = tab.key === "all"
                ? results.length
                : results.filter((r) => r.type === tab.key).length;
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveTab(tab.key);
                    setActiveIndex(0);
                  }}
                  className={cn(
                    "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] transition-colors",
                    activeTab === tab.key
                      ? "bg-primary/10 font-medium text-primary"
                      : "text-muted-foreground hover:bg-primary/10 hover:text-primary hover:text-foreground",
                  )}
                >
                  {tab.label}
                  {query.trim() && count > 0 && (
                    <span className="ios-glass-sm rounded px-1 text-[9px]">{count}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* 搜索结果 */}
        <div ref={listRef} className="flex-1 overflow-y-auto p-2">
          {/* 命令模式：命令列表 */}
          {isCommandMode && !isSearchCommand && (
            <>
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                <Terminal className="h-3 w-3" /> 快捷命令
              </div>
              {displayItems.map((item, idx) => {
                if (item.kind !== "command") return null;
                const cmd = item.command;
                const Icon = cmd.icon;
                const isActive = idx === activeIndex;
                const inputIndices = getMatchIndices(commandQuery, cmd.input);
                const labelIndices = getMatchIndices(commandQuery, cmd.label);
                return (
                  <button
                    key={cmd.id}
                    data-idx={idx}
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => selectItem(item)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                      isActive ? "bg-primary/10" : "hover:bg-primary/10 hover:text-primary",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", cmd.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm text-foreground">
                        <HighlightedText text={cmd.label} indices={labelIndices} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        <span className="text-muted-foreground/70">&gt;</span>
                        <HighlightedText text={cmd.input} indices={inputIndices} />
                        <span className="ml-1.5">{cmd.description}</span>
                      </div>
                    </div>
                    {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                );
              })}
            </>
          )}

          {/* 命令模式：>search 关键词 结果 */}
          {isSearchCommand && !showEmpty && (
            displayItems.map((item, idx) => {
              if (item.kind !== "result") return null;
              const result = item.result;
              const Icon = result.icon;
              const isActive = idx === activeIndex;
              const titleIndices = getMatchIndices(searchKeyword, result.title);
              return (
                <button
                  key={result.id}
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    isActive ? "bg-primary/10" : "hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", result.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-foreground">
                      <HighlightedText text={result.title} indices={titleIndices} />
                    </div>
                    {result.subtitle && (
                      <div className="text-[10px] text-muted-foreground">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="shrink-0 ios-glass-sm rounded px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {TYPE_LABELS[result.type]}
                  </span>
                  {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              );
            })
          )}

          {/* 普通模式：空查询时显示最近搜索 + 高频推荐 */}
          {!isCommandMode && !query.trim() && (
            <>
              {recent.length > 0 && (
                <div className="mb-2">
                  <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    <Clock className="h-3 w-3" /> 最近搜索
                  </div>
                  {recent.map((q) => (
                    <button
                      key={q}
                      onClick={() => restoreSearch(q)}
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-xs text-foreground/80 transition-colors hover:bg-primary/10 hover:text-primary"
                    >
                      <Clock className="h-3 w-3 shrink-0 text-muted-foreground/60" />
                      <span className="flex-1 truncate">{q}</span>
                      <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/40" />
                    </button>
                  ))}
                </div>
              )}
              <div>
                <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  <TrendingUp className="h-3 w-3" /> 高频推荐
                </div>
                {displayItems.map((item, idx) => {
                  if (item.kind !== "result") return null;
                  const result = item.result;
                  const Icon = result.icon;
                  const isActive = idx === activeIndex;
                  return (
                    <button
                      key={result.id}
                      data-idx={idx}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => selectItem(item)}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors",
                        isActive ? "bg-primary/10" : "hover:bg-primary/10 hover:text-primary",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", result.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-foreground">{result.title}</div>
                        {result.subtitle && (
                          <div className="text-[10px] text-muted-foreground">{result.subtitle}</div>
                        )}
                      </div>
                      {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* 普通模式：有查询时显示搜索结果 */}
          {!isCommandMode && query.trim() && !showEmpty && (
            displayItems.map((item, idx) => {
              if (item.kind !== "result") return null;
              const result = item.result;
              const Icon = result.icon;
              const isActive = idx === activeIndex;
              const titleIndices = getMatchIndices(query, result.title);
              return (
                <button
                  key={result.id}
                  data-idx={idx}
                  onMouseEnter={() => setActiveIndex(idx)}
                  onClick={() => selectItem(item)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors",
                    isActive ? "bg-primary/10" : "hover:bg-primary/10 hover:text-primary",
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", result.color)} />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-foreground">
                      <HighlightedText text={result.title} indices={titleIndices} />
                    </div>
                    {result.subtitle && (
                      <div className="text-[10px] text-muted-foreground">{result.subtitle}</div>
                    )}
                  </div>
                  <span className="shrink-0 ios-glass-sm rounded px-1.5 py-0.5 text-[9px] text-muted-foreground">
                    {TYPE_LABELS[result.type]}
                  </span>
                  {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                </button>
              );
            })
          )}

          {/* 空状态 */}
          {showEmpty && (
            <div className="py-10 text-center">
              {isCommandMode ? (
                <Terminal className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              ) : (
                <Search className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
              )}
              <p className="text-sm text-muted-foreground">
                {isCommandMode
                  ? isSearchCommand
                    ? `未找到「${searchKeyword}」相关结果`
                    : `未找到匹配「${commandQuery}」的命令`
                  : `未找到「${query}」相关结果`}
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground/60">
                {isCommandMode
                  ? isSearchCommand
                    ? "试试更换关键词，或检查拼写"
                    : "可用命令：board / memory / inbox / cognition / new / search ..."
                  : "试试切换上方筛选 Tab，或检查关键词拼写"}
              </p>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="ios-glass-sm rounded px-1">↑↓</kbd> 导航
            </span>
            <span className="flex items-center gap-1">
              <kbd className="ios-glass-sm rounded px-1">↵</kbd> 选择
            </span>
            {!isCommandMode && (
              <span className="flex items-center gap-1">
                <kbd className="ios-glass-sm rounded px-1">Tab</kbd> 筛选
              </span>
            )}
            <span className="flex items-center gap-1">
              <kbd className="ios-glass-sm rounded px-1">&gt;</kbd> 命令模式
            </span>
          </div>
          <span className="flex items-center gap-1">
            <Command className="inline h-2.5 w-2.5" />K
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}
