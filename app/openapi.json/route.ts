import { openApiDocument } from "@/lib/openapi";

export const dynamic = "force-dynamic";

export function GET() {
  return new Response(JSON.stringify(openApiDocument()), {
    headers: {
      "content-type": "application/openapi+json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
