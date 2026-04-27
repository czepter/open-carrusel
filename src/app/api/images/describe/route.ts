import { NextResponse } from "next/server";
import { listCarousels, updateReferenceImageMeta } from "@/lib/carousels";
import { describeImage } from "@/lib/image-describe";
import { computeEmbedding } from "@/lib/vector-store";

/**
 * POST /api/images/describe
 *
 * Backfill descriptions + embeddings for reference images that don't have them.
 * Optionally accepts { imageId } to describe a single image, or processes all
 * images missing descriptions when called without a body.
 *
 * Returns: { processed: number, errors: number, results: Array<{ imageId, description, error? }> }
 */
export async function POST(request: Request) {
  try {
    let targetImageId: string | undefined;
    try {
      const body = await request.json();
      targetImageId = body?.imageId;
    } catch {
      // No body — process all
    }

    const carousels = await listCarousels();
    const results: Array<{ imageId: string; description?: string; error?: string }> = [];
    let processed = 0;
    let errors = 0;

    for (const carousel of carousels) {
      for (const img of carousel.referenceImages ?? []) {
        // Skip if already has description (unless targeting this specific image)
        if (img.description && img.id !== targetImageId) continue;
        // Skip if targeting a different image
        if (targetImageId && img.id !== targetImageId) continue;

        try {
          const description = await describeImage(img.absPath);
          const { vocab, vector } = computeEmbedding(description);

          await updateReferenceImageMeta(carousel.id, img.id, {
            description,
            embedding: vector,
            embeddingVocab: vocab,
          });

          results.push({ imageId: img.id, description });
          processed++;
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          results.push({ imageId: img.id, error: message });
          errors++;
        }
      }
    }

    return NextResponse.json({ processed, errors, results });
  } catch {
    return NextResponse.json(
      { error: "Failed to process images" },
      { status: 500 }
    );
  }
}
