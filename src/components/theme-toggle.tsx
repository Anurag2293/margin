"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Choice = "light" | "dark" | "system";

export function ThemeToggle() {
  const [resolved, setResolved] = useState<"light" | "dark">("light");

  useEffect(() => {
    const stored = readChoice();
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = (choice: Choice) => {
      const dark = choice === "dark" || (choice === "system" && media.matches);
      document.documentElement.classList.toggle("dark", dark);
      document.documentElement.style.colorScheme = dark ? "dark" : "light";
      setResolved(dark ? "dark" : "light");
      const themeColor = document.querySelector('meta[name="theme-color"]');
      themeColor?.setAttribute("content", dark ? "#1c1916" : "#f3efe4");
    };
    apply(stored);
    const onChange = () => {
      if (readChoice() === "system") apply("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next = resolved === "dark" ? "light" : "dark";
    localStorage.setItem("margin-theme", next);
    document.documentElement.classList.toggle("dark", next === "dark");
    document.documentElement.style.colorScheme = next;
    setResolved(next);
  }

  const label = resolved === "dark" ? "Switch to light theme" : "Switch to dark theme";

  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className="size-11"
      aria-label={label}
      onClick={toggle}
    >
      {resolved === "dark" ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
    </Button>
  );
}

function readChoice(): Choice {
  try {
    const stored = localStorage.getItem("margin-theme");
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* private mode */
  }
  return "system";
}
