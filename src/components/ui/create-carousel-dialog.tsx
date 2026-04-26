"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Layers, Megaphone, X } from "lucide-react";
import { Button } from "./button";
import { Input } from "./input";
import { AspectRatioSelector } from "@/components/editor/AspectRatioSelector";
import type { AspectRatio, CarouselMode } from "@/types/carousel";
import { cn } from "@/lib/utils";

interface CreateCarouselDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string, aspectRatio: AspectRatio, mode: CarouselMode) => void;
}

const MODES: { value: CarouselMode; label: string; sublabel: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { value: "organic",   label: "Carousel",  sublabel: "Instagram organic post",   Icon: Layers    },
  { value: "meta-ads",  label: "Meta Ad",   sublabel: "Feed, Stories & Reels ads", Icon: Megaphone },
];

export function CreateCarouselDialog({
  open,
  onOpenChange,
  onCreate,
}: CreateCarouselDialogProps) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<CarouselMode>("organic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("4:5");

  const handleModeChange = (newMode: CarouselMode) => {
    setMode(newMode);
    // Default to square for Meta Ads (safest cross-placement format)
    if (newMode === "meta-ads") setAspectRatio("1:1");
    else setAspectRatio("4:5");
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate(trimmed, aspectRatio, mode);
    setName("");
    setMode("organic");
    setAspectRatio("4:5");
    onOpenChange(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay data-oc-overlay className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content data-oc-dialog className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface border border-border p-6 shadow-2xl">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
                {mode === "meta-ads"
                  ? <Megaphone className="h-4 w-4 text-accent" />
                  : <Layers className="h-4 w-4 text-accent" />}
              </div>
              <Dialog.Title className="text-base font-semibold">
                {mode === "meta-ads" ? "New Meta Ad" : "New Carousel"}
              </Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button
                className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="space-y-4">
            {/* Mode selector */}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map(({ value, label, sublabel, Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleModeChange(value)}
                    className={cn(
                      "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
                      mode === value
                        ? "border-accent bg-accent/5 text-foreground"
                        : "border-border hover:border-accent/40 text-muted-foreground"
                    )}
                  >
                    <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", mode === value ? "text-accent" : "")} />
                    <div>
                      <p className={cn("text-xs font-medium", mode === value ? "text-foreground" : "")}>{label}</p>
                      <p className="text-[10px] text-muted-foreground">{sublabel}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                {mode === "meta-ads" ? "Ad Campaign Name" : "Carousel Name"}
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={mode === "meta-ads" ? "e.g., Summer Sale — Shoes" : "e.g., 5 Tips for Remote Work"}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                }}
              />
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                Format
              </label>
              <AspectRatioSelector
                value={aspectRatio}
                onChange={setAspectRatio}
                showLandscape={mode === "meta-ads"}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <Button variant="outline" size="sm">
                Cancel
              </Button>
            </Dialog.Close>
            <Button
              variant="accent"
              size="sm"
              onClick={handleCreate}
              disabled={!name.trim()}
            >
              Create
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
