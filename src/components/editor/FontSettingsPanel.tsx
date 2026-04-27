"use client";

import { useState, useEffect } from "react";
import { Type, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FontFamilyPicker } from "./FontFamilyPicker";
import type { FontOption } from "./FontFamilyPicker";
import type { CarouselFontSettings } from "@/types/carousel";
import { cn } from "@/lib/utils";

// ─── Sub-components ────────────────────────────────────────────────────────

const WEIGHTS = [300, 400, 500, 600, 700, 800] as const;
const WEIGHT_LABELS: Record<number, string> = {
  300: "Thin",
  400: "Reg",
  500: "Med",
  600: "Semi",
  700: "Bold",
  800: "Xtra",
};
const TRANSFORMS = ["none", "uppercase", "capitalize", "lowercase"] as const;
const TRANSFORM_LABELS: Record<string, string> = {
  none: "Aa",
  uppercase: "AA",
  capitalize: "Ab",
  lowercase: "aa",
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-mono text-foreground/60 min-w-[36px] text-right">
          {display(value)}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-accent rounded-full cursor-pointer"
      />
    </div>
  );
}

/** Generic segmented button row — reused for weight and text-transform. */
function OptionRow<T extends string | number>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  labels: Record<T extends string ? string : number, string>;
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <div className="flex gap-px">
        {options.map((opt) => (
          <button
            key={String(opt)}
            onClick={() => onChange(opt)}
            title={String(opt)}
            className={cn(
              "flex-1 h-6 text-[9px] font-medium rounded transition-colors",
              value === opt
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-border hover:text-foreground"
            )}
          >
            {(labels as Record<string, string>)[String(opt)]}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main panel ────────────────────────────────────────────────────────────

interface FontSettingsPanelProps {
  carouselId: string;
  settings: CarouselFontSettings;
  onChange: (settings: CarouselFontSettings) => void;
  onApplyComplete: () => Promise<void>;
}

export function FontSettingsPanel({
  carouselId,
  settings,
  onChange,
  onApplyComplete,
}: FontSettingsPanelProps) {
  // Single fetch for both pickers — avoids two simultaneous identical requests
  const [fonts, setFonts] = useState<FontOption[]>([]);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    fetch("/api/fonts")
      .then((r) => r.json())
      .then((data) => setFonts(data.fonts || []))
      .catch(() => {});
  }, []);

  function update(patch: Partial<CarouselFontSettings>) {
    onChange({ ...settings, ...patch });
  }

  async function handleApply() {
    setApplying(true);
    try {
      const res = await fetch(
        "/api/carousels/" + carouselId + "/apply-fonts",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fontSettings: settings }),
        }
      );
      if (res.ok) {
        await onApplyComplete();
        setApplied(true);
        setTimeout(() => setApplied(false), 2000);
      }
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {/* Header — height matches the toolbar row in page.tsx */}
      <div className="h-[60px] shrink-0 flex items-center gap-2 px-4 border-b border-border">
        <Type className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-sm font-semibold">Typography</span>
      </div>

      {/* Scrollable controls */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

        {/* ── Fonts ── */}
        <div className="space-y-4">
          <SectionLabel>Fonts</SectionLabel>
          <FontFamilyPicker
            label="Heading"
            value={settings.headingFamily}
            fonts={fonts}
            onChange={(v) => update({ headingFamily: v })}
          />
          <FontFamilyPicker
            label="Body"
            value={settings.bodyFamily}
            fonts={fonts}
            onChange={(v) => update({ bodyFamily: v })}
          />
        </div>

        <div className="h-px bg-border" />

        {/* ── Sizes ── */}
        <div className="space-y-3">
          <SectionLabel>Sizes</SectionLabel>
          <SliderRow
            label="Heading"
            value={settings.headingSize}
            min={36}
            max={120}
            step={2}
            display={(v) => v + "px"}
            onChange={(v) => update({ headingSize: v })}
          />
          <SliderRow
            label="Body"
            value={settings.bodySize}
            min={10}
            max={36}
            step={1}
            display={(v) => v + "px"}
            onChange={(v) => update({ bodySize: v })}
          />
        </div>

        <div className="h-px bg-border" />

        {/* ── Weight ── */}
        <div className="space-y-3">
          <SectionLabel>Weight</SectionLabel>
          <OptionRow
            label="Heading"
            options={WEIGHTS}
            labels={WEIGHT_LABELS}
            value={settings.headingWeight}
            onChange={(v) => update({ headingWeight: v })}
          />
          <OptionRow
            label="Body"
            options={WEIGHTS}
            labels={WEIGHT_LABELS}
            value={settings.bodyWeight}
            onChange={(v) => update({ bodyWeight: v })}
          />
        </div>

        <div className="h-px bg-border" />

        {/* ── Style ── */}
        <div className="space-y-3">
          <SectionLabel>Style</SectionLabel>
          <SliderRow
            label="Letter spacing"
            value={settings.letterSpacing}
            min={-0.05}
            max={0.2}
            step={0.01}
            display={(v) =>
              (v >= 0 ? "+" : "") + v.toFixed(2) + "em"
            }
            onChange={(v) => update({ letterSpacing: v })}
          />
          <SliderRow
            label="Line height"
            value={settings.lineHeight}
            min={0.9}
            max={2.2}
            step={0.05}
            display={(v) => v.toFixed(2) + "×"}
            onChange={(v) => update({ lineHeight: v })}
          />
          <OptionRow
            label="Text transform"
            options={TRANSFORMS}
            labels={TRANSFORM_LABELS}
            value={settings.textTransform}
            onChange={(v) => update({ textTransform: v })}
          />
        </div>
      </div>

      {/* Sticky footer: Apply button */}
      <div className="shrink-0 px-4 py-3 border-t border-border">
        <Button
          variant={applied ? "outline" : "default"}
          size="sm"
          className={cn(
            "w-full gap-1.5",
            applied && "border-accent text-accent"
          )}
          onClick={handleApply}
          disabled={applying}
        >
          <Wand2 className="h-3.5 w-3.5" />
          {applying ? "Applying…" : applied ? "Applied!" : "Apply to All Slides"}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-1.5 text-center">
          Permanently rewrites slide HTML
        </p>
      </div>
    </div>
  );
}
