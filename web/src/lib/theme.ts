export function getStoredTheme(): "light" | "dark" | null {
  const stored = localStorage.getItem("dorway-theme");
  return stored === "light" || stored === "dark" ? stored : null;
}

export function applyTheme(theme: "light" | "dark") {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem("dorway-theme", theme);
}

export function currentIsDark(): boolean {
  const attr = document.documentElement.getAttribute("data-theme");
  if (attr) return attr === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}
