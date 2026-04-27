import { NextResponse } from "next/server";
import { getCarousel, applyFontSettingsToCarousel } from "@/lib/carousels";
import { applyFontSettingsToHtml } from "@/lib/slide-html";
import type { CarouselFontSettings } from "@/types/carousel";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);
  if (!carousel) {
    return NextResponse.json({ error: "Carousel not found" }, { status: 404 });
  }

  let settings: CarouselFontSettings;
  try {
    const body = await request.json();
    settings = body.fontSettings ?? carousel.fontSettings;
    if (!settings) {
      return NextResponse.json(
        { error: "fontSettings required" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const updated = await applyFontSettingsToCarousel(
    id,
    settings,
    applyFontSettingsToHtml
  );

  if (!updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(updated);
}
