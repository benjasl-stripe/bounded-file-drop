const types: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  zip: "application/zip",
  md: "text/markdown",
};

export function contentTypeFor(filename: string) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return types[ext] ?? "application/octet-stream";
}
