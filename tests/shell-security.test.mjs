import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function configuredHeaders(nodeEnv) {
  const loader = [
    "const config = (await import('./next.config.ts')).default;",
    "process.stdout.write(JSON.stringify(await config.headers()));",
  ].join("\n");

  return JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--no-warnings",
        "--experimental-strip-types",
        "--input-type=module",
        "-e",
        loader,
      ],
      {
        cwd: repoRoot,
        encoding: "utf8",
        env: { ...process.env, NODE_ENV: nodeEnv },
      },
    ),
  );
}

function headerMap(rule) {
  return new Map(rule.headers.map(({ key, value }) => [key, value]));
}

test("production headers deny framing by default", () => {
  const rules = configuredHeaders("production");
  const global = rules.find(({ source }) => source === "/:path*");

  assert.ok(global);
  assert.equal(rules.length, 1);

  const common = headerMap(global);
  const defaultCsp = common.get("Content-Security-Policy");

  assert.match(defaultCsp, /frame-src 'none'/);
  assert.match(defaultCsp, /frame-ancestors 'none'/);
  assert.doesNotMatch(defaultCsp, /unsafe-eval/);
  assert.doesNotMatch(defaultCsp, /upgrade-insecure-requests/);
  assert.equal(common.get("X-Content-Type-Options"), "nosniff");
  assert.equal(
    common.get("Referrer-Policy"),
    "strict-origin-when-cross-origin",
  );
  assert.equal(common.get("X-Frame-Options"), "DENY");
  assert.equal(
    common.get("Permissions-Policy"),
    "camera=(), microphone=(), geolocation=(), payment=()",
  );
  assert.equal(common.has("Strict-Transport-Security"), false);
});

test("proxy allows TikTok framing only for catalog-backed detail IDs", async () => {
  const proxy = await readFile(path.join(repoRoot, "src/proxy.ts"), "utf8");
  const security = await readFile(
    path.join(repoRoot, "src/lib/security.ts"),
    "utf8",
  );

  assert.match(proxy, /exerciseIds\.has\(id\)/);
  assert.match(proxy, /coachingIds\.has\(id\)/);
  assert.match(proxy, /matcher: \["\/exercise\/:id", "\/coaching\/:id"\]/);
  assert.match(proxy, /tiktokContentSecurityPolicy/);
  assert.match(security, /frameSource: "'none'" \| "https:\/\/www\.tiktok\.com"/);
});

test("unsafe-eval is limited to the development CSP", () => {
  const rules = configuredHeaders("development");
  const global = rules.find(({ source }) => source === "/:path*");
  const csp = headerMap(global).get("Content-Security-Policy");

  assert.match(csp, /script-src[^;]*'unsafe-eval'/);
  assert.doesNotMatch(csp, /upgrade-insecure-requests/);
});

test("trust copy and media privacy controls remain explicit", async () => {
  const [layout, nav, instagram, tiktok, privacy, notFound, detail] =
    await Promise.all(
      [
        "src/app/layout.tsx",
        "src/components/SiteNav.tsx",
        "src/components/InstagramEmbed.tsx",
        "src/components/TikTokEmbed.tsx",
        "src/app/privacy/page.tsx",
        "src/app/not-found.tsx",
        "src/app/exercise/[id]/page.tsx",
      ].map((file) => readFile(path.join(repoRoot, file), "utf8")),
    );

  assert.match(layout, /Unofficial OTF Exercise Directory/);
  assert.match(layout, /Not affiliated with, endorsed by,/);
  assert.match(layout, /related\s+marks belong to their respective owners/);
  assert.match(layout, /href="\/privacy"/);

  assert.match(nav, /alt=""/);
  assert.match(nav, /Unofficial fan directory/);
  assert.match(nav, /Exercise Directory/);
  assert.match(nav, /aria-current=/);
  assert.match(nav, /parseDirectoryQuery/);
  assert.match(nav, /directoryPageHref/);

  assert.match(instagram, /new tab/);
  assert.match(instagram, /Watch on Instagram/);
  assert.match(tiktok, /Playing loads TikTok’s embedded player/);
  assert.match(tiktok, /referrerPolicy="strict-origin-when-cross-origin"/);
  assert.doesNotMatch(tiktok, /\bsandbox=/);

  assert.match(privacy, /local preview does not load Instagram or TikTok/);
  assert.match(privacy, /not loaded until you press a play/);
  assert.match(privacy, /cookie-free/);
  assert.match(notFound, /method="get"/);
  assert.match(notFound, /name="q"/);
  assert.match(detail, /DirectoryBackLink/);
});

test("robots metadata allows crawling and advertises the canonical sitemap", async () => {
  const robots = (
    await import(new URL("../src/app/robots.ts", import.meta.url))
  ).default();

  assert.deepEqual(robots.rules, { userAgent: "*", allow: "/" });
  assert.equal(
    robots.sitemap,
    "https://o-tf-exercises.vercel.app/sitemap.xml",
  );
});
