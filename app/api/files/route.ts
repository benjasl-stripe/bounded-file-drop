import { randomUUID } from "node:crypto";
import { challengeWithOffer, requirePayment } from "@/lib/mppx";
import { contentTypeFor } from "@/lib/content-type";
import { originFrom, errorResponse } from "@/lib/http";
import { clientIp, payerFromRequest } from "@/lib/identity";
import {
  enforcePaidCreateLimit,
  enforcePaymentMethodLimit,
  enforceProbeLimit,
} from "@/lib/limits";
import { envelopeFromPackage, selectPackage } from "@/lib/packages";
import { createFileRecord, publicEnvelope, reserveDailyStorage } from "@/lib/records";
import { applyLifecycleBackup, createConstrainedUpload } from "@/lib/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CreateBody = {
  filename?: string;
  size_bytes?: number;
  retention?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.clone().json()) as CreateBody;
    if (!body.filename || typeof body.size_bytes !== "number") {
      return Response.json(
        { error: "filename and size_bytes are required" },
        { status: 400 },
      );
    }

    const pkg = selectPackage({
      size_bytes: body.size_bytes,
      retention: body.retention,
    });
    const offer = {
      package_id: pkg.id,
      price: pkg.price,
      description: pkg.description,
      ...envelopeFromPackage(pkg),
    };

    enforceProbeLimit(clientIp(request));

    const payment = await requirePayment(request, pkg.price, pkg.description);
    if (!payment.paid) {
      return challengeWithOffer(payment.result.challenge, offer);
    }

    const payer = payerFromRequest(request);
    enforcePaidCreateLimit(payer);
    enforcePaymentMethodLimit("tempo");
    await reserveDailyStorage(body.size_bytes);

    const id = randomUUID();
    const contentType = contentTypeFor(body.filename);
    const record = await createFileRecord({
      id,
      filename: body.filename,
      content_type: contentType,
      declared_size: body.size_bytes,
      payer,
      pkg,
    });
    const upload = await createConstrainedUpload({
      id,
      sizeBytes: body.size_bytes,
      contentType,
      origin: originFrom(request),
    });
    await applyLifecycleBackup().catch(() => undefined);

    return payment.result.withReceipt(
      Response.json({
        file_id: id,
        status: record.status,
        upload,
        download_url: `${originFrom(request)}/f/${id}`,
        complete_url: `${originFrom(request)}/api/files/${id}/complete`,
        envelope: publicEnvelope(record),
        offer,
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
