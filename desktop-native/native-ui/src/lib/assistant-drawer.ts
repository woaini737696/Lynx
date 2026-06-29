import { useEffect, useState, useCallback } from "react";

const OPEN_EVENT = "lynx-assistant-drawer-open";
const CLOSE_EVENT = "lynx-assistant-drawer-close";
const TOGGLE_EVENT = "lynx-assistant-drawer-toggle";

export function openAssistantDrawer() {
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function closeAssistantDrawer() {
  window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
}

export function toggleAssistantDrawer() {
  window.dispatchEvent(new CustomEvent(TOGGLE_EVENT));
}

export function useAssistantDrawer() {
  const [open, setOpen] = useState(false);

  const openDrawer = useCallback(() => setOpen(true), []);
  const closeDrawer = useCallback(() => setOpen(false), []);
  const toggleDrawer = useCallback(() => setOpen((v) => !v), []);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    const onToggle = () => setOpen((v) => !v);

    window.addEventListener(OPEN_EVENT, onOpen);
    window.addEventListener(CLOSE_EVENT, onClose);
    window.addEventListener(TOGGLE_EVENT, onToggle);

    return () => {
      window.removeEventListener(OPEN_EVENT, onOpen);
      window.removeEventListener(CLOSE_EVENT, onClose);
      window.removeEventListener(TOGGLE_EVENT, onToggle);
    };
  }, []);

  return { open, openDrawer, closeDrawer, toggleDrawer };
}
