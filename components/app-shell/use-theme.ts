"use client";

import { useEffect, useState } from "react";

import { THEME_STORAGE_KEY } from "./theme";

export function useTheme() {
  const [dark, setDark] = useState(false);

  // The init script has already set the class; read it after hydration.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light");
    } catch {
      // Storage can be blocked; the theme still applies for this visit.
    }
  }

  return { dark, toggleTheme };
}
