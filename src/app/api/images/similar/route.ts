import { NextResponse } from "next/server";
import { listCarousels } from "@/lib/carousels";
import { findSimilar } from "@/lib/vector-store";
import type { ReferenceImage } from "@/types/carousel";

/**
 * POST /api/images/similar
 *
 * Find images similar to a given reference image across all carousels.
 *
 * Body: { imageId: string, topK?: number, threshold?: number }
 * Returns: { query: ReferenceImage, results: Array<{ image: ReferenceImage, carouselId: string, score: number }> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { imageId, topK = 5, threshold = 0.1 } = body as {
      imageId?: string;
      topK?: number;
      threshold?: number;
    };

    if (!imageId || typeof imageId !== "string") {
      return NextResponse.json(
        { error: "imageId is required" },
        { status: 400 }
      );
    }

    const carousels = await listCarousels();

    // Find the query image and build the candidate pool
    let queryImage: ReferenceImage | null = null;

    const candidates: Array<{
      id: string;
      embeddingVocab: string[];
      embedding: number[];
      image: ReferenceImage;
      carouselId: string;
    }> = [];

    for (const carousel of carousels) {
      for (const img of carousel.referenceImages ?? []) {
        if (img.id === imageId) {
          queryImage = img;
          continue; // don't include query in candidates
        }

        // Only include images that have embeddings
        if (img.embedding && img.embeddingVocab) {
          candidates.push({
            id: img.id,
            embeddingVocab: img.embeddingVocab,
            embedding: img.embedding,
            image: img,
            carouselId: carousel.id,
          });
        }
      }
    }

    if (!queryImage) {
      return NextResponse.json(
        { error: "Image not found" },
        { status: 404 }
      );
    }

    if (!queryImage.embedding || !queryImage.embeddingVocab) {
      return NextResponse.json(
        { error: "Query image has no embedding — it may have been uploaded before description generation was enabled" },
        { status: 422 }
      );
    }

    const similar = findSimilar(
      queryImage.embeddingVocab,
      queryImage.embedding,
      candidates,
      topK,
      threshold
    );

    // Enrich results with full image data + carousel context
    const results = similar.map((r) => {
      const match = candidates.find((c) => c.id === r.id)!;
      return {
        image: match.image,
        carouselId: match.carouselId,
        score: Math.round(r.score * 1000) / 1000, // 3 decimal places
      };
    });

    return NextResponse.json({ query: queryImage, results });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}
