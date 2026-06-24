"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Code,
  Quote,
  Undo,
  Redo,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  /** 初始 HTML 内容 */
  value?: string;
  /** placeholder 提示文字 */
  placeholder?: string;
  /** 内容变化回调，输出 HTML 字符串 */
  onChange?: (html: string) => void;
  /** 最小高度（px），默认 200 */
  minHeight?: number;
  /** 自定义容器类名 */
  className?: string;
}

function ToolbarButton({
  editor,
  active,
  disabled,
  onClick,
  label,
  children,
}: {
  editor: Editor | null;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-muted hover:text-foreground",
        disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
      )}
    >
      {children}
    </button>
  );
}

export function RichTextEditor({
  value = "",
  placeholder = "输入内容...",
  onChange,
  minHeight = 200,
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass:
          "before:float-left before:h-0 before:pointer-events-none before:text-muted-foreground/60 before:content-[attr(data-placeholder)]",
      }),
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none focus:outline-none px-3 py-2 text-xs leading-relaxed text-foreground",
      },
    },
  });

  // 外部 value 变化时同步到编辑器（避免光标跳动，仅在不相等时更新）
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (value !== current && value !== undefined) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  if (!editor) {
    return (
      <div
        className={cn(
          "w-full rounded-xl border border-border bg-background",
          className
        )}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div
      className={cn(
        "w-full overflow-hidden rounded-xl border border-border bg-background focus-within:border-cognition/40 focus-within:ring-2 focus-within:ring-cognition/20",
        className
      )}
    >
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/60 bg-card/50 px-1.5 py-1">
        <ToolbarButton
          editor={editor}
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          label="粗体"
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          label="斜体"
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          label="标题 H2"
        >
          <Heading2 className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          label="标题 H3"
        >
          <Heading3 className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          label="无序列表"
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          label="有序列表"
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          active={editor.isActive("codeBlock")}
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          label="代码块"
        >
          <Code className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          active={editor.isActive("blockquote")}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          label="引用"
        >
          <Quote className="h-3.5 w-3.5" />
        </ToolbarButton>

        <span className="mx-0.5 h-4 w-px bg-border" />

        <ToolbarButton
          editor={editor}
          active={false}
          disabled={!editor.can().undo()}
          onClick={() => editor.chain().focus().undo().run()}
          label="撤销"
        >
          <Undo className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          editor={editor}
          active={false}
          disabled={!editor.can().redo()}
          onClick={() => editor.chain().focus().redo().run()}
          label="重做"
        >
          <Redo className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      {/* 编辑区 */}
      <div className="overflow-y-auto" style={{ minHeight, maxHeight: minHeight * 3 }}>
        <EditorContent editor={editor} />
      </div>

      {/* 编辑器内容样式（深色主题适配） */}
      <style jsx global>{`
        .ProseMirror {
          outline: none;
          min-height: ${minHeight}px;
        }
        .ProseMirror p {
          margin: 0.4em 0;
        }
        .ProseMirror h2 {
          font-size: 1.15rem;
          font-weight: 600;
          margin: 0.8em 0 0.4em;
          color: hsl(var(--foreground));
        }
        .ProseMirror h3 {
          font-size: 1rem;
          font-weight: 600;
          margin: 0.6em 0 0.3em;
          color: hsl(var(--foreground));
        }
        .ProseMirror ul,
        .ProseMirror ol {
          padding-left: 1.4em;
          margin: 0.4em 0;
        }
        .ProseMirror ul {
          list-style: disc;
        }
        .ProseMirror ol {
          list-style: decimal;
        }
        .ProseMirror li {
          margin: 0.15em 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid hsl(var(--border));
          padding-left: 0.9em;
          margin: 0.5em 0;
          color: hsl(var(--muted-foreground));
          font-style: italic;
        }
        .ProseMirror pre {
          background: hsl(var(--muted));
          border: 1px solid hsl(var(--border));
          border-radius: 0.5rem;
          padding: 0.7em 0.9em;
          margin: 0.5em 0;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.72rem;
          overflow-x: auto;
        }
        .ProseMirror code {
          background: hsl(var(--muted));
          border-radius: 0.25rem;
          padding: 0.1em 0.3em;
          font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
          font-size: 0.85em;
        }
        .ProseMirror pre code {
          background: transparent;
          padding: 0;
          border-radius: 0;
          font-size: inherit;
        }
        .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: hsl(var(--muted-foreground) / 0.6);
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
