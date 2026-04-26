import { NextResponse } from "next/server";
import { listCarousels, createCarousel } from "@/lib/carousels";
import type { AspectRatio, CarouselMode } from "@/types/carousel";

export async function GET() {
  const carousels = await listCarousels();
  return NextResponse.json({ carousels });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, aspectRatio, mode } = body as {
      name?: string;
      aspectRatio?: AspectRatio;
      mode?: CarouselMode;
    };

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    const validRatios: AspectRatio[] = ["1:1", "4:5", "9:16", "1.91:1"];
    const ratio = validRatios.includes(aspectRatio as AspectRatio)
      ? (aspectRatio as AspectRatio)
      : "4:5";

    const carousel = await createCarousel(name.trim(), ratio, mode || "organic");
    return NextResponse.json(carousel, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
