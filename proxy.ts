import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SERVICE_DESC_LINKS } from "@/lib/discovery";

export function proxy(_request: NextRequest) {
  const response = NextResponse.next();
  response.headers.append("Link", SERVICE_DESC_LINKS);
  return response;
}

export const config = {
  matcher: ["/", "/api/:path*", "/f/:path*", "/openapi.json", "/llms.txt"],
};
