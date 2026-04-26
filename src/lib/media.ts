import { readDataSafe, writeData } from "./data";
import type { MediaImage, MediaLibraryData } from "@/types/media";

const FILE = "media.json";

async function load(): Promise<MediaLibraryData> {
  return readDataSafe<MediaLibraryData>(FILE, { images: [] });
}

async function save(data: MediaLibraryData): Promise<void> {
  await writeData(FILE, data);
}

/** List all images in the global media library */
export async function listMediaImages(): Promise<MediaImage[]> {
  const data = await load();
  return data.images;
}

/** Get a single media image by ID */
export async function getMediaImage(id: string): Promise<MediaImage | null> {
  const data = await load();
  return data.images.find((img) => img.id === id) ?? null;
}

/** Get multiple media images by IDs (for local carousel library) */
export async function getMediaImagesByIds(ids: string[]): Promise<MediaImage[]> {
  const data = await load();
  const idSet = new Set(ids);
  return data.images.filter((img) => idSet.has(img.id));
}

/** Add an image to the global media library */
export async function addMediaImage(image: MediaImage): Promise<MediaImage> {
  const data = await load();
  data.images.push(image);
  await save(data);
  return image;
}

/** Update metadata on a media image (description, embedding) */
export async function updateMediaImageMeta(
  id: string,
  meta: Partial<Pick<MediaImage, "description" | "embedding" | "embeddingVocab" | "name">>
): Promise<MediaImage | null> {
  const data = await load();
  const img = data.images.find((i) => i.id === id);
  if (!img) return null;
  Object.assign(img, meta);
  await save(data);
  return img;
}

/** Delete an image from the global media library */
export async function deleteMediaImage(id: string): Promise<boolean> {
  const data = await load();
  const idx = data.images.findIndex((img) => img.id === id);
  if (idx === -1) return false;
  data.images.splice(idx, 1);
  await save(data);
  return true;
}
