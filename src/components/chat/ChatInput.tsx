"use client";

import { useState, useRef, useCallback } from "react";
import { Send, Square, ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface PendingImage {
  url: string;
  name: string;
}

interface ChatInputProps {
  onSend: (message: string) => void;
  isStreaming: boolean;
  disabled?: boolean;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  onStop?: () => void;
  onImageUpload?: (files: File[]) => void;
  isUploading?: boolean;
  /** Images uploaded and waiting to be sent with the next message */
  pendingImages?: PendingImage[];
  onRemovePendingImage?: (url: string) => void;
}

const SUGGESTIONS = [
  "Create a 5-slide carousel about...",
  "Make the design more minimal",
  "Change the accent color to blue",
  "Add a call-to-action slide",
  "Make the headings bigger",
];

export function ChatInput({
  onSend,
  isStreaming,
  disabled,
  textareaRef: externalRef,
  onStop,
  onImageUpload,
  isUploading,
  pendingImages = [],
  onRemovePendingImage,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalRef || internalRef;

  const hasPending = pendingImages.length > 0;
  const canSend = value.trim().length > 0 || hasPending;

  const handleSubmit = () => {
    if (!canSend || isStreaming) return;
    onSend(value.trim());
    setValue("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
    }
  };

  const handleImageClick = useCallback(() => {
    if (!onImageUpload) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (fileList && fileList.length > 0) {
        onImageUpload(Array.from(fileList));
      }
    };
    input.click();
  }, [onImageUpload]);

  const showSuggestions = value.length === 0 && !isStreaming && !hasPending;

  return (
    <div className="border-t border-border px-3 pb-3 pt-2">
      {showSuggestions && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {SUGGESTIONS.slice(0, 3).map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => setValue(suggestion)}
              className="text-xs px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Pending image thumbnails */}
      {hasPending && (
        <div className="flex gap-1.5 mb-2 overflow-x-auto">
          {pendingImages.map((img) => (
            <div key={img.url} className="relative group shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="h-14 w-14 rounded-lg object-cover border border-border"
              />
              {onRemovePendingImage && (
                <button
                  onClick={() => onRemovePendingImage(img.url)}
                  className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label={`Remove ${img.name}`}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          ))}
          {isUploading && (
            <div className="h-14 w-14 shrink-0 rounded-lg border border-dashed border-border flex items-center justify-center">
              <div className="h-4 w-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      )}

      <div className="flex items-end gap-1">
        {onImageUpload && (
          <button
            onClick={handleImageClick}
            disabled={isStreaming || isUploading || disabled}
            className="shrink-0 h-9 w-8 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Upload images for slides"
            title="Upload images for slides"
          >
            {isUploading && !hasPending ? (
              <div className="h-[18px] w-[18px] border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <ImagePlus className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onInput={handleInput}
          placeholder={
            isStreaming
              ? "AI is working..."
              : hasPending
                ? "What should I do with these images?"
                : "Describe your carousel..."
          }
          disabled={isStreaming || disabled}
          rows={1}
          className="flex-1 min-w-0 resize-none bg-muted rounded-lg px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          aria-label="Chat message input"
        />
        {isStreaming ? (
          <Button
            size="icon"
            variant="destructive"
            onClick={onStop}
            className="shrink-0 h-9 w-9"
            aria-label="Stop generating"
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <Button
            size="icon"
            onClick={handleSubmit}
            disabled={!canSend || disabled}
            className="shrink-0 h-9 w-9"
            aria-label="Send message"
          >
            <Send className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
