import { NextResponse } from "next/server";
import { addReferenceImage, removeReferenceImage, getCarousel } from "@/lib/carousels";
import { generateId, now } from "@/lib/utils";
import { describeImage } from "@/lib/image-describe";
import { computeEmbedding } from "@/lib/vector-store";
import { resolveUploadImagePath } from "@/lib/upload-path";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);
  if (!carousel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ references: carousel.referenceImages || [] });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
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

    // Generate verbal description via Claude vision + compute embedding
    let description: string | undefined;
    let embedding: number[] | undefined;
    let embeddingVocab: string[] | undefined;

    try {
      description = await describeImage(absPath);
      const result = computeEmbedding(description);
      embedding = result.vector;
      embeddingVocab = result.vocab;
    } catch (err) {
      // Non-fatal: store the image even if description generation fails
      // (e.g. missing Claude CLI, missing Claude authentication, or insufficient tool permissions)
      console.warn("Failed to generate image description:", err);
    }

    const ref = {
      id: generateId(),
      url,
      absPath,
      name: name || "Reference image",
      addedAt: now(),
      description,
      embedding,
      embeddingVocab,
    };

    const result = await addReferenceImage(id, ref);
    if (!result) {
      return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const { searchParams } = new URL(request.url);
    const imageId = searchParams.get("imageId");
    if (!imageId) {
      return NextResponse.json({ error: "imageId is required" }, { status: 400 });
    }

    const deleted = await removeReferenceImage(id, imageId);
    if (!deleted) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
