import { Mppx, tempo } from "mppx/server";
import { PATH_USD } from "./pathusd";
import { account } from "./wallet";

export const mppx = Mppx.create({
  methods: [
    tempo.charge({
      account,
      chainId: 42431,
      currency: PATH_USD,
      testnet: true,
    }),
  ],
  secretKey: process.env.MPP_SECRET_KEY!,
});

export async function requirePayment(
  request: Request,
  amount: string,
  description: string,
) {
  const result = await mppx.charge({ amount, description })(request);
  if (result.status === 402) return { paid: false as const, result };
  return { paid: true as const, result };
}

export async function challengeWithOffer(
  challenge: Response,
  offer: unknown,
): Promise<Response> {
  const headers = new Headers(challenge.headers);
  headers.set("content-type", "application/problem+json");
  let body: Record<string, unknown> = {};
  try {
    body = (await challenge.clone().json()) as Record<string, unknown>;
  } catch {
    body = { title: "Payment Required", status: 402 };
  }
  return new Response(JSON.stringify({ ...body, offer }), {
    status: 402,
    headers,
  });
}
