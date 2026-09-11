export const ABSOLUTE_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export type PackageId = "day" | "week";

export type FilePackage = {
  id: PackageId;
  price: string;
  retention: "24h" | "7d";
  max_upload_bytes: number;
  max_egress_bytes: number;
  max_downloads: number;
  description: string;
};

export const packages: FilePackage[] = [
  {
    id: "day",
    price: "0.01",
    retention: "24h",
    max_upload_bytes: 3 * 1024 * 1024,
    max_egress_bytes: 50 * 1024 * 1024,
    max_downloads: 100,
    description: "$0.01: one file up to 3 MB, stored for 24 hours, 50 MB transfer",
  },
  {
    id: "week",
    price: "0.05",
    retention: "7d",
    max_upload_bytes: 3 * 1024 * 1024,
    max_egress_bytes: 1_000_000_000,
    max_downloads: 100,
    description: "$0.05: one file up to 3 MB, stored for seven days, 1 GB transfer",
  },
];

export const renewalOffer = {
  price: "0.05",
  extra_egress_bytes: 1_000_000_000,
  description: "This file has reached its transfer allowance. Pay $0.05 to add another 1 GB or let it expire.",
};

const THREE_MB = 3 * 1024 * 1024;

export function selectPackage(input: {
  size_bytes: number;
  retention?: string;
}): FilePackage {
  if (!Number.isFinite(input.size_bytes) || input.size_bytes <= 0) {
    throw Object.assign(new Error("size_bytes must be a positive number"), {
      status: 400,
    });
  }
  if (input.size_bytes > ABSOLUTE_MAX_UPLOAD_BYTES) {
    throw Object.assign(
      new Error("Files larger than 50 MB are not supported"),
      { status: 400 },
    );
  }
  if (input.size_bytes > THREE_MB) {
    throw Object.assign(
      new Error("No package covers this size. Current offers are capped at 3 MB"),
      { status: 400 },
    );
  }

  const retention = normalizeRetention(input.retention);
  const match = packages.find((pkg) => pkg.retention === retention);
  if (!match) {
    throw Object.assign(new Error("Unsupported retention. Use 24h or 7d"), {
      status: 400,
    });
  }
  return match;
}

export function normalizeRetention(value?: string): "24h" | "7d" {
  if (!value || value === "24h" || value === "1d") return "24h";
  if (value === "7d") return "7d";
  throw Object.assign(new Error("retention must be 24h or 7d"), { status: 400 });
}

export function retentionMs(retention: "24h" | "7d"): number {
  return retention === "7d" ? 7 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000;
}

export function envelopeFromPackage(pkg: FilePackage, now = new Date()) {
  return {
    max_upload_bytes: pkg.max_upload_bytes,
    max_egress_bytes: pkg.max_egress_bytes,
    max_downloads: pkg.max_downloads,
    expires_at: new Date(now.getTime() + retentionMs(pkg.retention)).toISOString(),
  };
}
