"use client";

import { useState, useEffect, useCallback } from "react";
import { Megaphone, Copy, Check, ChevronDown, ChevronUp, Link, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Carousel, MetaAdCta } from "@/types/carousel";
import { META_AD_CTA_LABELS } from "@/types/carousel";
import { cn } from "@/lib/utils";

interface AdCopyPanelProps {
  carousel: Carousel;
  onUpdate: () => void;
}

const CTA_OPTIONS = Object.entries(META_AD_CTA_LABELS) as [MetaAdCta, string][];

export function AdCopyPanel({ carousel, onUpdate }: AdCopyPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [primaryText, setPrimaryText] = useState(carousel.adPrimaryText ?? "");
  const [cta, setCta] = useState<MetaAdCta>(carousel.adCta ?? "LEARN_MORE");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

  // Slide-level ad copy state: { [slideId]: { headline, destinationUrl } }
  const [slideAdCopy, setSlideAdCopy] = useState<
    Record<string, { headline: string; destinationUrl: string }>
  >({});
  const [slidesSaving, setSlidesSaving] = useState<Record<string, boolean>>({});

  // Sync from carousel prop whenever it changes (e.g. after AI writes ad copy)
  useEffect(() => {
    setPrimaryText(carousel.adPrimaryText ?? "");
    setCta(carousel.adCta ?? "LEARN_MORE");
    const initial: Record<string, { headline: string; destinationUrl: string }> = {};
    for (const slide of carousel.slides) {
      initial[slide.id] = {
        headline: slide.adCopy?.headline ?? "",
        destinationUrl: slide.adCopy?.destinationUrl ?? "",
      };
    }
    setSlideAdCopy(initial);
  }, [carousel]);

  const hasContent =
    (carousel.adPrimaryText && carousel.adPrimaryText.trim().length > 0) ||
    carousel.slides.some((s) => s.adCopy?.headline);

  const handleSaveAdCopy = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/carousels/${carousel.id}/adcopy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adPrimaryText: primaryText, adCta: cta }),
      });
      if (!res.ok) return;
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate();
    } finally {
      setSaving(false);
    }
  }, [carousel.id, primaryText, cta, onUpdate]);

  const handleSaveSlide = useCallback(
    async (slideId: string) => {
      setSlidesSaving((s) => ({ ...s, [slideId]: true }));
      try {
        const copy = slideAdCopy[slideId];
        const res = await fetch(`/api/carousels/${carousel.id}/slides/${slideId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            adCopy: {
              headline: copy.headline,
              destinationUrl: copy.destinationUrl || undefined,
            },
          }),
        });
        if (res.ok) onUpdate();
      } finally {
        setSlidesSaving((s) => ({ ...s, [slideId]: false }));
      }
    },
    [carousel.id, slideAdCopy, onUpdate]
  );

  const handleCopyPrimaryText = async () => {
    if (!primaryText) return;
    try {
      await navigator.clipboard.writeText(primaryText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access denied — silently ignore
    }
  };

  return (
    <div className="border-t border-border bg-surface">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <Megaphone className="h-3 w-3" />
          Ad Copy
          {hasContent && (
            <span className="ml-1 h-1.5 w-1.5 rounded-full bg-accent" />
          )}
        </span>
        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronUp className="h-3 w-3" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 space-y-4">
          {/* Primary Text */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-muted-foreground">
                Primary Text
              </span>
              <span className={cn(
                "text-[10px] tabular-nums",
                primaryText.length > 125 ? "text-destructive" : "text-muted-foreground"
              )}>
                {primaryText.length}/125
              </span>
            </div>
            <textarea
              value={primaryText}
              onChange={(e) => setPrimaryText(e.target.value)}
              rows={3}
              placeholder="Engaging hook + value proposition + CTA (125 chars shown before 'See More')"
              className="w-full text-xs bg-muted rounded-md p-2 resize-none border border-transparent focus:border-accent/50 focus:outline-none placeholder:text-muted-foreground/50"
            />
          </div>

          {/* CTA Button */}
          <div>
            <label className="text-[10px] font-medium text-muted-foreground block mb-1">
              CTA Button
            </label>
            <select
              value={cta}
              onChange={(e) => setCta(e.target.value as MetaAdCta)}
              className="w-full text-xs bg-muted rounded-md p-2 border border-transparent focus:border-accent/50 focus:outline-none"
            >
              {CTA_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Save primary text + CTA */}
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2"
              onClick={handleCopyPrimaryText}
              disabled={!primaryText}
            >
              {copied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
              {copied ? "Copied" : "Copy Text"}
            </Button>
            <Button
              variant="accent"
              size="sm"
              className="h-6 text-[10px] gap-1 px-2 ml-auto"
              onClick={handleSaveAdCopy}
              disabled={saving}
            >
              {saved ? <Check className="h-2.5 w-2.5" /> : <Save className="h-2.5 w-2.5" />}
              {saved ? "Saved" : "Save"}
            </Button>
          </div>

          {/* Per-slide headlines */}
          {carousel.slides.length > 0 && (
            <div>
              <span className="text-[10px] font-medium text-muted-foreground block mb-2">
                Card Headlines
              </span>
              <div className="space-y-3">
                {carousel.slides.map((slide, idx) => {
                  const copy = slideAdCopy[slide.id] ?? { headline: "", destinationUrl: "" };
                  return (
                    <div key={slide.id} className="rounded-lg border border-border/60 p-2.5 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-muted-foreground">
                          Card {idx + 1}
                        </span>
                        <span className={cn(
                          "text-[10px] tabular-nums",
                          copy.headline.length > 40 ? "text-destructive font-medium" : "text-muted-foreground"
                        )}>
                          {copy.headline.length}/40
                        </span>
                      </div>
                      <input
                        type="text"
                        maxLength={40}
                        value={copy.headline}
                        onChange={(e) =>
                          setSlideAdCopy((s) => ({
                            ...s,
                            [slide.id]: { ...s[slide.id], headline: e.target.value },
                          }))
                        }
                        placeholder="Headline (max 40 chars)"
                        className="w-full text-xs bg-muted rounded-md px-2 py-1 border border-transparent focus:border-accent/50 focus:outline-none placeholder:text-muted-foreground/50"
                      />
                      <div className="flex items-center gap-1">
                        <Link className="h-2.5 w-2.5 text-muted-foreground shrink-0" />
                        <input
                          type="url"
                          value={copy.destinationUrl}
                          onChange={(e) =>
                            setSlideAdCopy((s) => ({
                              ...s,
                              [slide.id]: { ...s[slide.id], destinationUrl: e.target.value },
                            }))
                          }
                          placeholder="https://example.com/landing-page"
                          className="flex-1 text-[10px] bg-muted rounded-md px-2 py-1 border border-transparent focus:border-accent/50 focus:outline-none placeholder:text-muted-foreground/50"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-5 w-5 p-0 shrink-0"
                          onClick={() => handleSaveSlide(slide.id)}
                          disabled={slidesSaving[slide.id]}
                          aria-label={`Save card ${idx + 1} ad copy`}
                        >
                          {slidesSaving[slide.id]
                            ? <div className="h-2.5 w-2.5 border border-accent border-t-transparent rounded-full animate-spin" />
                            : <Save className="h-2.5 w-2.5" />}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
