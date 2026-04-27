import { NextResponse } from "next/server";
import { listMediaImages, addMediaImage, deleteMediaImage } from "@/lib/media";
import { generateId, now } from "@/lib/utils";
import { describeImage } from "@/lib/image-describe";
import { computeEmbedding } from "@/lib/vector-store";
import type { MediaImage } from "@/types/media";
import { resolveUploadImagePath } from "@/lib/upload-path";

/** API-safe media image shape without internal filesystem/embedding fields. */
type PublicMediaImage = Pick<MediaImage, "id" | "url" | "name" | "uploadedAt" | "description">;

function toPublicMediaImage(image: MediaImage): PublicMediaImage {
  return {
    id: image.id,
    url: image.url,
    name: image.name,
    uploadedAt: image.uploadedAt,
    description: image.description,
  };
}

/** GET /api/media — list all images in the global media library */
export async function GET() {
  const images = await listMediaImages();
  return NextResponse.json({ images: images.map(toPublicMediaImage) });
}

/** POST /api/media — add an uploaded image to the global media library */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { url, name } = body as { url?: string; name?: string };

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const absPath = resolveUploadImagePath(url);
    if (!absPath) {
      return NextResponse.json(
        { error: "url must be a safe /uploads/... path" },
        { status: 400 }
      );
    }

    // Generate description + embedding (non-fatal)
    let description: string | undefined;
    let embedding: number[] | undefined;
    let embeddingVocab: string[] | undefined;

    try {
      description = await describeImage(absPath);
      const result = computeEmbedding(description);
      embedding = result.vector;
      embeddingVocab = result.vocab;
    } catch (err) {
      console.warn("Failed to generate image description:", err);
    }

    const image = {
      id: generateId(),
      url,
      absPath,
      name: name || "Uploaded image",
      uploadedAt: now(),
      description,
      embedding,
      embeddingVocab,
    };

    const result = await addMediaImage(image);
    return NextResponse.json(toPublicMediaImage(result), { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

/** DELETE /api/media?id={imageId} — remove an image from the global library */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const deleted = await deleteMediaImage(id);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
