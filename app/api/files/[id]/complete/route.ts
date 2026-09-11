import { errorResponse } from "@/lib/http";
import { getFile, publicEnvelope, updateFile } from "@/lib/records";
import { headObject, publishObject, quarantineAndDelete } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const record = await getFile(id);
    if (!record) return Response.json({ error: "Not found" }, { status: 404 });
    if (record.status === "published") {
      return Response.json({ file_id: id, status: record.status, envelope: publicEnvelope(record) });
    }
    if (record.status !== "pending_upload") {
      return Response.json({ error: "Upload is no longer available" }, { status: 410 });
    }

    const meta = await headObject(id, "upload");
    if (!meta) {
      return Response.json({ error: "Upload not found. PUT the file first." }, { status: 409 });
    }

    const actual = meta.size;
    const allowed = actual <= record.declared_size && record.declared_size <= record.max_upload_bytes;
    if (!allowed) {
      await quarantineAndDelete(id);
      await updateFile(id, { status: "quarantined", actual_size: actual });
      return Response.json(
        {
          error: "Uploaded object exceeded the purchased size envelope and was deleted",
          actual_size: actual,
          declared_size: record.declared_size,
          max_upload_bytes: record.max_upload_bytes,
        },
        { status: 409 },
      );
    }

    await publishObject(id);
    const published = await updateFile(id, {
      status: "published",
      actual_size: actual,
      published_at: new Date().toISOString(),
    });
    return Response.json({
      file_id: id,
      status: "published",
      envelope: published ? publicEnvelope(published) : null,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
