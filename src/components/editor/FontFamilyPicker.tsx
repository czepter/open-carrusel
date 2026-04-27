"use client";

import { useEffect } from "react";

export interface FontOption {
  name: string;
  category: string;
}

// Module-level cache: each Google Font is injected into the document head
// at most once per browser session.
const preloadedFonts = new Set<string>();

function preloadGoogleFont(family: string) {
  if (
    preloadedFonts.has(family) ||
    typeof document === "undefined" ||
    !family
  )
    return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family) +
    ":wght@400;700&display=swap";
  document.head.appendChild(link);
  preloadedFonts.add(family);
}

interface FontFamilyPickerProps {
  label: string;
  value: string;
  fonts: FontOption[];
  onChange: (value: string) => void;
}

export function FontFamilyPicker({
  label,
  value,
  fonts,
  onChange,
}: FontFamilyPickerProps) {
  // Preload font for the live preview whenever value changes
  useEffect(() => {
    preloadGoogleFont(value);
  }, [value]);

  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
        {label}
      </p>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-8 rounded-md border border-border bg-muted px-2 text-xs focus:outline-none focus:ring-1 focus:ring-accent"
      >
        {fonts.map((font) => (
          <option key={font.name} value={font.name}>
            {font.name}
          </option>
        ))}
      </select>
      {value && (
        <p
          className="mt-1.5 text-[13px] text-foreground/70 truncate leading-snug"
          style={{ fontFamily: "'" + value + "', sans-serif" }}
        >
          The quick brown fox
        </p>
      )}
    </div>
  );
}
