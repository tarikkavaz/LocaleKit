"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

export function useTheme() {
  const [theme, setTheme] = useState<Theme>("dark");
  const [resolvedTheme, setResolvedTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    // Load saved theme or default to dark
    const savedTheme = (typeof window !== "undefined" && localStorage.getItem("theme")) as Theme | null;
    const initialTheme = savedTheme || "dark";
    setTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  const applyTheme = (themeToApply: Theme) => {
    const root = window.document.documentElement;
    let resolved: "light" | "dark";

    if (themeToApply === "system") {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      resolved = prefersDark ? "dark" : "light";
    } else {
      resolved = themeToApply;
    }

    root.classList.remove("light", "dark");
    root.classList.add(resolved);
    setResolvedTheme(resolved);

    if (typeof window !== "undefined") {
      localStorage.setItem("theme", themeToApply);
    }
  };

  const updateTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    applyTheme(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = resolvedTheme === "dark" ? "light" : "dark";
    updateTheme(newTheme);
  };

  return { theme, resolvedTheme, setTheme: updateTheme, toggleTheme };
}
