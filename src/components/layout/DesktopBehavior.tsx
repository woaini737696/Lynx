"use client";

import { useEffect } from "react";
import { isDesktop } from "@/lib/desktop-client";
import { ContextMenuRenderer } from "@/components/ui/ContextMenu";

/**
 * 桌面端行为增强组件
 *
 * 功能：
 * 1. 在桌面端（Tauri 环境）给 <html> 添加 data-desktop="1" 属性
 *    - 用于 CSS 桌面端专属样式（如隐藏顶部 logo、液态玻璃卡片等）
 * 2. 在桌面端禁用浏览器默认右键菜单（仅对非输入元素）
 *    - 输入框、文本域、contenteditable 保留默认行为（可复制粘贴）
 *    - 其他区域右键不弹出浏览器默认菜单
 * 3. 渲染全局自定义右键菜单容器（ContextMenuRenderer）
 * 4. 禁用文本选择拖拽（桌面端原生感）
 * 5. 禁用文本拖拽到桌面端窗口外
 */
export function DesktopBehavior() {
  useEffect(() => {
    if (!isDesktop()) return;

    // 标记桌面端
    document.documentElement.setAttribute("data-desktop", "1");

    // 禁用浏览器默认右键菜单（仅对非输入元素）
    const handleContextMenu = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // 输入框、文本域、contenteditable 保留默认行为
      const tag = target.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target.isContentEditable ||
        target.closest("[contenteditable='true']") !== null;

      // 如果是可编辑元素，不阻止默认行为
      if (isEditable) return;

      // 其他区域阻止浏览器默认右键菜单
      // 如果没有自定义右键菜单绑定，则什么都不做（原生桌面端效果）
      // 自定义右键菜单通过 onContextMenu 事件 + openContextMenu() 触发
      // 这里只负责阻止默认行为
      e.preventDefault();
    };

    // 禁用文本选择拖拽（桌面端原生感，避免拖拽文字到其他应用）
    const handleDragStart = (e: DragEvent) => {
      const target = e.target as HTMLElement;
      const tag = target.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        target.isContentEditable;

      if (!isEditable && target.draggable !== true) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("dragstart", handleDragStart);

    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("dragstart", handleDragStart);
    };
  }, []);

  return <ContextMenuRenderer />;
}
