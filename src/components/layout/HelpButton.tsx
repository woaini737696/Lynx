"use client";

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";

export interface HelpContent {
  /** 用户痛点：当前功能解决什么问题 */
  painPoint: string;
  /** 用户需求：为什么需要这个功能 */
  need: string;
  /** 解决方案：本功能如何解决问题 */
  solution: string;
  /** 使用方法：具体操作步骤 */
  usage: string[];
}

interface HelpButtonProps {
  content: HelpContent;
  /** 按钮标题（可选，默认"使用说明"） */
  title?: string;
}

/**
 * 使用说明按钮 + 弹窗
 * 放在 PageHeader 右侧，点击弹出痛点/需求/解决/使用四段说明
 */
export function HelpButton({ content, title = "使用说明" }: HelpButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
        title={title}
      >
        <HelpCircle className="h-4 w-4" />
        <span className="hidden sm:inline">{title}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 头部 */}
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white px-6 py-4">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                <HelpCircle className="h-5 w-5 text-cognition" />
                {title}
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 内容 */}
            <div className="space-y-5 px-6 py-5">
              {/* 痛点 */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-red-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-100 text-xs">!</span>
                  痛点
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">{content.painPoint}</p>
              </section>

              {/* 需求 */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-amber-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-xs">?</span>
                  需求
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">{content.need}</p>
              </section>

              {/* 解决方案 */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-blue-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-100 text-xs">✓</span>
                  解决方案
                </h3>
                <p className="text-sm leading-relaxed text-slate-600">{content.solution}</p>
              </section>

              {/* 使用方法 */}
              <section>
                <h3 className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-green-600">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-100 text-xs">→</span>
                  使用方法
                </h3>
                <ol className="space-y-2">
                  {content.usage.map((step, i) => (
                    <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-slate-600">
                      <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-medium text-green-700">
                        {i + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </section>
            </div>

            {/* 底部 */}
            <div className="sticky bottom-0 border-t border-slate-100 bg-white px-6 py-3">
              <button
                onClick={() => setOpen(false)}
                className="w-full rounded-lg bg-slate-900 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                我知道了
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
