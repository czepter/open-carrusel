"use client";

import { useEffect, useState, useCallback, useRef, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2, Grid3X3, Bookmark, BookmarkCheck, Maximize2, Type } from "lucide-react";
import { TopBar } from "@/components/layout/TopBar";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChatPanel } from "@/components/chat/ChatPanel";
import { CarouselPreview } from "@/components/editor/CarouselPreview";
import { SlideFilmstrip } from "@/components/editor/SlideFilmstrip";
import { AspectRatioSelector } from "@/components/editor/AspectRatioSelector";
import { ExportButton } from "@/components/editor/ExportButton";
import { CaptionPanel } from "@/components/editor/CaptionPanel";
import { AdCopyPanel } from "@/components/editor/AdCopyPanel";
import { SafeZoneOverlay } from "@/components/editor/SafeZoneOverlay";
import { FullscreenPreview } from "@/components/editor/FullscreenPreview";
import { FontSettingsPanel } from "@/components/editor/FontSettingsPanel";
import type { Carousel, AspectRatio, CarouselFontSettings } from "@/types/carousel";
import { DEFAULT_FONT_SETTINGS } from "@/types/carousel";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function CarouselEditorPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [carousel, setCarousel] = useState<Carousel | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);
  const [claudeAvailable, setClaudeAvailable] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [fontPanelOpen, setFontPanelOpen] = useState(true);
  // fontSettings lives here (not inside carousel) for instant local updates
  const [fontSettings, setFontSettings] = useState<CarouselFontSettings | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showSafeZones, setShowSafeZones] = useState(false);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [templateSaved, setTemplateSaved] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);

  // Debounce ref for saving fontSettings to the API
  const fontSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear debounce timer on unmount to avoid stale API calls
  useEffect(() => {
    return () => {
      if (fontSaveTimer.current) clearTimeout(fontSaveTimer.current);
    };
  }, []);

  // Confirm dialog state
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    description: string;
    onConfirm: () => void;
  }>({ open: false, title: "", description: "", onConfirm: () => {} });

  // Ref for focusing chat input when + button is clicked
  const chatInputRef = useRef<HTMLTextAreaElement | null>(null);

  const fetchCarousel = useCallback(async () => {
    try {
      const res = await fetch(`/api/carousels/${id}`);
      if (res.status === 404) {
        setNotFound(true);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setCarousel((prev) => {
          // If new slides were added during generation, jump to the latest slide
          if (prev && data.slides.length > prev.slides.length) {
            setActiveSlide(data.slides.length - 1);
          } else {
            setActiveSlide((prevIdx) =>
              data.slides.length === 0 ? 0 : Math.min(prevIdx, data.slides.length - 1)
            );
          }
          return data;
        });
      }
    } catch {
      // ignore network errors
    }
  }, [id]);

  // Initial data load — also seed fontSettings from carousel or brand config
  useEffect(() => {
    const load = async () => {
      await fetchCarousel();
      try {
        const res = await fetch("/api/chat/check");
        const data: { available?: boolean } = await res.json();
        if (data.available === false) setClaudeAvailable(false);
      } catch {
        // assume available
      }
    };
    load();
  }, [fetchCarousel]);

  // Once carousel loads, initialise fontSettings if not already set
  useEffect(() => {
    if (!carousel || fontSettings !== null) return;
    if (carousel.fontSettings) {
      setFontSettings(carousel.fontSettings);
    } else {
      // Seed defaults from brand config
      fetch("/api/brand")
        .then((r) => r.json())
        .then((brand) => {
          setFontSettings({
            ...DEFAULT_FONT_SETTINGS,
            headingFamily: brand?.fonts?.heading ?? DEFAULT_FONT_SETTINGS.headingFamily,
            bodyFamily: brand?.fonts?.body ?? DEFAULT_FONT_SETTINGS.bodyFamily,
          });
        })
        .catch(() => setFontSettings(DEFAULT_FONT_SETTINGS));
    }
  }, [carousel, fontSettings]);

  // Poll for carousel updates while AI is generating slides
  useEffect(() => {
    if (!isGenerating) return;
    const interval = setInterval(() => {
      fetchCarousel();
    }, 500);
    return () => clearInterval(interval);
  }, [isGenerating, fetchCarousel]);

  const handleAspectChange = async (ratio: AspectRatio) => {
    if (!carousel) return;
    const res = await fetch(`/api/carousels/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aspectRatio: ratio }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCarousel(updated);
    }
  };

  const handleDeleteSlide = (slideId: string) => {
    if (!carousel) return;
    const slideIndex = carousel.slides.findIndex((s) => s.id === slideId);
    setConfirmState({
      open: true,
      title: `Delete slide ${slideIndex + 1}?`,
      description: "This action cannot be undone.",
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}/slides/${slideId}`, {
          method: "DELETE",
        });
        if (res.ok) await fetchCarousel();
      },
    });
  };

  const handleUndoSlide = async (slideId: string) => {
    const res = await fetch(`/api/carousels/${id}/slides/${slideId}/undo`, {
      method: "POST",
    });
    if (res.ok) await fetchCarousel();
  };

  const handleDeleteCarousel = useCallback(() => {
    if (!carousel) return;
    setConfirmState({
      open: true,
      title: `Delete "${carousel.name}"?`,
      description: "This will permanently delete the carousel and all its slides.",
      onConfirm: async () => {
        const res = await fetch(`/api/carousels/${id}`, { method: "DELETE" });
        if (res.ok) router.push("/");
      },
    });
  }, [carousel, id, router]);

  const handleStreamStart = useCallback(() => {
    setIsGenerating(true);
  }, []);

  const handleStreamEnd = useCallback(() => {
    setIsGenerating(false);
    fetchCarousel();
  }, [fetchCarousel]);

  const handleReorderSlides = useCallback(
    async (slideIds: string[]) => {
      await fetch(`/api/carousels/${id}/slides`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slideIds }),
      });
      await fetchCarousel();
    },
    [id, fetchCarousel]
  );

  const handleAddSlideRequest = useCallback(() => {
    setChatOpen(true);
    // Focus chat input after a tick (to let panel render)
    setTimeout(() => {
      chatInputRef.current?.focus();
    }, 100);
  }, []);

  // Update fontSettings locally (instant preview) and debounce-save to API
  const handleFontSettingsChange = useCallback(
    (settings: CarouselFontSettings) => {
      setFontSettings(settings);
      if (fontSaveTimer.current) clearTimeout(fontSaveTimer.current);
      fontSaveTimer.current = setTimeout(async () => {
        await fetch(`/api/carousels/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fontSettings: settings }),
        });
      }, 600);
    },
    [id]
  );

  if (notFound) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4">
        <p className="text-lg font-semibold">Carousel not found</p>
        <p className="text-sm text-muted-foreground">
          This carousel may have been deleted.
        </p>
        <Link href="/" className="text-sm text-accent underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!carousel) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <TopBar
        title={carousel.name}
        showBack
        editable
        costUsd={carousel.costUsd}
        onTitleChange={async (name) => {
          const res = await fetch(`/api/carousels/${id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (res.ok) {
            const updated = await res.json();
            setCarousel(updated);
          }
        }}
      />

      {/* Fullscreen preview */}
      <FullscreenPreview
        open={showFullscreen}
        onOpenChange={setShowFullscreen}
        slides={carousel.slides}
        aspectRatio={carousel.aspectRatio}
        activeIndex={activeSlide}
        onActiveChange={setActiveSlide}
        fontSettings={fontSettings ?? undefined}
      />

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirmState.open}
        onOpenChange={(open) => setConfirmState((s) => ({ ...s, open }))}
        title={confirmState.title}
        description={confirmState.description}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={confirmState.onConfirm}
      />

      {/* Main editor area */}
      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Chat panel */}
        {chatOpen && (
          <div className="oc-fade w-[520px] border-r border-border shrink-0 flex flex-col bg-surface">
            <ChatPanel
              carouselId={id}
              claudeAvailable={claudeAvailable}
              referenceImages={carousel.referenceImages || []}
              onStreamStart={handleStreamStart}
              onStreamEnd={handleStreamEnd}
              chatInputRef={chatInputRef}
            />
          </div>
        )}

        {/* Center + right sidebar */}
        <div className="flex-1 flex min-w-0 min-h-0">

        {/* Center: toolbar + preview + caption */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          {/* Toolbar */}
          <div className="h-[60px] border-b border-border bg-surface flex items-center px-4 gap-3 shrink-0">
            <AspectRatioSelector
              value={carousel.aspectRatio}
              onChange={handleAspectChange}
              showLandscape={carousel.mode === "meta-ads"}
            />
            <div className="flex-1" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowFullscreen(true)}
              className="text-muted-foreground"
              aria-label="Fullscreen preview"
              title="Fullscreen preview"
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={showSafeZones ? "outline" : "ghost"}
              size="sm"
              onClick={() => setShowSafeZones(!showSafeZones)}
              className={showSafeZones ? "border-accent text-accent" : "text-muted-foreground"}
              aria-label="Toggle safe zones"
              title="Instagram safe zones"
            >
              <Grid3X3 className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant={templateSaved ? "outline" : "ghost"}
              size="sm"
              disabled={templateSaving}
              onClick={async () => {
                setTemplateSaving(true);
                try {
                  const res = await fetch("/api/templates", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ carouselId: carousel.id }),
                  });
                  if (res.ok) {
                    setTemplateSaved(true);
                    setTimeout(() => setTemplateSaved(false), 2000);
                  }
                } finally {
                  setTemplateSaving(false);
                }
              }}
              className={
                templateSaved
                  ? "border-accent text-accent"
                  : "text-muted-foreground"
              }
              aria-label="Save as template"
              title={templateSaved ? "Template saved!" : "Save as template"}
            >
              {templateSaved ? (
                <BookmarkCheck className="h-3.5 w-3.5" />
              ) : (
                <Bookmark className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDeleteCarousel}
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete carousel"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
            <button
              onClick={() => setChatOpen(!chatOpen)}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-md border border-border hover:bg-muted"
            >
              {chatOpen ? "Hide Chat" : "Show Chat"}
            </button>
            <Button
              variant={fontPanelOpen ? "outline" : "ghost"}
              size="sm"
              onClick={() => setFontPanelOpen(!fontPanelOpen)}
              className={fontPanelOpen ? "border-accent text-accent" : "text-muted-foreground"}
              aria-label="Toggle typography panel"
              title="Typography settings"
            >
              <Type className="h-3.5 w-3.5" />
            </Button>
            <ExportButton
              carouselId={carousel.id}
              slideCount={carousel.slides.length}
            />
          </div>

          {/* Carousel preview */}
          <CarouselPreview
            slides={carousel.slides}
            aspectRatio={carousel.aspectRatio}
            activeIndex={activeSlide}
            onActiveChange={setActiveSlide}
            showSafeZones={showSafeZones}
            fontSettings={fontSettings ?? undefined}
          />

          {/* Caption / Ad Copy panel */}
          {carousel.mode === "meta-ads" ? (
            <AdCopyPanel carousel={carousel} onUpdate={fetchCarousel} />
          ) : (
            <CaptionPanel
              caption={carousel.caption}
              hashtags={carousel.hashtags}
            />
          )}
        </div>

          {/* Right sidebar: font settings */}
          {fontPanelOpen && fontSettings && (
            <div className="oc-fade w-[240px] shrink-0 border-l border-border">
              <FontSettingsPanel
                carouselId={id}
                settings={fontSettings}
                onChange={handleFontSettingsChange}
                onApplyComplete={fetchCarousel}
              />
            </div>
          )}

        </div>{/* end center + right sidebar */}
      </div>

      {/* Filmstrip */}
      <SlideFilmstrip
        slides={carousel.slides}
        aspectRatio={carousel.aspectRatio}
        activeIndex={activeSlide}
        onActiveChange={setActiveSlide}
        onDeleteSlide={handleDeleteSlide}
        onUndoSlide={handleUndoSlide}
        onAddSlideRequest={handleAddSlideRequest}
        onReorderSlides={handleReorderSlides}
        isGenerating={isGenerating}
      />
    </div>
  );
}
