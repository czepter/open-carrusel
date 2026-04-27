import { NextResponse } from "next/server";
import { getCarousel, updateCarousel } from "@/lib/carousels";
import type { MetaAdCta } from "@/types/carousel";
import { META_AD_CTA_LABELS } from "@/types/carousel";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);
  if (!carousel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    adPrimaryText: carousel.adPrimaryText ?? "",
    adCta: carousel.adCta ?? null,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();
    const rawAdPrimaryText = body?.adPrimaryText;
    const rawAdCta = body?.adCta;

    if (rawAdPrimaryText !== undefined && typeof rawAdPrimaryText !== "string") {
      return NextResponse.json(
        { error: "adPrimaryText must be a string" },
        { status: 400 }
      );
    }

    if (rawAdCta !== undefined && typeof rawAdCta !== "string") {
      return NextResponse.json(
        { error: "adCta must be a string" },
        { status: 400 }
      );
    }

    const adPrimaryText =
      typeof rawAdPrimaryText === "string" ? rawAdPrimaryText.trim() : undefined;
    const adCta = typeof rawAdCta === "string" ? rawAdCta.trim() : undefined;

    if (adPrimaryText !== undefined && adPrimaryText.length > 125) {
      return NextResponse.json(
        { error: "adPrimaryText exceeds 125 characters" },
        { status: 400 }
      );
    }

    const validCtaValues = Object.keys(META_AD_CTA_LABELS) as MetaAdCta[];
    const safeCta =
      adCta && validCtaValues.includes(adCta as MetaAdCta)
        ? (adCta as MetaAdCta)
        : undefined;

    const updated = await updateCarousel(id, { adPrimaryText, adCta: safeCta });
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({
      adPrimaryText: updated.adPrimaryText ?? "",
      adCta: updated.adCta ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
