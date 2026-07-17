#!/usr/bin/env node
/**
 * Build durable local thumbnails for every video in the exercise catalogue.
 *
 * Instagram recovery order:
 *   1. A live remote candidate already present in the catalogue.
 *   2. The post's public og:image value.
 *
 * TikTok recovery order:
 *   1. A live remote candidate already present in the catalogue.
 *   2. The official TikTok oEmbed thumbnail_url value.
 *
 * Every downloaded image is decoded, checked against known bad assets,
 * normalized to JPEG with sharp, and atomically moved into public/thumbs.
 * Unavailable posts receive a durable raster fallback generated from the
 * repository's OTF logo. A fallback is retried on every later run.
 */

import { createHash, randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  open,
  readFile,
  rename,
  rm,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(SCRIPT_DIR, "..");
export const DEFAULT_CATALOG_PATH = path.join(
  REPO_ROOT,
  "src",
  "data",
  "exercises.json",
);
export const DEFAULT_THUMBS_DIR = path.join(REPO_ROOT, "public", "thumbs");
export const DEFAULT_REPORT_PATH = path.join(
  REPO_ROOT,
  "docs",
  "qa",
  "latest",
  "thumbnail-report.json",
);
export const FALLBACK_URL = "/thumbs/fallback-exercise.jpg";
export const FALLBACK_FILENAME = "fallback-exercise.jpg";

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_BETWEEN_ITEMS_MS = 200;
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 400;
const MIN_IMAGE_BYTES = 1_000;
const MIN_IMAGE_DIMENSION = 64;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_METADATA_BYTES = 2 * 1024 * 1024;
const NORMALIZED_WIDTH = 640;
const NORMALIZED_JPEG_QUALITY = 72;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15";

// Historical Instagram branding page accidentally saved as a post thumbnail.
// Checking content, rather than only its old 778,568-byte size, avoids false
// positives if Instagram changes the asset or a legitimate file shares a size.
export const KNOWN_BAD_IMAGE_HASHES = new Set([
  "b421b00fd1791a1d1ab70dd1e9667f40ca79a8c8673989864f1be092295cd7da",
]);

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function isHttpUrl(value) {
  if (typeof value !== "string") return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function instagramShortcodeFromUrl(url) {
  const match = /\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/.exec(url ?? "");
  return match?.[1] ?? null;
}

export function tiktokVideoId(video) {
  const fromUrl = /\/video\/(\d+)/.exec(video?.url ?? "")?.[1];
  if (fromUrl) return fromUrl;
  const fromId = String(video?.id ?? "").replace(/^tt_/, "");
  return /^\d+$/.test(fromId) ? fromId : null;
}

export function canonicalThumbnailForVideo(video) {
  if (video?.source === "instagram") {
    const shortcode =
      instagramShortcodeFromUrl(video.url) ??
      (/^ig_([A-Za-z0-9_-]+)$/.exec(String(video.id ?? ""))?.[1] ?? null);
    if (!shortcode) return null;
    return {
      filename: `${shortcode}.jpg`,
      localUrl: `/thumbs/${shortcode}.jpg`,
    };
  }

  if (video?.source === "tiktok") {
    const id = tiktokVideoId(video);
    if (!id) return null;
    return {
      filename: `tiktok-${id}.jpg`,
      localUrl: `/thumbs/tiktok-${id}.jpg`,
    };
  }

  return null;
}

function decodeHtmlEntities(value) {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x2F;/gi, "/")
    .replace(/&#x3D;/gi, "=");
}

function attributeFromTag(tag, name) {
  const expression = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "i",
  );
  const match = expression.exec(tag);
  return match ? decodeHtmlEntities(match[1] ?? match[2] ?? match[3] ?? "") : null;
}

export function ogImageFromHtml(html) {
  for (const match of String(html).matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0];
    const property = attributeFromTag(tag, "property") ?? attributeFromTag(tag, "name");
    if (property?.toLowerCase() !== "og:image") continue;
    const content = attributeFromTag(tag, "content");
    if (isHttpUrl(content)) return content;
  }
  return null;
}

export function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function validateImageBuffer(
  buffer,
  {
    minBytes = MIN_IMAGE_BYTES,
    minDimension = MIN_IMAGE_DIMENSION,
    maxBytes = MAX_IMAGE_BYTES,
    knownBadHashes = KNOWN_BAD_IMAGE_HASHES,
  } = {},
) {
  if (!Buffer.isBuffer(buffer)) throw new Error("image payload is not a buffer");
  if (buffer.length < minBytes) {
    throw new Error(`image is too small (${buffer.length} bytes)`);
  }
  if (buffer.length > maxBytes) {
    throw new Error(`image is too large (${buffer.length} bytes)`);
  }

  const hash = sha256(buffer);
  if (knownBadHashes.has(hash)) throw new Error(`known bad image hash (${hash})`);

  let metadata;
  try {
    const decoder = sharp(buffer, { failOn: "error", limitInputPixels: true });
    metadata = await decoder.metadata();
    // metadata() alone may only parse a header. Rendering one pixel forces a
    // complete decoder pass so truncated/corrupt inputs are rejected.
    await decoder.clone().resize(1, 1, { fit: "fill" }).raw().toBuffer();
  } catch (error) {
    throw new Error(`image decode failed: ${error.message}`);
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width < minDimension ||
    metadata.height < minDimension
  ) {
    throw new Error(
      `image dimensions are too small (${metadata.width ?? 0}x${metadata.height ?? 0})`,
    );
  }

  return {
    bytes: buffer.length,
    format: metadata.format ?? "unknown",
    hash,
    height: metadata.height,
    width: metadata.width,
  };
}

export async function normalizeImage(buffer) {
  await validateImageBuffer(buffer);
  const { data, info } = await sharp(buffer, {
    failOn: "error",
    limitInputPixels: true,
  })
    .rotate()
    .resize({ width: NORMALIZED_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: NORMALIZED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });
  const validation = await validateImageBuffer(data);
  return { buffer: data, info, validation };
}

async function atomicWrite(filePath, contents) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );
  let handle;
  try {
    handle = await open(temporaryPath, "wx");
    await handle.writeFile(contents);
    await handle.sync();
    await handle.close();
    handle = null;
    await rename(temporaryPath, filePath);
  } finally {
    if (handle) await handle.close().catch(() => {});
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

async function atomicWriteJson(filePath, value) {
  await atomicWrite(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function localPathFromUrl(localUrl, thumbsDir) {
  const match = /^\/thumbs\/([A-Za-z0-9._-]+)$/.exec(localUrl ?? "");
  return match ? path.join(thumbsDir, match[1]) : null;
}

async function validateLocalThumbnail(localUrl, thumbsDir) {
  const diskPath = localPathFromUrl(localUrl, thumbsDir);
  if (!diskPath) return { valid: false, reason: "not a safe /thumbs/ path" };
  try {
    const buffer = await readFile(diskPath);
    const validation = await validateImageBuffer(buffer);
    return { valid: true, diskPath, localUrl, ...validation };
  } catch (error) {
    return { valid: false, diskPath, localUrl, reason: error.message };
  }
}

function retryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status >= 500;
}

async function cancelResponseBody(response, reason) {
  if (!response?.body || response.body.locked) return;
  try {
    await response.body.cancel(reason);
  } catch {
    // Cancellation is best-effort; preserve the request's original failure.
  }
}

function abortReason(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  return new Error(signal?.reason ? String(signal.reason) : "request aborted");
}

function waitForRead(readPromise, signal) {
  if (!signal) return readPromise;
  if (signal.aborted) return Promise.reject(abortReason(signal));
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(abortReason(signal));
    };
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    signal.addEventListener("abort", onAbort, { once: true });
    readPromise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

export async function readResponseBodyWithLimit(
  response,
  { maxBytes = MAX_IMAGE_BYTES, signal } = {},
) {
  if (!Number.isInteger(maxBytes) || maxBytes < 1) {
    throw new Error("maxBytes must be a positive integer");
  }

  const declaredLength = Number.parseInt(
    response.headers.get("content-length") ?? "",
    10,
  );
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponseBody(
      response,
      new Error(`response body exceeds ${maxBytes} bytes`),
    );
    throw new Error(`response body exceeds ${maxBytes} bytes (${declaredLength} declared)`);
  }
  if (!response.body) return Buffer.alloc(0);

  const reader = response.body.getReader();
  const chunks = [];
  let completed = false;
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await waitForRead(reader.read(), signal);
      if (done) {
        completed = true;
        break;
      }
      const byteLength = value?.byteLength ?? 0;
      if (totalBytes + byteLength > maxBytes) {
        throw new Error(
          `response body exceeds ${maxBytes} bytes (streamed at least ${totalBytes + byteLength})`,
        );
      }
      totalBytes += byteLength;
      chunks.push(Buffer.from(value.buffer, value.byteOffset, byteLength));
    }
    return Buffer.concat(chunks, totalBytes);
  } finally {
    if (!completed) {
      try {
        await reader.cancel(signal?.reason ?? "response body rejected");
      } catch {
        // The stream may already be errored or aborted.
      }
    }
    try {
      reader.releaseLock();
    } catch {
      // A platform stream may retain its lock after a terminal read error.
    }
  }
}

export async function fetchWithRetry(
  url,
  options = {},
  {
    attempts = DEFAULT_ATTEMPTS,
    consumeResponse = async (response) => response,
    fetchImpl = fetch,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    sleepImpl = sleep,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = {},
) {
  let finalError;
  let attemptsMade = 0;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    attemptsMade = attempt;
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(new Error(`timeout after ${timeoutMs}ms`)),
      timeoutMs,
    );
    let response;
    try {
      response = await fetchImpl(url, {
        ...options,
        redirect: "follow",
        signal: controller.signal,
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        error.retryable = retryableStatus(response.status);
        await cancelResponseBody(response, error);
        throw error;
      }
      // Keep the per-attempt timeout active until the body has been consumed.
      // Body stream failures therefore enter the same retry path as fetch errors.
      return await consumeResponse(response, { signal: controller.signal });
    } catch (error) {
      await cancelResponseBody(response, error);
      finalError = error;
      const shouldRetry = error.retryable !== false && attempt < attempts;
      if (!shouldRetry) break;
      await sleepImpl(retryDelayMs * 2 ** (attempt - 1));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error(
    `request failed after ${attemptsMade} attempt(s): ${finalError?.message ?? finalError}`,
  );
}

async function resolvePlatformCandidate(video, requestOptions) {
  if (video.source === "instagram") {
    const candidate = await fetchWithRetry(
      video.url,
      {
        headers: {
          "Accept-Language": "en-US,en;q=0.9",
          "User-Agent": USER_AGENT,
        },
      },
      {
        ...requestOptions,
        consumeResponse: async (response, { signal }) => {
          const body = await readResponseBodyWithLimit(response, {
            maxBytes: MAX_METADATA_BYTES,
            signal,
          });
          const value = ogImageFromHtml(body.toString("utf8"));
          if (!value) throw new Error("Instagram post has no usable og:image");
          return value;
        },
      },
    );
    return { origin: "instagram-og-image", url: candidate };
  }

  if (video.source === "tiktok") {
    const endpoint = `https://www.tiktok.com/oembed?url=${encodeURIComponent(video.url)}`;
    const payload = await fetchWithRetry(
      endpoint,
      { headers: { Accept: "application/json", "User-Agent": USER_AGENT } },
      {
        ...requestOptions,
        consumeResponse: async (response, { signal }) => {
          const body = await readResponseBodyWithLimit(response, {
            maxBytes: MAX_METADATA_BYTES,
            signal,
          });
          try {
            return JSON.parse(body.toString("utf8"));
          } catch (error) {
            throw new Error(`TikTok oEmbed returned invalid JSON: ${error.message}`);
          }
        },
      },
    );
    if (!isHttpUrl(payload?.thumbnail_url)) {
      throw new Error("TikTok oEmbed has no usable thumbnail_url");
    }
    return { origin: "tiktok-oembed", url: payload.thumbnail_url };
  }

  throw new Error(`unsupported source: ${video.source ?? "missing"}`);
}

async function downloadCandidate(candidate, video, requestOptions) {
  const referer =
    video.source === "instagram"
      ? "https://www.instagram.com/"
      : "https://www.tiktok.com/";
  const buffer = await fetchWithRetry(
    candidate.url,
    { headers: { Referer: referer, "User-Agent": USER_AGENT } },
    {
      ...requestOptions,
      consumeResponse: (response, { signal }) =>
        readResponseBodyWithLimit(response, { signal }),
    },
  );
  return normalizeImage(buffer);
}

export async function ensureFallbackThumbnail({
  dryRun = false,
  fallbackPath = path.join(DEFAULT_THUMBS_DIR, FALLBACK_FILENAME),
  logoPath = path.join(REPO_ROOT, "public", "otf-logo.svg"),
} = {}) {
  const existing = await validateLocalThumbnail(
    FALLBACK_URL,
    path.dirname(fallbackPath),
  );
  if (existing.valid) {
    return { generated: false, reused: true, ...existing };
  }

  await access(logoPath);
  const logo = await sharp(await readFile(logoPath))
    .resize({ width: 460, withoutEnlargement: false })
    .png()
    .toBuffer();
  const buffer = await sharp({
    create: {
      background: "#111111",
      channels: 3,
      height: 960,
      width: 640,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .jpeg({ quality: NORMALIZED_JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
  const validation = await validateImageBuffer(buffer);
  if (!dryRun) await atomicWrite(fallbackPath, buffer);
  return {
    diskPath: fallbackPath,
    generated: true,
    localUrl: FALLBACK_URL,
    reused: false,
    valid: true,
    ...validation,
  };
}

async function processVideoThumbnail(
  video,
  {
    dryRun,
    fallbackUrl,
    force,
    requestOptions,
    skipDownload,
    thumbsDir,
  },
) {
  const canonical = canonicalThumbnailForVideo(video);
  const previousThumbnail = video.thumbnail ?? "";
  const existing = await validateLocalThumbnail(previousThumbnail, thumbsDir);
  const existingIsReal = existing.valid && previousThumbnail !== fallbackUrl;

  let canonicalExisting = null;
  if (canonical && canonical.localUrl !== previousThumbnail) {
    canonicalExisting = await validateLocalThumbnail(canonical.localUrl, thumbsDir);
  }

  const reusable = existing.valid
    ? existing
    : canonicalExisting?.valid
      ? canonicalExisting
      : null;
  const reusableIsReal = reusable?.localUrl !== fallbackUrl;

  if (existingIsReal && !force) {
    return { status: "local-valid", thumbnail: previousThumbnail };
  }
  if (canonicalExisting?.valid && !force) {
    video.thumbnail = canonical.localUrl;
    return { status: "local-reused", thumbnail: canonical.localUrl };
  }

  if (!canonical) {
    video.thumbnail = reusable?.localUrl ?? fallbackUrl;
    return {
      errors: [`unsupported or malformed source: ${video.source ?? "missing"}`],
      status: reusable && reusableIsReal ? "local-preserved" : "fallback",
      thumbnail: video.thumbnail,
    };
  }

  if (skipDownload) {
    video.thumbnail = reusable?.localUrl ?? fallbackUrl;
    return {
      errors:
        reusable && reusableIsReal
          ? []
          : ["download skipped; durable fallback retained"],
      status: reusable && reusableIsReal ? "local-preserved" : "fallback",
      thumbnail: video.thumbnail,
    };
  }

  const errors = [];
  const candidates = [];
  if (isHttpUrl(previousThumbnail)) {
    candidates.push({ origin: "catalog", url: previousThumbnail });
  }

  const triedUrls = new Set();
  const tryCandidate = async (candidate) => {
    if (triedUrls.has(candidate.url)) return null;
    triedUrls.add(candidate.url);
    try {
      const normalized = await downloadCandidate(candidate, video, requestOptions);
      if (!dryRun) {
        await atomicWrite(path.join(thumbsDir, canonical.filename), normalized.buffer);
      }
      video.thumbnail = canonical.localUrl;
      return {
        bytes: normalized.validation.bytes,
        height: normalized.validation.height,
        networkAttempted: true,
        origin: candidate.origin,
        status: dryRun ? "would-download" : "downloaded",
        thumbnail: canonical.localUrl,
        width: normalized.validation.width,
      };
    } catch (error) {
      errors.push(`${candidate.origin}: ${error.message}`);
      return null;
    }
  };

  for (const candidate of candidates) {
    const result = await tryCandidate(candidate);
    if (result) return result;
  }

  try {
    const resolved = await resolvePlatformCandidate(video, requestOptions);
    const result = await tryCandidate(resolved);
    if (result) return result;
  } catch (error) {
    errors.push(`source-resolution: ${error.message}`);
  }

  video.thumbnail = reusable?.localUrl ?? fallbackUrl;
  return {
    errors,
    networkAttempted: true,
    status: reusable && reusable.localUrl !== fallbackUrl ? "local-preserved" : "fallback",
    thumbnail: video.thumbnail,
  };
}

async function concurrentMap(items, concurrency, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from(
    { length: Math.min(concurrency, Math.max(items.length, 1)) },
    async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await worker(items[index], index);
      }
    },
  );
  await Promise.all(workers);
  return results;
}

function countThumbnailKinds(exercises) {
  const counts = { empty: 0, fallback: 0, local: 0, remote: 0, total: 0 };
  for (const exercise of exercises) {
    for (const video of exercise.videos ?? []) {
      counts.total += 1;
      const thumbnail = video.thumbnail ?? "";
      if (!thumbnail) counts.empty += 1;
      else if (thumbnail === FALLBACK_URL) counts.fallback += 1;
      else if (thumbnail.startsWith("/thumbs/")) counts.local += 1;
      else counts.remote += 1;
    }
  }
  return counts;
}

function relativeToRepo(filePath) {
  const relative = path.relative(REPO_ROOT, filePath);
  return relative.startsWith("..") ? filePath : relative;
}

export async function runThumbnailPipeline({
  attempts = DEFAULT_ATTEMPTS,
  betweenItemsMs = DEFAULT_BETWEEN_ITEMS_MS,
  catalogPath = DEFAULT_CATALOG_PATH,
  concurrency = DEFAULT_CONCURRENCY,
  dryRun = false,
  fetchImpl = fetch,
  force = false,
  limit = Number.POSITIVE_INFINITY,
  logoPath = path.join(REPO_ROOT, "public", "otf-logo.svg"),
  reportPath = dryRun ? null : DEFAULT_REPORT_PATH,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  skipDownload = false,
  sleepImpl = sleep,
  source = null,
  thumbsDir = DEFAULT_THUMBS_DIR,
  timeoutMs = DEFAULT_TIMEOUT_MS,
} = {}) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("concurrency must be a positive integer");
  }
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new Error("attempts must be a positive integer");
  }
  if (!Number.isInteger(betweenItemsMs) || betweenItemsMs < 0) {
    throw new Error("betweenItemsMs must be a non-negative integer");
  }
  if (source && !["instagram", "tiktok"].includes(source)) {
    throw new Error(`unsupported --source value: ${source}`);
  }
  // The canonical report describes a complete catalogue run. A filtered run
  // may write an explicitly different report, but must never replace it.
  if (source && reportPath === DEFAULT_REPORT_PATH) reportPath = null;

  if (!dryRun) await mkdir(thumbsDir, { recursive: true });
  const originalCatalog = await readFile(catalogPath, "utf8");
  const exercises = JSON.parse(originalCatalog);
  if (!Array.isArray(exercises)) throw new Error("catalogue root must be an array");

  const before = countThumbnailKinds(exercises);
  const fallback = await ensureFallbackThumbnail({
    dryRun,
    fallbackPath: path.join(thumbsDir, FALLBACK_FILENAME),
    logoPath,
  });

  const records = [];
  for (const exercise of exercises) {
    for (const video of exercise.videos ?? []) {
      if (source && video.source !== source) continue;
      records.push({ exerciseId: exercise.id, video });
    }
  }
  const selected = Number.isFinite(limit) ? records.slice(0, limit) : records;
  const requestOptions = {
    attempts,
    fetchImpl,
    retryDelayMs,
    sleepImpl,
    timeoutMs,
  };

  let completed = 0;
  const results = await concurrentMap(
    selected,
    concurrency,
    async (record) => {
      const result = await processVideoThumbnail(record.video, {
        dryRun,
        fallbackUrl: FALLBACK_URL,
        force,
        requestOptions,
        skipDownload,
        thumbsDir,
      });
      if (result.networkAttempted && betweenItemsMs > 0) {
        await sleepImpl(betweenItemsMs);
      }
      completed += 1;
      if (completed % 25 === 0 || completed === selected.length) {
        console.log(`[thumbs] ${completed}/${selected.length}`);
      }
      return { exerciseId: record.exerciseId, video: record.video, ...result };
    },
  );

  const statuses = {};
  const bySource = {};
  const failures = [];
  for (const result of results) {
    statuses[result.status] = (statuses[result.status] ?? 0) + 1;
    const sourceName = result.video.source ?? "unknown";
    bySource[sourceName] ??= {};
    bySource[sourceName][result.status] =
      (bySource[sourceName][result.status] ?? 0) + 1;
    if (result.errors?.length) {
      failures.push({
        errors: result.errors,
        exercise_id: result.exerciseId,
        source: sourceName,
        video_id: result.video.id,
        video_url: result.video.url,
      });
    }
  }

  const after = countThumbnailKinds(exercises);
  const nextCatalog = `${JSON.stringify(exercises, null, 2)}\n`;
  const catalogChanged = nextCatalog !== originalCatalog;
  if (!dryRun && catalogChanged) {
    // Avoid overwriting a concurrent data-refresh process that completed while
    // thumbnails were downloading.
    const currentCatalog = await readFile(catalogPath, "utf8");
    if (currentCatalog !== originalCatalog) {
      throw new Error("catalogue changed during thumbnail processing; refusing to overwrite it");
    }
    await atomicWrite(catalogPath, nextCatalog);
  }

  const report = {
    after,
    before,
    by_source: bySource,
    catalog: relativeToRepo(catalogPath),
    catalog_changed: catalogChanged,
    completed_without_fallbacks: after.fallback === 0,
    dry_run: dryRun,
    failures,
    fallback: {
      generated: fallback.generated,
      generation:
        "640x960 JPEG, dark #111111 background, centered public/otf-logo.svg, quality 72 mozjpeg",
      path: FALLBACK_URL,
      reused: fallback.reused,
    },
    generated_at: new Date().toISOString(),
    options: {
      attempts,
      between_items_ms: betweenItemsMs,
      concurrency,
      force,
      limit: Number.isFinite(limit) ? limit : null,
      skip_download: skipDownload,
      source,
      timeout_ms: timeoutMs,
    },
    processed: selected.length,
    statuses,
  };

  if (!dryRun && reportPath) await atomicWriteJson(reportPath, report);
  return report;
}

function numericArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseInt(args[index + 1] ?? "", 10);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} requires a positive integer`);
  }
  return value;
}

function nonnegativeNumericArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = Number.parseInt(args[index + 1] ?? "", 10);
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} requires a non-negative integer`);
  }
  return value;
}

function stringArgument(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value`);
  return value;
}

export function platformWrapperArguments(source, forwardedArguments) {
  if (!["instagram", "tiktok"].includes(source)) {
    throw new Error(`unsupported thumbnail wrapper source: ${source}`);
  }
  const reportArguments = forwardedArguments.some(
    (argument) => argument === "--report" || argument === "--no-report",
  )
    ? []
    : ["--no-report"];
  return ["--source", source, ...reportArguments, ...forwardedArguments];
}

export function parseCliArguments(args) {
  const dryRun = args.includes("--dry-run");
  const noReport = args.includes("--no-report");
  const reportValue = stringArgument(args, "--report", null);
  return {
    attempts: numericArgument(args, "--attempts", DEFAULT_ATTEMPTS),
    betweenItemsMs: nonnegativeNumericArgument(
      args,
      "--between-items-ms",
      DEFAULT_BETWEEN_ITEMS_MS,
    ),
    catalogPath: path.resolve(
      stringArgument(args, "--catalog", DEFAULT_CATALOG_PATH),
    ),
    concurrency: numericArgument(args, "--concurrency", DEFAULT_CONCURRENCY),
    dryRun,
    force: args.includes("--force"),
    limit: numericArgument(args, "--limit", Number.POSITIVE_INFINITY),
    reportPath: noReport
      ? null
      : reportValue
        ? path.resolve(reportValue)
        : dryRun
          ? null
          : DEFAULT_REPORT_PATH,
    skipDownload: args.includes("--skip-download"),
    source: stringArgument(args, "--source", null),
    thumbsDir: path.resolve(
      stringArgument(args, "--thumbs-dir", DEFAULT_THUMBS_DIR),
    ),
    timeoutMs: numericArgument(args, "--timeout-ms", DEFAULT_TIMEOUT_MS),
  };
}

function printReport(report) {
  console.log("\n=== thumbnail pipeline ===");
  console.log(
    `Before: ${report.before.local} local, ${report.before.fallback} fallback, ` +
      `${report.before.remote} remote, ${report.before.empty} empty`,
  );
  console.log(
    `After:  ${report.after.local} local, ${report.after.fallback} fallback, ` +
      `${report.after.remote} remote, ${report.after.empty} empty`,
  );
  console.log(`Processed: ${report.processed}`);
  console.log(`Statuses: ${JSON.stringify(report.statuses)}`);
  console.log(`Failures reported: ${report.failures.length}`);
  if (report.dry_run) console.log("Dry run: no images, catalogue, or report were written");
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--help")) {
    console.log(`Usage: node scripts/ensure-thumbnails.mjs [options]

Options:
  --dry-run             Resolve and validate without writing files
  --force               Re-download even when a real local image is valid
  --skip-download       Validate local files and assign the fallback only
  --source PLATFORM     Limit processing to instagram or tiktok
  --limit N             Limit the number of selected videos
  --concurrency N       Concurrent workers (default: ${DEFAULT_CONCURRENCY})
  --attempts N          Attempts per HTTP request (default: ${DEFAULT_ATTEMPTS})
  --between-items-ms N  Per-worker pause between videos (default: ${DEFAULT_BETWEEN_ITEMS_MS})
  --timeout-ms N        Timeout per HTTP request (default: ${DEFAULT_TIMEOUT_MS})
  --catalog PATH        Alternate exercise catalogue (useful for tests)
  --thumbs-dir PATH     Alternate thumbnail directory
  --report PATH         Alternate JSON report path
  --no-report           Do not write a JSON report
`);
    return;
  }
  const report = await runThumbnailPipeline(parseCliArguments(args));
  printReport(report);
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    console.error(`[thumbs] fatal: ${error.stack ?? error.message ?? error}`);
    process.exitCode = 1;
  });
}
