"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

/**
 * Light/dark toggle. Dark is the site default (set server-side from the `theme` cookie in
 * app/layout.tsx). Toggling flips `.dark` on <html> instantly and persists the choice to the
 * cookie (so the next SSR matches — no flash) and localStorage.
 */
export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(true);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
    setMounted(true);
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    document.cookie = `theme=${next ? "dark" : "light"}; path=/; max-age=31536000; samesite=lax`;
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light theme" : "Switch to dark theme"}
      title={dark ? "Light theme" : "Dark theme"}
      className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-ink-muted transition-colors hover:border-border-strong hover:text-ink"
    >
      {/* Render nothing until mounted to avoid an SSR/client icon mismatch */}
      {mounted ? dark ? <Sun className="size-4" strokeWidth={2} /> : <Moon className="size-4" strokeWidth={2} /> : <span className="size-4" />}
    </button>
  );
}
