import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";

import {
  FALLBACK_URL,
  REPO_ROOT,
  canonicalThumbnailForVideo,
  fetchWithRetry,
  instagramShortcodeFromUrl,
  normalizeImage,
  ogImageFromHtml,
  platformWrapperArguments,
  readResponseBodyWithLimit,
  runThumbnailPipeline,
  sha256,
  tiktokVideoId,
  validateImageBuffer,
} from "../scripts/ensure-thumbnails.mjs";

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "otf-thumbnails-"));
  t.after(() => rm(directory, { force: true, recursive: true }));
  return directory;
}

async function jpeg({ background = "#f25c19", height = 900, width = 700 } = {}) {
  return sharp({ create: { background, channels: 3, height, width } })
    .jpeg({ quality: 90 })
    .toBuffer();
}

test("extracts stable platform identifiers and filenames", () => {
  assert.equal(
    instagramShortcodeFromUrl("https://www.instagram.com/reel/Da_1-aB2/"),
    "Da_1-aB2",
  );
  assert.equal(
    tiktokVideoId({
      id: "ignored",
      url: "https://www.tiktok.com/@creator/video/123456789",
    }),
    "123456789",
  );
  assert.deepEqual(
    canonicalThumbnailForVideo({
      id: "ig_Da_1-aB2",
      source: "instagram",
      url: "https://www.instagram.com/reel/Da_1-aB2/",
    }),
    { filename: "Da_1-aB2.jpg", localUrl: "/thumbs/Da_1-aB2.jpg" },
  );
  assert.deepEqual(
    canonicalThumbnailForVideo({
      id: "123456789",
      source: "tiktok",
      url: "https://www.tiktok.com/@creator/video/123456789",
    }),
    {
      filename: "tiktok-123456789.jpg",
      localUrl: "/thumbs/tiktok-123456789.jpg",
    },
  );
});

test("parses og:image regardless of attribute order and decodes entities", () => {
  const html = `
    <meta content="not-this" property="description">
    <meta content='https://cdn.example/image.jpg?a=1&amp;b=2' property='og:image'>
  `;
  assert.equal(ogImageFromHtml(html), "https://cdn.example/image.jpg?a=1&b=2");
  assert.equal(ogImageFromHtml("<html></html>"), null);
});

test("validates complete image decodes, rejects known hashes, and normalizes JPEGs", async () => {
  const source = await jpeg({ height: 1_200, width: 900 });
  const validation = await validateImageBuffer(source);
  assert.equal(validation.width, 900);
  assert.equal(validation.height, 1_200);

  await assert.rejects(
    validateImageBuffer(source, { knownBadHashes: new Set([sha256(source)]) }),
    /known bad image hash/,
  );
  await assert.rejects(validateImageBuffer(source.subarray(0, 1_200)), /decode failed/);

  const normalized = await normalizeImage(source);
  assert.equal(normalized.validation.format, "jpeg");
  assert.equal(normalized.validation.width, 640);
  assert.equal(normalized.validation.height, 853);
});

test("retries transient responses and stops immediately on permanent responses", async () => {
  let transientCalls = 0;
  const transient = await fetchWithRetry(
    "https://example.test/retry",
    {},
    {
      attempts: 3,
      consumeResponse: async (response, { signal }) =>
        (await readResponseBodyWithLimit(response, { signal })).toString("utf8"),
      fetchImpl: async () => {
        transientCalls += 1;
        return new Response(transientCalls < 3 ? "busy" : "ok", {
          status: transientCalls < 3 ? 503 : 200,
        });
      },
      retryDelayMs: 1,
      sleepImpl: async () => {},
      timeoutMs: 1_000,
    },
  );
  assert.equal(transient, "ok");
  assert.equal(transientCalls, 3);

  let permanentCalls = 0;
  await assert.rejects(
    fetchWithRetry(
      "https://example.test/missing",
      {},
      {
        attempts: 3,
        fetchImpl: async () => {
          permanentCalls += 1;
          return new Response("missing", { status: 404 });
        },
        sleepImpl: async () => {},
        timeoutMs: 1_000,
      },
    ),
    /after 1 attempt\(s\): HTTP 404/,
  );
  assert.equal(permanentCalls, 1);
});

test("cancels non-OK bodies and retries body stream read failures", async () => {
  let cancelled = 0;
  await assert.rejects(
    fetchWithRetry(
      "https://example.test/not-found",
      {},
      {
        attempts: 1,
        fetchImpl: async () =>
          new Response(
            new ReadableStream({
              cancel() {
                cancelled += 1;
              },
            }),
            { status: 404 },
          ),
      },
    ),
    /HTTP 404/,
  );
  assert.equal(cancelled, 1);

  let bodyAttempts = 0;
  const recovered = await fetchWithRetry(
    "https://example.test/body-retry",
    {},
    {
      attempts: 2,
      consumeResponse: async (response, { signal }) =>
        (await readResponseBodyWithLimit(response, { signal })).toString("utf8"),
      fetchImpl: async () => {
        bodyAttempts += 1;
        if (bodyAttempts === 1) {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.error(new Error("body stream failed"));
              },
            }),
          );
        }
        return new Response("recovered");
      },
      retryDelayMs: 1,
      sleepImpl: async () => {},
      timeoutMs: 1_000,
    },
  );
  assert.equal(recovered, "recovered");
  assert.equal(bodyAttempts, 2);
});

test("rejects a chunked response as soon as it crosses the hard 15MB cap", async () => {
  const eightMegabytes = new Uint8Array(8 * 1024 * 1024);
  let cancelled = 0;
  let chunk = 0;
  const response = new Response(
    new ReadableStream({
      cancel() {
        cancelled += 1;
      },
      pull(controller) {
        if (chunk < 2) {
          controller.enqueue(eightMegabytes);
          chunk += 1;
          return;
        }
        controller.close();
      },
    }),
  );

  await assert.rejects(
    readResponseBodyWithLimit(response),
    /exceeds 15728640 bytes \(streamed at least 16777216\)/,
  );
  assert.equal(cancelled, 1);
});

test("times out stalled response bodies and retries the entire request", async () => {
  let attempts = 0;
  let cancelled = 0;
  const startedAt = Date.now();
  await assert.rejects(
    fetchWithRetry(
      "https://example.test/stalled-body",
      {},
      {
        attempts: 2,
        consumeResponse: (response, { signal }) =>
          readResponseBodyWithLimit(response, { signal }),
        fetchImpl: async () => {
          attempts += 1;
          return new Response(
            new ReadableStream({
              cancel() {
                cancelled += 1;
              },
            }),
          );
        },
        retryDelayMs: 1,
        sleepImpl: async () => {},
        timeoutMs: 20,
      },
    ),
    /after 2 attempt\(s\): timeout after 20ms/,
  );
  assert.equal(attempts, 2);
  assert.equal(cancelled, 2);
  assert.ok(Date.now() - startedAt < 500, "stalled body should not outlive its timeout");
});

test("platform wrappers suppress the canonical report unless given a custom report", () => {
  assert.deepEqual(platformWrapperArguments("instagram", ["--limit", "1"]), [
    "--source",
    "instagram",
    "--no-report",
    "--limit",
    "1",
  ]);
  assert.deepEqual(
    platformWrapperArguments("tiktok", ["--report", "/tmp/tiktok-report.json"]),
    [
      "--source",
      "tiktok",
      "--report",
      "/tmp/tiktok-report.json",
    ],
  );
});

test("downloads both platforms, preserves valid locals, and assigns the durable fallback", async (t) => {
  const root = await temporaryDirectory(t);
  const catalogPath = path.join(root, "exercises.json");
  const thumbsDir = path.join(root, "thumbs");
  const reportPath = path.join(root, "thumbnail-report.json");
  await mkdir(thumbsDir);

  const sourceImage = await jpeg();
  await writeFile(path.join(thumbsDir, "existing.jpg"), sourceImage);
  const catalog = [
    {
      id: "exercise-1",
      videos: [
        {
          id: "ig_IGSIGNED",
          source: "instagram",
          thumbnail: "https://cdn.test/instagram-signed.jpg",
          url: "https://www.instagram.com/reel/IGSIGNED/",
        },
        {
          id: "123456789",
          source: "tiktok",
          thumbnail: "",
          url: "https://www.tiktok.com/@creator/video/123456789",
        },
        {
          id: "ig_UNAVAILABLE",
          source: "instagram",
          thumbnail: "",
          url: "https://www.instagram.com/reel/UNAVAILABLE/",
        },
        {
          id: "ig_KEEP",
          source: "instagram",
          thumbnail: "/thumbs/existing.jpg",
          url: "https://www.instagram.com/reel/KEEP/",
        },
      ],
    },
  ];
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(String(url));
    if (url === "https://cdn.test/instagram-signed.jpg") {
      return new Response(sourceImage, {
        headers: { "content-type": "image/jpeg" },
        status: 200,
      });
    }
    if (String(url).startsWith("https://www.tiktok.com/oembed?")) {
      return Response.json({ thumbnail_url: "https://cdn.test/tiktok.jpg" });
    }
    if (url === "https://cdn.test/tiktok.jpg") {
      return new Response(sourceImage, { status: 200 });
    }
    if (url === "https://www.instagram.com/reel/UNAVAILABLE/") {
      return new Response("not found", { status: 404 });
    }
    throw new Error(`unexpected request: ${url}`);
  };

  const report = await runThumbnailPipeline({
    attempts: 1,
    catalogPath,
    concurrency: 2,
    fetchImpl,
    logoPath: path.join(REPO_ROOT, "public", "otf-logo.svg"),
    reportPath,
    retryDelayMs: 1,
    sleepImpl: async () => {},
    thumbsDir,
    timeoutMs: 1_000,
  });

  const updated = JSON.parse(await readFile(catalogPath, "utf8"));
  const [instagram, tiktok, unavailable, preserved] = updated[0].videos;
  assert.equal(instagram.thumbnail, "/thumbs/IGSIGNED.jpg");
  assert.equal(tiktok.thumbnail, "/thumbs/tiktok-123456789.jpg");
  assert.equal(unavailable.thumbnail, FALLBACK_URL);
  assert.equal(preserved.thumbnail, "/thumbs/existing.jpg");
  assert.equal(report.statuses.downloaded, 2);
  assert.equal(report.statuses.fallback, 1);
  assert.equal(report.statuses["local-valid"], 1);
  assert.equal(report.after.remote, 0);
  assert.equal(report.after.empty, 0);
  assert.equal(report.failures.length, 1);
  assert.ok(calls.includes("https://www.instagram.com/reel/UNAVAILABLE/"));
  assert.ok(!calls.includes("https://www.instagram.com/reel/KEEP/"));

  for (const filename of [
    "IGSIGNED.jpg",
    "tiktok-123456789.jpg",
    "fallback-exercise.jpg",
  ]) {
    const metadata = await sharp(path.join(thumbsDir, filename)).metadata();
    assert.equal(metadata.format, "jpeg");
    assert.ok(metadata.width <= 640);
  }
  const writtenReport = JSON.parse(await readFile(reportPath, "utf8"));
  assert.match(writtenReport.fallback.generation, /public\/otf-logo\.svg/);
});

test("force mode preserves a valid local thumbnail when recovery fails", async (t) => {
  const root = await temporaryDirectory(t);
  const catalogPath = path.join(root, "exercises.json");
  const thumbsDir = path.join(root, "thumbs");
  await mkdir(thumbsDir);
  await writeFile(path.join(thumbsDir, "KEEP.jpg"), await jpeg());
  const catalog = [
    {
      id: "exercise",
      videos: [
        {
          id: "ig_KEEP",
          source: "instagram",
          thumbnail: "/thumbs/KEEP.jpg",
          url: "https://www.instagram.com/reel/KEEP/",
        },
      ],
    },
  ];
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const report = await runThumbnailPipeline({
    attempts: 1,
    catalogPath,
    fetchImpl: async () => new Response("missing", { status: 404 }),
    force: true,
    logoPath: path.join(REPO_ROOT, "public", "otf-logo.svg"),
    reportPath: null,
    thumbsDir,
  });
  const updated = JSON.parse(await readFile(catalogPath, "utf8"));
  assert.equal(updated[0].videos[0].thumbnail, "/thumbs/KEEP.jpg");
  assert.equal(report.statuses["local-preserved"], 1);
});

test("skip-download reports a retained fallback as a failure", async (t) => {
  const root = await temporaryDirectory(t);
  const catalogPath = path.join(root, "exercises.json");
  const thumbsDir = path.join(root, "thumbs");
  await mkdir(thumbsDir);
  await writeFile(
    path.join(thumbsDir, "fallback-exercise.jpg"),
    await readFile(path.join(REPO_ROOT, "public", "thumbs", "fallback-exercise.jpg")),
  );
  const catalog = [
    {
      id: "exercise",
      videos: [
        {
          id: "123456789",
          source: "tiktok",
          thumbnail: FALLBACK_URL,
          url: "https://www.tiktok.com/@creator/video/123456789",
        },
      ],
    },
  ];
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`);

  const report = await runThumbnailPipeline({
    catalogPath,
    fetchImpl: async () => {
      throw new Error("network must not run with --skip-download");
    },
    logoPath: path.join(REPO_ROOT, "public", "otf-logo.svg"),
    reportPath: null,
    skipDownload: true,
    thumbsDir,
  });
  assert.equal(report.statuses.fallback, 1);
  assert.equal(report.failures.length, 1);
  assert.match(report.failures[0].errors[0], /durable fallback retained/);
});

test("dry-run performs validation without writing thumbnails, catalogue, or report", async (t) => {
  const root = await temporaryDirectory(t);
  const catalogPath = path.join(root, "exercises.json");
  const thumbsDir = path.join(root, "not-created");
  const reportPath = path.join(root, "not-written.json");
  const original = `${JSON.stringify([
    {
      id: "exercise",
      videos: [
        {
          id: "123456789",
          source: "tiktok",
          thumbnail: "",
          url: "https://www.tiktok.com/@creator/video/123456789",
        },
      ],
    },
  ])}\n`;
  await writeFile(catalogPath, original);

  await runThumbnailPipeline({
    attempts: 1,
    catalogPath,
    dryRun: true,
    fetchImpl: async () => new Response("missing", { status: 404 }),
    logoPath: path.join(REPO_ROOT, "public", "otf-logo.svg"),
    reportPath,
    thumbsDir,
  });

  assert.equal(await readFile(catalogPath, "utf8"), original);
  await assert.rejects(stat(thumbsDir), { code: "ENOENT" });
  await assert.rejects(stat(reportPath), { code: "ENOENT" });
});
