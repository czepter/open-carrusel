"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ChatMessage } from "./ChatMessage";
import { ChatInput, type PendingImage } from "./ChatInput";
import { ReferenceImages } from "./ReferenceImages";
import { AlertCircle, Plug } from "lucide-react";
import type { ReferenceImage } from "@/types/carousel";
import type { ClaudeModel } from "@/app/api/models/route";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  carouselId: string;
  referenceImages?: ReferenceImage[];
  claudeAvailable: boolean;
  onStreamStart?: () => void;
  onStreamEnd?: () => void;
  chatInputRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export function ChatPanel({
  carouselId,
  claudeAvailable,
  referenceImages = [],
  onStreamStart,
  onStreamEnd,
  chatInputRef,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
  const [models, setModels] = useState<ClaudeModel[]>([]);
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedEffort, setSelectedEffort] = useState<string>("high");
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Load session ID and chat history from localStorage
  useEffect(() => {
    const storedSession = localStorage.getItem(`chat-session-${carouselId}`);
    if (storedSession) setSessionId(storedSession);
    try {
      const storedMessages = localStorage.getItem(`chat-messages-${carouselId}`);
      if (storedMessages) setMessages(JSON.parse(storedMessages));
    } catch {
      // ignore corrupted data
    }
  }, [carouselId]);

  // Fetch available models from the CLI and restore last selection from brand config
  useEffect(() => {
    Promise.all([
      fetch("/api/models").then((r) => r.json()),
      fetch("/api/brand").then((r) => r.json()),
    ])
      .then(([modelData, brandData]: [ClaudeModel[], { preferredModel?: string; preferredEffort?: string }]) => {
        if (!Array.isArray(modelData) || modelData.length === 0) return;
        setModels(modelData);
        const savedModel = brandData?.preferredModel;
        const isValidModel = savedModel && modelData.some((m) => m.id === savedModel);
        setSelectedModel(isValidModel ? savedModel! : modelData[0].id);
        const VALID_EFFORTS = ["low", "medium", "high", "xhigh", "max"];
        const savedEffort = brandData?.preferredEffort;
        if (savedEffort && VALID_EFFORTS.includes(savedEffort)) {
          setSelectedEffort(savedEffort);
        }
      })
      .catch(() => {});
  }, []);

  // Persist messages to localStorage
  const persistMessages = useCallback(
    (msgs: Message[]) => {
      try {
        localStorage.setItem(`chat-messages-${carouselId}`, JSON.stringify(msgs));
      } catch {
        // ignore quota errors
      }
    },
    [carouselId]
  );

  const handleClearChat = useCallback(() => {
    setMessages([]);
    setSessionId(null);
    localStorage.removeItem(`chat-messages-${carouselId}`);
    localStorage.removeItem(`chat-session-${carouselId}`);
  }, [carouselId]);

  const handleModelChange = useCallback((id: string) => {
    setSelectedModel(id);
    fetch("/api/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredModel: id }),
    }).catch(() => {});
  }, []);

  const handleEffortChange = useCallback((level: string) => {
    setSelectedEffort(level);
    fetch("/api/brand", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferredEffort: level }),
    }).catch(() => {});
  }, []);

  const handleStopGenerating = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = useCallback(
    async (userText: string) => {
      if (isStreaming) return;
      setError(null);
      setIsStreaming(true);
      onStreamStart?.();

      // Build the actual message sent to the AI:
      // If there are pending images, prepend their URLs so the AI knows about them
      const currentPending = pendingImages;
      let aiMessage = userText;
      if (currentPending.length > 0) {
        const imageList = currentPending
          .map((img) => `- "${img.name}" (${img.url})`)
          .join("\n");
        const prefix =
          currentPending.length === 1
            ? `[Uploaded image: "${currentPending[0].name}" at ${currentPending[0].url}]\n\n`
            : `[Uploaded ${currentPending.length} images:\n${imageList}]\n\n`;
        aiMessage = prefix + (userText || "Use these images as slide backgrounds.");
        setPendingImages([]);
      }

      // Show user message in chat (clean text, no technical URLs)
      const displayText =
        userText ||
        (currentPending.length === 1
          ? `📷 ${currentPending[0].name}`
          : `📷 ${currentPending.length} images`);
      const userMsg: Message = {
        id: crypto.randomUUID(),
        role: "user",
        content: displayText,
      };
      setMessages((prev) => [...prev, userMsg]);

      // Add empty assistant message for streaming
      const assistantId = crypto.randomUUID();
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      abortRef.current = new AbortController();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: aiMessage,
            sessionId,
            carouselId,
            ...(selectedModel ? { model: selectedModel } : {}),
            ...(selectedEffort ? { effort: selectedEffort } : {}),
          }),
          signal: abortRef.current.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(
            (err as { error?: string }).error || "Failed to connect to AI"
          );
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "token" && typeof data.text === "string") {
                  accumulated += data.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: accumulated }
                        : m
                    )
                  );
                } else if (data.type === "result" && typeof data.text === "string") {
                  accumulated = data.text;
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantId
                        ? { ...m, content: accumulated }
                        : m
                    )
                  );
                } else if (data.type === "cost" && typeof data.costUsd === "number") {
                  // Persist cost delta to carousel (fire-and-forget)
                  fetch(`/api/carousels/${carouselId}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ addCostUsd: data.costUsd }),
                  }).catch(() => {});
                }
              } catch {
                // skip unparseable
              }
            } else if (line.startsWith("event: done")) {
              // Next line has the done data
            } else if (
              line.startsWith("data: ") &&
              line.includes("sessionId")
            ) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.sessionId) {
                  setSessionId(data.sessionId);
                  localStorage.setItem(
                    `chat-session-${carouselId}`,
                    data.sessionId
                  );
                }
              } catch {
                // skip
              }
            }
          }
        }

        // Parse any remaining buffer for the done event
        if (buffer.trim()) {
          for (const line of buffer.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.sessionId) {
                  setSessionId(data.sessionId);
                  localStorage.setItem(
                    `chat-session-${carouselId}`,
                    data.sessionId
                  );
                }
              } catch {
                // skip
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        const message = err instanceof Error ? err.message : "An unexpected error occurred";
        setError(message);
        // Remove empty assistant message on error
        setMessages((prev) =>
          prev.filter(
            (m) => m.id !== assistantId || m.content.length > 0
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
        // Persist messages after stream completes
        setMessages((prev) => {
          persistMessages(prev);
          return prev;
        });
        onStreamEnd?.();
      }
    },
    [isStreaming, sessionId, carouselId, pendingImages, selectedModel, selectedEffort, onStreamStart, onStreamEnd, persistMessages]
  );

  // Upload images: file → /api/upload → /api/media (global library)
  // + link to current carousel. Images appear as pending attachments.
  const handleImageUpload = useCallback(
    async (files: File[]) => {
      setIsUploading(true);
      try {
        const results = await Promise.all(
          files.map(async (file) => {
            // 1. Upload file
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (!uploadRes.ok) return null;
            const uploadData = await uploadRes.json();

            // 2. Add to global media library
            const mediaRes = await fetch("/api/media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: uploadData.url,
                name: file.name,
              }),
            });
            if (!mediaRes.ok) return null;
            const mediaImage = await mediaRes.json();

            // 3. Link to current carousel
            await fetch(`/api/carousels/${carouselId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                addMediaImageIds: [mediaImage.id],
              }),
            });

            return { url: uploadData.url as string, name: file.name };
          })
        );

        const uploaded = results.filter(Boolean) as PendingImage[];
        if (uploaded.length === 0) {
          setError("Failed to upload images");
          return;
        }

        setPendingImages((prev) => [...prev, ...uploaded]);
      } catch {
        setError("Failed to upload images");
      } finally {
        setIsUploading(false);
      }
    },
    [carouselId]
  );

  const handleRemovePendingImage = useCallback((url: string) => {
    setPendingImages((prev) => prev.filter((img) => img.url !== url));
  }, []);

  if (!claudeAvailable) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 text-center">
        <Plug className="h-10 w-10 text-muted-foreground mb-3" />
        <h3 className="font-semibold text-sm mb-1">Connect Claude CLI</h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Install Claude CLI to enable AI-powered carousel creation.{" "}
          <a
            href="https://docs.anthropic.com/en/docs/claude-code"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline"
          >
            Install guide
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="px-4 py-3 border-b border-border flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold">AI Assistant</h2>
          <p className="text-xs text-muted-foreground">
            Describe the carousel you want to create
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {models.length > 0 && (
            <select
              value={selectedModel}
              onChange={(e) => handleModelChange(e.target.value)}
              disabled={isStreaming}
              className="text-[10px] bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
              aria-label="Select AI model"
            >
              {models.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          )}
          <select
            value={selectedEffort}
            onChange={(e) => handleEffortChange(e.target.value)}
            disabled={isStreaming}
            className="text-[10px] bg-muted text-muted-foreground border border-border rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50 cursor-pointer"
            aria-label="Select effort level"
          >
            {(["low", "medium", "high", "xhigh", "max"] as const).map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          {messages.length > 0 && (
            <button
              onClick={handleClearChat}
              className="text-[10px] text-muted-foreground hover:text-destructive transition-colors px-1.5 py-0.5 rounded"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <ReferenceImages
        carouselId={carouselId}
        images={referenceImages}
        onImagesChange={() => onStreamEnd?.()}
      />

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="p-6 text-center text-muted-foreground">
            <p className="text-sm mb-1">No messages yet</p>
            <p className="text-xs">
              Tell me what carousel you&apos;d like to create
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
            isStreaming={
              isStreaming &&
              msg.role === "assistant" &&
              msg.id === messages[messages.length - 1]?.id
            }
          />
        ))}
        {error && (
          <div className="mx-4 my-2 flex items-center gap-2 text-destructive text-xs bg-destructive/10 rounded-lg p-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      <ChatInput
        onSend={handleSend}
        isStreaming={isStreaming}
        textareaRef={chatInputRef}
        onStop={handleStopGenerating}
        onImageUpload={handleImageUpload}
        isUploading={isUploading}
        pendingImages={pendingImages}
        onRemovePendingImage={handleRemovePendingImage}
      />
    </div>
  );
}
