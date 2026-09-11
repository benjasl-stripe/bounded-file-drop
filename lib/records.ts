import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilePackage } from "./packages";
import { envelopeFromPackage } from "./packages";

export type FileStatus = "pending_upload" | "published" | "quarantined" | "gone";

export type FileRecord = {
  id: string;
  filename: string;
  content_type: string;
  declared_size: number;
  actual_size?: number;
  status: FileStatus;
  payer: string;
  package_id: FilePackage["id"];
  max_upload_bytes: number;
  max_egress_bytes: number;
  max_downloads: number;
  expires_at: string;
  downloads: number;
  egress_bytes: number;
  created_at: string;
  published_at?: string;
};

type DailyBudget = {
  day: string;
  storage_bytes: number;
  egress_bytes: number;
};

const root = path.join(process.cwd(), "data");
const filesDir = path.join(root, "files");
const budgetPath = path.join(root, "daily-budget.json");
let chain: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = chain.then(fn, fn);
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

async function ensureDirs() {
  await mkdir(filesDir, { recursive: true });
}

export async function createFileRecord(input: {
  id: string;
  filename: string;
  content_type: string;
  declared_size: number;
  payer: string;
  pkg: FilePackage;
}): Promise<FileRecord> {
  const envelope = envelopeFromPackage(input.pkg);
  const record: FileRecord = {
    id: input.id,
    filename: input.filename,
    content_type: input.content_type,
    declared_size: input.declared_size,
    status: "pending_upload",
    payer: input.payer,
    package_id: input.pkg.id,
    downloads: 0,
    egress_bytes: 0,
    created_at: new Date().toISOString(),
    ...envelope,
  };
  await withLock(async () => {
    await ensureDirs();
    await writeFile(path.join(filesDir, `${record.id}.json`), JSON.stringify(record, null, 2));
  });
  return record;
}

export async function getFile(id: string): Promise<FileRecord | null> {
  try {
    return JSON.parse(await readFile(path.join(filesDir, `${id}.json`), "utf8")) as FileRecord;
  } catch {
    return null;
  }
}

export async function updateFile(
  id: string,
  patch: Partial<FileRecord>,
): Promise<FileRecord | null> {
  return withLock(async () => {
    const current = await getFile(id);
    if (!current) return null;
    const next = { ...current, ...patch };
    await writeFile(path.join(filesDir, `${id}.json`), JSON.stringify(next, null, 2));
    return next;
  });
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

async function readBudget(): Promise<DailyBudget> {
  try {
    const budget = JSON.parse(await readFile(budgetPath, "utf8")) as DailyBudget;
    if (budget.day === today()) return budget;
  } catch {
    // reset
  }
  return { day: today(), storage_bytes: 0, egress_bytes: 0 };
}

export function dailyLimits() {
  return {
    storage: Number(process.env.DAILY_STORAGE_BYTES ?? 1_000_000_000),
    egress: Number(process.env.DAILY_EGRESS_BYTES ?? 2_000_000_000),
  };
}

export async function reserveDailyStorage(bytes: number) {
  return withLock(async () => {
    await ensureDirs();
    const budget = await readBudget();
    const limits = dailyLimits();
    if (budget.storage_bytes + bytes > limits.storage) {
      throw Object.assign(
        new Error("Daily storage budget reached. Try again tomorrow."),
        { status: 503 },
      );
    }
    budget.storage_bytes += bytes;
    await writeFile(budgetPath, JSON.stringify(budget, null, 2));
  });
}

export async function reserveDailyEgress(bytes: number) {
  return withLock(async () => {
    await ensureDirs();
    const budget = await readBudget();
    const limits = dailyLimits();
    if (budget.egress_bytes + bytes > limits.egress) {
      throw Object.assign(
        new Error("Daily bandwidth budget reached. Try again tomorrow."),
        { status: 503 },
      );
    }
    budget.egress_bytes += bytes;
    await writeFile(budgetPath, JSON.stringify(budget, null, 2));
  });
}

export function publicEnvelope(record: FileRecord) {
  return {
    max_upload_bytes: record.max_upload_bytes,
    max_egress_bytes: record.max_egress_bytes,
    max_downloads: record.max_downloads,
    expires_at: record.expires_at,
    downloads_used: record.downloads,
    egress_bytes_used: record.egress_bytes,
  };
}
