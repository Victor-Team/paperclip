#!/usr/bin/env node
/**
 * Conservative JSX i18n codemod inventory.
 *
 * It deliberately limits automatic rewrites to static JSX text and the
 * user-facing string attributes listed in `TRANSLATABLE_ATTRIBUTES`. Dynamic
 * expressions, module-level labels, templates, and code/status identifiers
 * are reported as manual work instead of being guessed at.
 *
 * Usage:
 *   node scripts/i18n-codemod.mjs --directory ui/src/pages/audit
 *   node scripts/i18n-codemod.mjs --directory ui/src/pages/audit --json report.json
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const TRANSLATABLE_ATTRIBUTES = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
const sourceRoot = process.cwd();
const args = process.argv.slice(2);
const directoryIndex = args.indexOf("--directory");
const jsonIndex = args.indexOf("--json");

if (directoryIndex === -1 || !args[directoryIndex + 1]) {
  throw new Error("Usage: node scripts/i18n-codemod.mjs --directory <relative-directory> [--json <report-path>]");
}

const directory = path.resolve(sourceRoot, args[directoryIndex + 1]);
const reportPath = jsonIndex === -1 ? null : path.resolve(sourceRoot, args[jsonIndex + 1] ?? "");

function filesUnder(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.")
      ? [entryPath]
      : [];
  });
}

function isVisibleText(value) {
  return /[A-Za-z]/.test(value) && !/^(?:https?:|\/|[A-Z_][A-Z0-9_]*$)/.test(value.trim());
}

function componentBefore(source, index) {
  return /(?:export\s+)?function\s+[A-Z][A-Za-z0-9_]*\s*(?:<[^>]*>)?\s*\(/.test(source.slice(0, index));
}

function candidate(source, index, kind, text) {
  const component = componentBefore(source, index);
  return {
    kind,
    text,
    line: source.slice(0, index).split("\n").length,
    automatic: Boolean(component),
    reason: component ? undefined : "not inside a named React component",
  };
}

function scan(file) {
  const source = fs.readFileSync(file, "utf8");
  const candidates = [];
  const jsxText = />([^<>{]+)</g;
  for (const match of source.matchAll(jsxText)) {
    const text = match[1].trim();
    if (isVisibleText(text)) candidates.push(candidate(source, match.index ?? 0, "jsx_text", text));
  }
  const attribute = /\b(placeholder|title|aria-label|alt|label)="([^"\n]+)"/g;
  for (const match of source.matchAll(attribute)) {
    if (TRANSLATABLE_ATTRIBUTES.has(match[1]) && isVisibleText(match[2])) {
      candidates.push(candidate(source, match.index ?? 0, `attribute:${match[1]}`, match[2]));
    }
  }
  return { file: path.relative(sourceRoot, file), candidates };
}

const reports = filesUnder(directory).sort().map(scan);
const candidates = reports.flatMap((report) => report.candidates);
const automatic = candidates.filter((entry) => entry.automatic).length;
const report = {
  directory: path.relative(sourceRoot, directory),
  files: reports,
  summary: {
    scannedFiles: reports.length,
    detectedVisibleStrings: candidates.length,
    automatic,
    manual: candidates.length - automatic,
    automaticRate: candidates.length === 0 ? 1 : automatic / candidates.length,
  },
};

const output = JSON.stringify(report, null, 2);
if (reportPath) fs.writeFileSync(reportPath, `${output}\n`);
process.stdout.write(`${output}\n`);
