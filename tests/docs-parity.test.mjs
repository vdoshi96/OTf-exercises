import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  counterpartPath,
  discoverSourcePaths,
  isDocumentationSource,
  parityIssues,
  renderDocument,
  rewriteDocumentationHref,
  writeDocuments,
} from "../scripts/docs-parity.mjs";

test("maps documentation sources to same-directory HTML counterparts", () => {
  assert.equal(
    counterpartPath("docs/steps/example steps 2.md"),
    "docs/steps/example steps 2.html",
  );
  assert.equal(counterpartPath("LICENSE"), "LICENSE.html");
  assert.equal(isDocumentationSource("CODEX_HANDOFF"), true);
  assert.equal(isDocumentationSource("Dockerfile"), false);
});

test("renders GFM structure and preserves or rewrites relative targets", () => {
  const sourcePath = "docs/guide.md";
  const trailingSpaces = "  ";
  const source = `# Guide

- [x] Complete

| Item | State |
| --- | --- |
| Docs | Ready |

\`\`\`js
const ready = true;${trailingSpaces}
\`\`\`

[Next](next.md#details)

![QA image](qa-image.png)
`;
  const sourcePaths = new Set([sourcePath, "docs/next.md"]);
  const html = renderDocument(sourcePath, source, sourcePaths);

  assert.match(html, /<h1 id="guide">Guide<\/h1>/);
  assert.match(html, /type="checkbox"/);
  assert.match(html, /<table>/);
  assert.match(html, /<code class="language-js">/);
  assert.match(html, /href="next\.html#details"/);
  assert.match(html, /src="qa-image\.png"/);
  assert.match(html, /alt="QA image"/);
  assert.match(html, /http-equiv="Content-Security-Policy"/);
  assert.match(html, /const ready = true;&#32;&#32;\n/);
  assert.doesNotMatch(html, /[ \t]+$/m);

  const expectedHash = createHash("sha256")
    .update(source, "utf8")
    .digest("hex");
  assert.match(html, new RegExp(`name="doc-source-sha256" content="${expectedHash}"`));
});

test("adds deterministic unique heading targets for preserved fragments", () => {
  const source = "# Next\n\n## Details\n\n## Details\n";
  const html = renderDocument("docs/next.md", source, new Set(["docs/next.md"]));

  assert.match(html, /<h1 id="next">Next<\/h1>/);
  assert.match(html, /<h2 id="details">Details<\/h2>/);
  assert.match(html, /<h2 id="details-1">Details<\/h2>/);
});

test("fails closed for structured formats without a faithful renderer", () => {
  assert.throws(
    () => renderDocument("docs/example.mdx", "# Example\n", new Set()),
    /No structure-preserving renderer is configured/,
  );
});

test("preflights unmanaged counterparts before writing any output", () => {
  const root = mkdtempSync(path.join(tmpdir(), "otf-docs-parity-"));
  const unmanagedHtml = "<!doctype html><title>Private</title>\n";

  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    writeFileSync(path.join(root, "a.md"), "# A\n", "utf8");
    writeFileSync(path.join(root, "b.md"), "# B\n", "utf8");
    writeFileSync(path.join(root, "b.html"), unmanagedHtml, "utf8");
    execFileSync("git", ["add", "a.md", "b.md"], { cwd: root });

    assert.throws(
      () => writeDocuments(root),
      /Refusing to overwrite unmanaged HTML: b\.html/,
    );
    assert.equal(existsSync(path.join(root, "a.html")), false);
    assert.equal(readFileSync(path.join(root, "b.html"), "utf8"), unmanagedHtml);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("source discovery ignores private untracked documentation", () => {
  const root = mkdtempSync(path.join(tmpdir(), "otf-docs-discovery-"));

  try {
    execFileSync("git", ["init", "--quiet"], { cwd: root });
    writeFileSync(path.join(root, "README.md"), "# Tracked\n", "utf8");
    writeFileSync(path.join(root, "private-notes.md"), "# Private\n", "utf8");
    execFileSync("git", ["add", "README.md"], { cwd: root });

    assert.deepEqual(discoverSourcePaths(root), ["README.md"]);
    const warnings = [];
    const originalLog = console.log;
    const originalWarn = console.warn;
    try {
      console.log = () => {};
      console.warn = (message) => warnings.push(message);
      writeDocuments(root);
    } finally {
      console.log = originalLog;
      console.warn = originalWarn;
    }
    assert.equal(existsSync(path.join(root, "README.html")), true);
    assert.equal(existsSync(path.join(root, "private-notes.html")), false);
    assert.match(warnings.join("\n"), /Ignoring 1 untracked documentation candidate/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("rewrites only links to discovered documentation sources", () => {
  const sources = new Set(["README.md", "docs/guide.md", "LICENSE"]);

  assert.equal(
    rewriteDocumentationHref("docs/guide.md?view=1#intro", "README.md", sources),
    "docs/guide.html?view=1#intro",
  );
  assert.equal(
    rewriteDocumentationHref("docs/missing.md", "README.md", sources),
    "docs/missing.md",
  );
  assert.equal(
    rewriteDocumentationHref("docs/report.json", "README.md", sources),
    "docs/report.json",
  );
  assert.equal(
    rewriteDocumentationHref("LICENSE#terms", "README.md", sources),
    "LICENSE.html#terms",
  );
  assert.equal(
    rewriteDocumentationHref("https://example.com/guide.md", "README.md", sources),
    "https://example.com/guide.md",
  );
});

test("discovers the tracked historical filename containing a space", () => {
  const sources = discoverSourcePaths();
  assert.ok(
    sources.includes(
      "docs/steps/2026-05-04-multi-creator-filter-steps 2.md",
    ),
  );
});

test("the repository has complete, exact HTML documentation parity", () => {
  const { issues, sourcePaths } = parityIssues();
  assert.ok(sourcePaths.length > 0);
  assert.deepEqual(issues, []);
});
