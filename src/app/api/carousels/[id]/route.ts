import { NextResponse } from "next/server";
import { getCarousel, updateCarousel, deleteCarousel, addMediaImageIds } from "@/lib/carousels";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const carousel = await getCarousel(id);
  if (!carousel) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json(carousel);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const body = await request.json();

    // Handle media image linking separately
    if (body.addMediaImageIds) {
      await addMediaImageIds(id, body.addMediaImageIds);
    }

    // Strip non-updateCarousel fields before passing
    const { addMediaImageIds: _, ...updates } = body;
    const updated = Object.keys(updates).length > 0
      ? await updateCarousel(id, updates)
      : await getCarousel(id);
    if (!updated) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const deleted = await deleteCarousel(id);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
