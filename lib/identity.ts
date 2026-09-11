import { Credential } from "mppx";

export function payerFromRequest(request: Request): string {
  const raw =
    request.headers.get("Authorization") ??
    request.headers.get("Payment-Authorization");
  if (!raw) return "anonymous";
  try {
    const credential = Credential.deserialize(raw);
    return credential.source ?? request.headers.get("x-forwarded-for") ?? "anonymous";
  } catch {
    return request.headers.get("x-forwarded-for") ?? "anonymous";
  }
}

export function clientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "local"
  );
}
