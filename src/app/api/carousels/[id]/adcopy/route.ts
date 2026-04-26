import { NextResponse } from "next/server";
import { getCarousel, updateCarousel } from "@/lib/carousels";
import type { MetaAdCta } from "@/types/carousel";

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
    const { adPrimaryText, adCta } = body as {
      adPrimaryText?: string;
      adCta?: MetaAdCta;
    };
    const updated = await updateCarousel(id, { adPrimaryText, adCta });
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
