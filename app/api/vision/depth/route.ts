export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return Response.json(
        { error: "imageUrl is required" },
        { status: 400 }
      );
    }

    // Simple fallback: return default depth map structure
    // In production, this would call a vision API or ML model
    const defaultFloorY = 260; // ~65% of 400px default height
    const defaultDepthMap: number[][] = Array(400)
      .fill(null)
      .map(() => Array(600).fill(0.5));

    return Response.json({
      depthMap: defaultDepthMap,
      floorStartY: defaultFloorY,
      floorBoundary: [
        { x: 0, y: defaultFloorY },
        { x: 600, y: defaultFloorY },
        { x: 600, y: 400 },
        { x: 0, y: 400 },
      ],
    });
  } catch (error) {
    console.error("[API VISION DEPTH] Error:", error);
    return Response.json(
      { error: "Failed to process depth estimation" },
      { status: 500 }
    );
  }
}
