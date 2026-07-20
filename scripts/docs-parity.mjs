#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { Marked } from "marked";

export const GENERATOR_ID = "otf-docs-parity/v1";

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);
const PLAIN_TEXT_EXTENSIONS = new Set([".txt"]);
const STRUCTURED_UNSUPPORTED_EXTENSIONS = new Set([
  ".adoc",
  ".asciidoc",
  ".mdx",
  ".rst",
]);
const DOCUMENTATION_EXTENSIONS = new Set([
  ...MARKDOWN_EXTENSIONS,
  ...PLAIN_TEXT_EXTENSIONS,
  ...STRUCTURED_UNSUPPORTED_EXTENSIONS,
]);
const EXTENSIONLESS_DOCUMENTATION = /^(?:AGENTS|ARCHITECTURE|AUTHORS|CHANGELOG|CHANGES|CLAUDE|CODE_OF_CONDUCT|CODEX_HANDOFF|CONTRIBUTING|CONTRIBUTORS|COPYING|DEVELOPMENT|FAQ|GOVERNANCE|HANDBOOK|HISTORY|INSTALL|LICEN[CS]E|MAINTAINERS|MIGRATING|NOTICE|ONBOARDING|PLAYBOOK|README|RELEASE_NOTES|ROADMAP|RUNBOOK|SECURITY|STYLEGUIDE|SUPPORT|TODO|TROUBLESHOOTING|UPGRADING)(?:[-_].*)?$/i;

const STYLE = `
    :root {
      color-scheme: light dark;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.6;
      --background: #ffffff;
      --foreground: #172033;
      --muted: #5d6678;
      --surface: #f5f7fa;
      --border: #d8dee9;
      --accent: #b84f10;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --background: #111827;
        --foreground: #e5e7eb;
        --muted: #aeb7c6;
        --surface: #1f2937;
        --border: #445064;
        --accent: #ff9b5e;
      }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--background);
      color: var(--foreground);
    }
    main {
      width: min(100% - 2rem, 72rem);
      margin: 0 auto;
      padding: 2.5rem 0 5rem;
      overflow-x: auto;
      overflow-wrap: anywhere;
    }
    h1, h2, h3, h4, h5, h6 {
      line-height: 1.25;
      margin-block: 2rem 0.75rem;
    }
    h1 { margin-top: 0; }
    a { color: var(--accent); text-underline-offset: 0.15em; }
    a:focus-visible { outline: 0.2rem solid currentColor; outline-offset: 0.2rem; }
    blockquote {
      margin-inline: 0;
      padding: 0.2rem 1rem;
      color: var(--muted);
      border-inline-start: 0.25rem solid var(--border);
    }
    code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    code {
      padding: 0.1rem 0.3rem;
      background: var(--surface);
      border-radius: 0.25rem;
    }
    pre {
      padding: 1rem;
      overflow-x: auto;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 0.5rem;
    }
    pre code { padding: 0; background: transparent; }
    table {
      width: 100%;
      margin-block: 1rem;
      border-collapse: collapse;
    }
    th, td { padding: 0.5rem 0.75rem; border: 1px solid var(--border); text-align: start; }
    th { background: var(--surface); }
    img { max-width: 100%; height: auto; }
    hr { border: 0; border-top: 1px solid var(--border); }
    .plain-text { white-space: pre-wrap; }
    .task-list-item { list-style: none; }
    input[type="checkbox"] { margin-inline: -1.25rem 0.5rem; }
  `;

function comparePaths(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function gitPaths(
  root,
  { includeTracked = true, includeUntracked = false } = {},
) {
  const arguments_ = ["ls-files"];
  if (includeTracked) {
    arguments_.push("--cached");
  }
  if (includeUntracked) {
    arguments_.push("--others", "--exclude-standard");
  }
  arguments_.push("-z");

  const output = execFileSync(
    "git",
    arguments_,
    { cwd: root, encoding: "buffer" },
  );

  return output
    .toString("utf8")
    .split("\0")
    .filter(Boolean)
    .filter((relativePath) => {
      const absolutePath = path.join(root, relativePath);
      return existsSync(absolutePath) && statSync(absolutePath).isFile();
    })
    .sort(comparePaths);
}

export function isDocumentationSource(relativePath) {
  const basename = path.posix.basename(relativePath);
  const extension = path.posix.extname(basename).toLowerCase();

  if (DOCUMENTATION_EXTENSIONS.has(extension)) {
    return true;
  }

  return extension === "" && EXTENSIONLESS_DOCUMENTATION.test(basename);
}

export function discoverSourcePaths(root = process.cwd()) {
  return gitPaths(root).filter(isDocumentationSource);
}

function discoverUntrackedDocumentationPaths(root) {
  return gitPaths(root, { includeTracked: false, includeUntracked: true }).filter(
    isDocumentationSource,
  );
}

export function counterpartPath(sourcePath) {
  const extension = path.posix.extname(sourcePath);
  return extension
    ? `${sourcePath.slice(0, -extension.length)}.html`
    : `${sourcePath}.html`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function titleFromSource(sourcePath, source) {
  const heading = source.match(/^ {0,3}#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/m);
  if (heading) {
    return heading[1].replace(/[*_`~]/g, "").trim();
  }

  const basename = path.posix.basename(sourcePath);
  const extension = path.posix.extname(basename);
  return extension ? basename.slice(0, -extension.length) : basename;
}

function splitHref(href) {
  const suffixIndex = href.search(/[?#]/);
  if (suffixIndex === -1) {
    return [href, ""];
  }
  return [href.slice(0, suffixIndex), href.slice(suffixIndex)];
}

function plainTextFromTokens(tokens) {
  return tokens
    .map((token) => {
      if (Array.isArray(token.tokens)) {
        return plainTextFromTokens(token.tokens);
      }
      return typeof token.text === "string" ? token.text : "";
    })
    .join("");
}

function headingSlug(value) {
  const slug = value
    .replace(/<[^>]*>/g, "")
    .normalize("NFKD")
    .replace(/\p{Mark}/gu, "")
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s-]/gu, "")
    .trim()
    .replace(/[\s-]+/g, "-");

  return slug || "section";
}

function encodeTrailingCodeWhitespace(html) {
  return html.replace(
    /(<pre><code\b[^>]*>)([\s\S]*?)(<\/code><\/pre>)/g,
    (_match, opening, code, closing) =>
      `${opening}${code.replace(/[ \t]+(?=\n|$)/g, (whitespace) =>
        [...whitespace]
          .map((character) => (character === "\t" ? "&#9;" : "&#32;"))
          .join(""),
      )}${closing}`,
  );
}

export function rewriteDocumentationHref(href, sourcePath, sourcePaths) {
  if (
    href === "" ||
    href.startsWith("#") ||
    href.startsWith("//") ||
    /^[a-z][a-z\d+.-]*:/i.test(href)
  ) {
    return href;
  }

  const [hrefPath, suffix] = splitHref(href);
  const extension = path.posix.extname(hrefPath).toLowerCase();
  if (extension !== "" && !DOCUMENTATION_EXTENSIONS.has(extension)) {
    return href;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(hrefPath);
  } catch {
    decodedPath = hrefPath;
  }

  const repositoryRelativeTarget = decodedPath.startsWith("/")
    ? path.posix.normalize(decodedPath.slice(1))
    : path.posix.normalize(
        path.posix.join(path.posix.dirname(sourcePath), decodedPath),
      );

  if (!sourcePaths.has(repositoryRelativeTarget)) {
    return href;
  }

  const htmlPath = extension
    ? `${hrefPath.slice(0, -extension.length)}.html`
    : `${hrefPath}.html`;
  return `${htmlPath}${suffix}`;
}

function renderMarkdown(sourcePath, source, sourcePaths) {
  const headingCounts = new Map();
  const parser = new Marked({
    async: false,
    breaks: false,
    gfm: true,
    renderer: {
      heading({ tokens, depth }) {
        const renderedText = this.parser.parseInline(tokens);
        const baseId = headingSlug(plainTextFromTokens(tokens));
        const count = headingCounts.get(baseId) ?? 0;
        headingCounts.set(baseId, count + 1);
        const headingId = count === 0 ? baseId : `${baseId}-${count}`;
        return `<h${depth} id="${escapeHtml(headingId)}">${renderedText}</h${depth}>\n`;
      },
    },
    walkTokens(token) {
      if (token.type === "link") {
        token.href = rewriteDocumentationHref(
          token.href,
          sourcePath,
          sourcePaths,
        );
      }
    },
  });

  const html = parser.parse(source.replace(/^[\u200B-\u200F\uFEFF]+/, ""));
  return encodeTrailingCodeWhitespace(html);
}

export function renderDocument(sourcePath, source, allSourcePaths) {
  const extension = path.posix.extname(sourcePath).toLowerCase();
  const sourcePaths =
    allSourcePaths instanceof Set ? allSourcePaths : new Set(allSourcePaths);
  let body;

  if (MARKDOWN_EXTENSIONS.has(extension)) {
    body = renderMarkdown(sourcePath, source, sourcePaths);
  } else if (PLAIN_TEXT_EXTENSIONS.has(extension) || extension === "") {
    body = `<pre class="plain-text">${escapeHtml(source)}</pre>\n`;
  } else if (STRUCTURED_UNSUPPORTED_EXTENSIONS.has(extension)) {
    throw new Error(
      `No structure-preserving renderer is configured for ${sourcePath}. Add one before generating its HTML counterpart.`,
    );
  } else {
    throw new Error(`Unsupported documentation source: ${sourcePath}`);
  }

  const title = escapeHtml(titleFromSource(sourcePath, source));
  const escapedSourcePath = escapeHtml(sourcePath);
  const sourceHash = createHash("sha256").update(source, "utf8").digest("hex");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src 'self' data: https:; style-src 'unsafe-inline'">
  <meta name="generator" content="${GENERATOR_ID}">
  <meta name="doc-source" content="${escapedSourcePath}">
  <meta name="doc-source-sha256" content="${sourceHash}">
  <title>${title}</title>
  <style>${STYLE}</style>
</head>
<body>
  <main>
${body}  </main>
</body>
</html>
`;
}

function expectedDocuments(root) {
  const sourcePaths = discoverSourcePaths(root);
  const sourcePathSet = new Set(sourcePaths);
  const expected = new Map();

  for (const sourcePath of sourcePaths) {
    const outputPath = counterpartPath(sourcePath);
    if (expected.has(outputPath)) {
      throw new Error(
        `Documentation sources collide on HTML counterpart ${outputPath}`,
      );
    }
    const source = readFileSync(path.join(root, sourcePath), "utf8");
    expected.set(outputPath, renderDocument(sourcePath, source, sourcePathSet));
  }

  return { expected, sourcePaths };
}

function managedHtmlPaths(root) {
  const marker = `<meta name="generator" content="${GENERATOR_ID}">`;
  return gitPaths(root, { includeUntracked: true }).filter((relativePath) => {
    if (path.posix.extname(relativePath).toLowerCase() !== ".html") {
      return false;
    }
    return readFileSync(path.join(root, relativePath), "utf8").includes(marker);
  });
}

export function parityIssues(root = process.cwd()) {
  const { expected, sourcePaths } = expectedDocuments(root);
  const issues = [];

  for (const [outputPath, expectedHtml] of expected) {
    const absoluteOutputPath = path.join(root, outputPath);
    if (!existsSync(absoluteOutputPath)) {
      issues.push(`missing: ${outputPath}`);
      continue;
    }

    const actualHtml = readFileSync(absoluteOutputPath, "utf8");
    if (actualHtml !== expectedHtml) {
      issues.push(`outdated: ${outputPath}`);
    }
  }

  for (const outputPath of managedHtmlPaths(root)) {
    if (!expected.has(outputPath)) {
      issues.push(`orphaned: ${outputPath}`);
    }
  }

  return { issues: issues.sort(comparePaths), sourcePaths };
}

export function writeDocuments(root) {
  const untrackedDocumentation = discoverUntrackedDocumentationPaths(root);
  if (untrackedDocumentation.length > 0) {
    console.warn(
      `Ignoring ${untrackedDocumentation.length} untracked documentation candidate(s). Stage only project-owned sources to include them.`,
    );
  }

  const { expected, sourcePaths } = expectedDocuments(root);
  const marker = `<meta name="generator" content="${GENERATOR_ID}">`;

  for (const [outputPath, html] of expected) {
    const absoluteOutputPath = path.join(root, outputPath);
    if (existsSync(absoluteOutputPath)) {
      const existing = readFileSync(absoluteOutputPath, "utf8");
      if (existing !== html && !existing.includes(marker)) {
        throw new Error(`Refusing to overwrite unmanaged HTML: ${outputPath}`);
      }
    }
  }

  const managedPaths = managedHtmlPaths(root);

  for (const [outputPath, html] of expected) {
    const absoluteOutputPath = path.join(root, outputPath);
    writeFileSync(absoluteOutputPath, html, "utf8");
  }

  for (const outputPath of managedPaths) {
    if (!expected.has(outputPath)) {
      rmSync(path.join(root, outputPath));
    }
  }

  console.log(`Generated ${sourcePaths.length} HTML documentation counterparts.`);
}

function checkDocuments(root) {
  const { issues, sourcePaths } = parityIssues(root);
  if (issues.length > 0) {
    console.error("HTML documentation parity check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    console.error("Run `npm run docs:generate` and commit the results.");
    process.exitCode = 1;
    return;
  }

  console.log(
    `HTML documentation parity check passed for ${sourcePaths.length} sources.`,
  );
}

function main() {
  const root = process.cwd();
  const mode = process.argv[2];

  if (mode === "--write") {
    writeDocuments(root);
  } else if (mode === "--check") {
    checkDocuments(root);
  } else {
    console.error("Usage: node scripts/docs-parity.mjs --write|--check");
    process.exitCode = 2;
  }
}

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  main();
}
