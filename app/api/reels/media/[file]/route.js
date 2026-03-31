import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PREVIEW_CACHE_DIR = path.join(os.tmpdir(), "reel-preview-cache");

function sanitizeFileName(input) {
  const name = String(input || "").trim();
  if (!name) return "";
  if (name.includes("/") || name.includes("\\") || name.includes("\0")) return "";
  return name;
}

function contentTypeFromPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov") return "video/quicktime";
  return "video/mp4";
}

function parseRange(rangeHeader, fileSize) {
  if (!rangeHeader || !rangeHeader.startsWith("bytes=")) return null;
  const [startPart, endPart] = rangeHeader.replace("bytes=", "").split("-");
  const start = Number.parseInt(startPart, 10);
  const end = endPart ? Number.parseInt(endPart, 10) : fileSize - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  if (start < 0 || end < start || end >= fileSize) return null;

  return { start, end };
}

export async function GET(request, { params }) {
  try {
    const fileName = sanitizeFileName(params?.file);
    if (!fileName) {
      return NextResponse.json({ error: "잘못된 파일 경로입니다." }, { status: 400 });
    }

    const filePath = path.join(PREVIEW_CACHE_DIR, fileName);
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return NextResponse.json({ error: "파일을 찾을 수 없습니다." }, { status: 404 });
    }

    const fileSize = stats.size;
    const contentType = contentTypeFromPath(filePath);
    const range = parseRange(request.headers.get("range"), fileSize);

    if (range) {
      const { start, end } = range;
      const chunkSize = end - start + 1;
      const stream = createReadStream(filePath, { start, end });
      return new Response(Readable.toWeb(stream), {
        status: 206,
        headers: {
          "Content-Type": contentType,
          "Content-Length": String(chunkSize),
          "Content-Range": `bytes ${start}-${end}/${fileSize}`,
          "Accept-Ranges": "bytes",
          "Cache-Control": "private, max-age=3600",
        },
      });
    }

    const stream = createReadStream(filePath);
    return new Response(Readable.toWeb(stream), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(fileSize),
        "Accept-Ranges": "bytes",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "재생용 미디어를 읽지 못했습니다." }, { status: 404 });
  }
}
