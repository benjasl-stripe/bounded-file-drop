import { packages, renewalOffer, ABSOLUTE_MAX_UPLOAD_BYTES } from "@/lib/packages";

export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    absolute_max_upload_bytes: ABSOLUTE_MAX_UPLOAD_BYTES,
    packages,
    renewal: renewalOffer,
  });
}
