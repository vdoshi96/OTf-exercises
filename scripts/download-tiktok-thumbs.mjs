#!/usr/bin/env node
/**
 * Compatibility entry point. The shared thumbnail pipeline owns validation,
 * normalization, retries, reporting, and atomic catalogue updates.
 */

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { platformWrapperArguments } from "./ensure-thumbnails.mjs";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const pipeline = path.join(scriptDirectory, "ensure-thumbnails.mjs");
const forwardedArguments = process.argv.slice(2);
const child = spawn(
  process.execPath,
  [pipeline, ...platformWrapperArguments("tiktok", forwardedArguments)],
  { stdio: "inherit" },
);

child.once("error", (error) => {
  console.error(`[tiktok-thumbs] unable to start shared pipeline: ${error.message}`);
  process.exitCode = 1;
});
child.once("exit", (code, signal) => {
  if (signal) {
    console.error(`[tiktok-thumbs] shared pipeline stopped by ${signal}`);
    process.exitCode = 1;
    return;
  }
  process.exitCode = code ?? 1;
});
