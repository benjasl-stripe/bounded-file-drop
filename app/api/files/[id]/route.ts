import { gone, errorResponse } from "@/lib/http";
import { getFile, publicEnvelope } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const record = await getFile(id);
    if (!record || record.status === "gone" || record.status === "quarantined") {
      return gone("This file is gone");
    }
    return Response.json({
      file_id: record.id,
      filename: record.filename,
      status: record.status,
      envelope: publicEnvelope(record),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
