import { readDataSafe, modifyData } from "./data";
import type { MediaImage, MediaLibraryData } from "@/types/media";

const FILE = "media.json";

async function load(): Promise<MediaLibraryData> {
  return readDataSafe<MediaLibraryData>(FILE, { images: [] });
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
  await modifyData<MediaLibraryData>(FILE, { images: [] }, (data) => {
    data.images.push(image);
    return data;
  });
  return image;
}

/** Update metadata on a media image (description, embedding) */
export async function updateMediaImageMeta(
  id: string,
  meta: Partial<Pick<MediaImage, "description" | "embedding" | "embeddingVocab" | "name">>
): Promise<MediaImage | null> {
  let updated: MediaImage | null = null;
  await modifyData<MediaLibraryData>(FILE, { images: [] }, (data) => {
    const img = data.images.find((i) => i.id === id);
    if (!img) return data;
    Object.assign(img, meta);
    updated = img;
    return data;
  });
  return updated;
}

/** Delete an image from the global media library */
export async function deleteMediaImage(id: string): Promise<boolean> {
  let deleted = false;
  await modifyData<MediaLibraryData>(FILE, { images: [] }, (data) => {
    const idx = data.images.findIndex((img) => img.id === id);
    if (idx === -1) return data;
    data.images.splice(idx, 1);
    deleted = true;
    return data;
  });
  return deleted;
}
