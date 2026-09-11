export function json(data: unknown, status = 200) {
  return Response.json(data, { status });
}

export function errorResponse(error: unknown) {
  const status =
    typeof error === "object" && error && "status" in error
      ? Number((error as { status: number }).status)
      : 500;
  const message = error instanceof Error ? error.message : "Internal error";
  return json({ error: message, status }, status || 500);
}

export function gone(message: string) {
  return json({ error: message, status: 410 }, 410);
}

export function originFrom(request: Request) {
  const url = new URL(request.url);
  return process.env.PUBLIC_BASE_URL ?? url.origin;
}
