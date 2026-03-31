import { promises as fs } from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "reel-cache.json");

let writeQueue = Promise.resolve();

function emptyDb() {
  return {
    version: 1,
    reels: {},
  };
}

async function ensureDbFile() {
  await fs.mkdir(DB_DIR, { recursive: true });
  try {
    await fs.access(DB_PATH);
  } catch {
    await fs.writeFile(DB_PATH, JSON.stringify(emptyDb(), null, 2), "utf8");
  }
}

async function readDb() {
  await ensureDbFile();
  try {
    const raw = await fs.readFile(DB_PATH, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyDb();
    if (!parsed.reels || typeof parsed.reels !== "object") return emptyDb();
    return {
      version: 1,
      reels: parsed.reels,
    };
  } catch {
    return emptyDb();
  }
}

function queueWrite(task) {
  writeQueue = writeQueue.then(task, task);
  return writeQueue;
}

function normalizeReelId(reelId) {
  return String(reelId || "").trim();
}

export async function getReelCache(reelId) {
  const key = normalizeReelId(reelId);
  if (!key) return null;

  const db = await readDb();
  const entry = db.reels[key];
  if (!entry || typeof entry !== "object") return null;
  return entry;
}

export async function listReelCaches(limit = 120) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 120, 500));
  const db = await readDb();
  const entries = Object.values(db.reels || {})
    .filter((entry) => entry && typeof entry === "object")
    .sort((left, right) => {
      const leftTime = Date.parse(String(left?.updatedAt || "")) || 0;
      const rightTime = Date.parse(String(right?.updatedAt || "")) || 0;
      return rightTime - leftTime;
    });

  return entries.slice(0, safeLimit);
}

export async function upsertReelCache(reelId, patch = {}) {
  const key = normalizeReelId(reelId);
  if (!key) return null;

  return queueWrite(async () => {
    const db = await readDb();
    const previous = db.reels[key] && typeof db.reels[key] === "object" ? db.reels[key] : {};

    const next = {
      ...previous,
      ...patch,
      reelId: key,
      updatedAt: new Date().toISOString(),
    };

    db.reels[key] = next;
    await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), "utf8");
    return next;
  });
}
