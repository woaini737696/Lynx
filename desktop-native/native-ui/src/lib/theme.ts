const THEME_KEY = "lynnhub-theme";
export type Theme = "light" | "dark" | "system";

export function getStoredTheme(): Theme {
  return (localStorage.getItem(THEME_KEY) as Theme) || "system";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.remove("theme-transition");

  if (theme === "system") {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    root.classList.toggle("dark", prefersDark);
    root.removeAttribute("data-theme");
  } else {
    root.classList.toggle("dark", theme === "dark");
    root.setAttribute("data-theme", theme);
  }

  localStorage.setItem(THEME_KEY, theme);
}

export function saveTheme(theme: Theme) {
  localStorage.setItem(THEME_KEY, theme);
}

export function initTheme() {
  applyTheme(getStoredTheme());
}
