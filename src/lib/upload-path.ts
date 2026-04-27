import path from "path";

function getUploadsDir(): string {
  return path.resolve(process.cwd(), "public", "uploads");
}

/**
 * Resolves a client-provided media URL to an absolute path inside public/uploads.
 * Returns null when the input is not a safe uploads URL (wrong prefix, traversal,
 * or path escaping outside the uploads directory).
 */
export function resolveUploadImagePath(url: string): string | null {
  if (!url.startsWith("/uploads/")) return null;
  if (url.includes("..") || url.includes("\0")) return null;
  const relative = url.replace(/^\/+/, "");
  const absPath = path.resolve(process.cwd(), "public", relative);
  const relativeToUploads = path.relative(getUploadsDir(), absPath);
  if (relativeToUploads.startsWith("..") || path.isAbsolute(relativeToUploads)) {
    return null;
  }
  return absPath;
}
