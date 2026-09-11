import { errorResponse } from "@/lib/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT() {
  try {
    return Response.json(
      { error: "Use the Amazon S3 presigned upload URL returned after payment" },
      { status: 400 },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
