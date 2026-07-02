// 可见性检测接口 - 平台适配
// Web 端：document.visibilityState
// RN 端：AppState (active/background/inactive)
// Tauri 端：窗口焦点事件

/** 可见性状态 */
export type VisibilityState = "visible" | "hidden" | "background";

/** 可见性检测接口 */
export interface IVisibilityProvider {
  /** 当前是否可见（visible 状态） */
  readonly isVisible: boolean;

  /** 当前状态 */
  readonly state: VisibilityState;

  /** 注册状态变更回调，返回取消注册的函数 */
  onChange(cb: (state: VisibilityState) => void): () => void;
}
