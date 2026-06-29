import { useState, useEffect, useCallback } from "react";

export const OPEN_LOGIN_MODAL_EVENT = "open-login-modal";
export const CLOSE_LOGIN_MODAL_EVENT = "close-login-modal";

export interface OpenLoginModalDetail {
  mode?: "phone-password" | "phone-code";
  expired?: boolean;
}

export function openLoginModal(detail?: OpenLoginModalDetail) {
  window.dispatchEvent(
    new CustomEvent<OpenLoginModalDetail>(OPEN_LOGIN_MODAL_EVENT, { detail })
  );
}

export function closeLoginModal() {
  window.dispatchEvent(new CustomEvent(CLOSE_LOGIN_MODAL_EVENT));
}

export function useLoginModal() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"phone-password" | "phone-code">("phone-password");
  const [expired, setExpired] = useState(false);

  const handleOpen = useCallback((e: Event) => {
    const custom = e as CustomEvent<OpenLoginModalDetail>;
    if (custom.detail?.mode) setMode(custom.detail.mode);
    if (custom.detail?.expired !== undefined) setExpired(custom.detail.expired);
    else setExpired(false);
    setOpen(true);
  }, []);

  const handleClose = useCallback(() => {
    setOpen(false);
    setExpired(false);
  }, []);

  useEffect(() => {
    window.addEventListener(OPEN_LOGIN_MODAL_EVENT, handleOpen);
    window.addEventListener(CLOSE_LOGIN_MODAL_EVENT, handleClose);
    return () => {
      window.removeEventListener(OPEN_LOGIN_MODAL_EVENT, handleOpen);
      window.removeEventListener(CLOSE_LOGIN_MODAL_EVENT, handleClose);
    };
  }, [handleOpen, handleClose]);

  return {
    open,
    mode,
    expired,
    setMode,
    closeModal: handleClose,
  };
}
