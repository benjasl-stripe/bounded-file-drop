import { OPENAPI_PATH, PACKAGES_PATH } from "@/lib/discovery";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const origin = new URL(request.url).origin;
  const body = [
    "# Bounded file drop",
    "",
    "Pay for a file envelope before any bytes are stored. Hard limits. No unpaid overages.",
    "",
    `Machine description: ${origin}${OPENAPI_PATH}`,
    `Catalog: ${origin}${PACKAGES_PATH}`,
    "",
    "Give an agent one sentence and this origin. It should read OpenAPI, pay HTTP 402s in pathUSD on Tempo testnet (chain 42431), and follow the URLs in JSON responses.",
    "Tempo Wallet credits cannot pay this API.",
    "",
    "Example: Upload report.pdf using this origin. Follow /openapi.json and pay HTTP 402s.",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}
