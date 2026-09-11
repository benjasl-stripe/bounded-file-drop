import { Readable } from "node:stream";
import { challengeWithOffer, requirePayment } from "@/lib/mppx";
import { gone, errorResponse } from "@/lib/http";
import { payerFromRequest } from "@/lib/identity";
import { enforceDownloadLimit } from "@/lib/limits";
import { renewalOffer } from "@/lib/packages";
import {
  getFile,
  publicEnvelope,
  reserveDailyEgress,
  updateFile,
} from "@/lib/records";
import { deletePublished, openPublished } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function markGone(id: string, recordExpires: string) {
  await deletePublished(id);
  await updateFile(id, { status: "gone" });
  return gone(`File expired or exceeded its allowance (${recordExpires})`);
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    let record = await getFile(id);
    if (!record || record.status === "gone" || record.status === "quarantined") {
      return gone("This file is gone");
    }
    if (record.status !== "published") {
      return Response.json({ error: "File is not published yet" }, { status: 404 });
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return markGone(id, record.expires_at);
    }

    const size = record.actual_size ?? record.declared_size;
    if (record.downloads >= record.max_downloads) {
      return markGone(id, record.expires_at);
    }
    const egressExceeded = record.egress_bytes + size > record.max_egress_bytes;
    if (egressExceeded) {
      const payment = await requirePayment(
        request,
        renewalOffer.price,
        renewalOffer.description,
      );
      if (!payment.paid) {
        return challengeWithOffer(payment.result.challenge, {
          ...renewalOffer,
          file_id: id,
          envelope: publicEnvelope(record),
        });
      }
      const renewed = await updateFile(id, {
        max_egress_bytes: record.max_egress_bytes + renewalOffer.extra_egress_bytes,
      });
      if (renewed) record = renewed;
    }

    enforceDownloadLimit(record.payer || payerFromRequest(request));
    await reserveDailyEgress(size);
    const next = await updateFile(id, {
      downloads: record.downloads + 1,
      egress_bytes: record.egress_bytes + size,
    });
    if (!next) return gone("This file is gone");

    const body = await openPublished(id);
    const web = Readable.toWeb(body instanceof Readable ? body : Readable.from(body));
    return new Response(web as ReadableStream<Uint8Array>, {
      headers: {
        "content-type": record.content_type,
        "content-disposition": `attachment; filename="${record.filename}"`,
        "content-length": String(size),
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    const record = await getFile(id);
    if (!record || record.status !== "published") {
      return gone("This file is gone");
    }
    if (new Date(record.expires_at).getTime() <= Date.now()) {
      return markGone(id, record.expires_at);
    }

    const payment = await requirePayment(
      request,
      renewalOffer.price,
      renewalOffer.description,
    );
    if (!payment.paid) {
      return challengeWithOffer(payment.result.challenge, {
        ...renewalOffer,
        file_id: id,
        envelope: publicEnvelope(record),
      });
    }

    const renewed = await updateFile(id, {
      max_egress_bytes: record.max_egress_bytes + renewalOffer.extra_egress_bytes,
    });
    return payment.result.withReceipt(
      Response.json({
        file_id: id,
        envelope: renewed ? publicEnvelope(renewed) : null,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
