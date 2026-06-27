import { useState, useRef, useEffect } from "react";
import { Send, Bot, User, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { invoke } from "@/lib/tauri";
import { HelpButton } from "@/components/ui/HelpButton";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  time: string;
  streaming?: boolean;
}

const SUGGESTIONS = [
  "今天有哪些任务需要聚焦？",
  "帮我分析最近的灵感趋势",
  "从认知库中找一条方法论",
  "快速捕获一条灵感",
];

export function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "你好，我是 Lynn。有什么我可以帮你的吗？",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input.trim(),
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await invoke<{ output?: string; success?: boolean; error?: string }>(
        "execute_assistant_command",
        { command: userMsg.content }
      );
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.output || res.error || "我已收到你的请求。",
        time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: `请求失败：${err?.message || String(err)}`,
          time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto flex h-full max-w-4xl flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">AI 专属助理</h1>
          <p className="mt-1 text-sm text-muted-foreground">直接说， Lynn 来帮你执行</p>
        </div>
        <HelpButton module="ai-assistant" />
      </div>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-auto rounded-2xl border border-border/40 bg-muted/20 p-4"
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Lynn 正在思考...
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setInput(s)}
              className="ios-pill text-xs"
            >
              <Sparkles className="h-3 w-3 text-primary" />
              {s}
            </button>
          ))}
        </div>

        <div className="glass-card flex items-end gap-2 p-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入指令，按 Enter 发送..."
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl bg-transparent px-3 py-2.5 text-sm outline-none placeholder:text-muted-foreground"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary-glass flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const [copied, setCopied] = useState(false);
  const isUser = message.role === "user";

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser ? "bg-primary/10 text-primary" : "bg-primary text-primary-foreground"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>
      <div className={cn("flex max-w-[80%] flex-col", isUser && "items-end")}>
        <div
          className={cn(
            "relative rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
            isUser ? "bg-primary text-primary-foreground" : "glass-card"
          )}
        >
          {message.content}
          {!isUser && (
            <button
              onClick={copy}
              className="absolute -right-8 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-primary/10 hover:text-foreground group-hover:opacity-100"
              title="复制"
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>
        <span className="mt-1 text-[10px] text-muted-foreground">{message.time}</span>
      </div>
    </motion.div>
  );
}
