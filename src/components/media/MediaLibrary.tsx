"use client";

import { useEffect, useState, useCallback } from "react";
import { ImagePlus, Trash2, X, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { MediaImage } from "@/types/media";

export function MediaLibrary() {
  const [images, setImages] = useState<MediaImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [previewImage, setPreviewImage] = useState<MediaImage | null>(null);

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch("/api/media");
      if (res.ok) {
        const data = await res.json();
        setImages(data.images || []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchImages();
  }, [fetchImages]);

  const handleUpload = useCallback(async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png,image/jpeg,image/webp";
    input.multiple = true;
    input.onchange = async (e) => {
      const fileList = (e.target as HTMLInputElement).files;
      if (!fileList || fileList.length === 0) return;

      setUploading(true);
      try {
        await Promise.all(
          Array.from(fileList).map(async (file) => {
            // 1. Upload file
            const formData = new FormData();
            formData.append("file", file);
            const uploadRes = await fetch("/api/upload", {
              method: "POST",
              body: formData,
            });
            if (!uploadRes.ok) return;
            const uploadData = await uploadRes.json();

            // 2. Add to media library
            await fetch("/api/media", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                url: uploadData.url,
                name: file.name,
              }),
            });
          })
        );
        await fetchImages();
      } catch {
        // ignore
      } finally {
        setUploading(false);
      }
    };
    input.click();
  }, [fetchImages]);

  const handleDelete = useCallback(
    async (id: string) => {
      const res = await fetch(`/api/media?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setImages((prev) => prev.filter((img) => img.id !== id));
        if (previewImage?.id === id) setPreviewImage(null);
      }
    },
    [previewImage]
  );

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {images.length} {images.length === 1 ? "image" : "images"}
        </p>
        <Button onClick={handleUpload} variant="accent" disabled={uploading}>
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Uploading..." : "Upload Images"}
        </Button>
      </div>

      {images.length === 0 ? (
        <div className="text-center py-20">
          <ImageIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-lg font-semibold mb-2">No images yet</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Upload images to use as slide backgrounds across all your carousels.
          </p>
          <Button onClick={handleUpload} variant="accent" size="lg">
            <ImagePlus className="h-5 w-5" />
            Upload Your First Images
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => (
            <div
              key={img.id}
              className="group relative aspect-square rounded-xl overflow-hidden border border-border hover:border-accent/50 hover:shadow-md transition-all cursor-pointer"
              onClick={() => setPreviewImage(img)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.name}
                className="w-full h-full object-cover"
              />
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />
              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(img.id);
                }}
                className="absolute top-2 right-2 h-7 w-7 rounded-lg flex items-center justify-center bg-white/90 border border-border hover:bg-destructive hover:text-white hover:border-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label={`Delete ${img.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
              {/* Name */}
              <div className="absolute bottom-0 inset-x-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[11px] text-white truncate">{img.name}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-8"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="relative max-w-3xl w-full bg-surface rounded-2xl overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage.url}
              alt={previewImage.name}
              className="w-full max-h-[60vh] object-contain bg-muted"
            />
            <div className="p-4">
              <h3 className="font-semibold text-sm truncate">
                {previewImage.name}
              </h3>
              {previewImage.description && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-3">
                  {previewImage.description}
                </p>
              )}
              <p className="text-[10px] text-muted-foreground mt-2">
                {previewImage.url}
              </p>
            </div>
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-3 right-3 h-8 w-8 rounded-full bg-white/90 text-foreground flex items-center justify-center shadow-lg hover:bg-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
