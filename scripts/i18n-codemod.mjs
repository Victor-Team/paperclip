#!/usr/bin/env node
/**
 * AST-backed i18n codemod for user-facing TSX copy.
 *
 * The TypeScript compiler API supplies the syntax tree; replacements are made
 * by node spans so comments and unrelated formatting stay intact. This script
 * intentionally only rewrites copy that is evaluated inside a React component.
 * Module-scope label maps are reported for the caller to convert into key maps,
 * never changed to a frozen module-scope t() call.
 *
 * Usage:
 *   node scripts/i18n-codemod.mjs --directory ui/src/pages/audit --expected 126
 *   node scripts/i18n-codemod.mjs --directory ui/src/pages/audit --write
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { API } from "typescript/unstable/sync";
import * as ts from "typescript/unstable/ast";

const TRANSLATABLE_ATTRIBUTES = new Set(["placeholder", "title", "aria-label", "alt", "label"]);
const sourceRoot = process.cwd();
const args = process.argv.slice(2);
const directoryIndex = args.indexOf("--directory");
const jsonIndex = args.indexOf("--json");
const expectedIndex = args.indexOf("--expected");
const write = args.includes("--write");

if (directoryIndex === -1 || !args[directoryIndex + 1]) {
  throw new Error("Usage: node scripts/i18n-codemod.mjs --directory <relative-directory> [--write] [--json <report-path>]");
}

const directory = path.resolve(sourceRoot, args[directoryIndex + 1]);
const reportPath = jsonIndex === -1 ? null : path.resolve(sourceRoot, args[jsonIndex + 1] ?? "");
const expected = expectedIndex === -1 ? null : Number(args[expectedIndex + 1]);
if (expected !== null && (!Number.isInteger(expected) || expected < 0)) {
  throw new Error("--expected must be a non-negative integer");
}

const compilerApi = new API({ cwd: sourceRoot });
const snapshot = compilerApi.updateSnapshot({
  openProjects: [path.join(sourceRoot, "ui/tsconfig.json")],
});
const uiProject = snapshot.getProjects().find((project) => project.configFileName.endsWith("/ui/tsconfig.json"));
if (!uiProject) throw new Error("TypeScript compiler API did not load ui/tsconfig.json");

function filesUnder(root) {
  return fs.readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory()) return filesUnder(entryPath);
    return entry.isFile() && entry.name.endsWith(".tsx") && !entry.name.includes(".test.") ? [entryPath] : [];
  });
}

function visible(value) {
  const trimmed = value.trim();
  return Boolean(trimmed) && /[A-Za-z]/.test(trimmed)
    && !/^(?:https?:|\/|[A-Z_][A-Z0-9_]*$|[a-z][\w.-]*\.[a-z][\w.-]*$)/.test(trimmed);
}

function componentAncestor(node) {
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isFunctionDeclaration(current) || ts.isFunctionExpression(current) || ts.isArrowFunction(current))
      && current.body && ts.isBlock(current.body)) {
      const name = current.name?.getText() ?? (() => {
        const parent = current.parent;
        return ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) ? parent.name.text : "";
      })();
      if (/^[A-Z]/.test(name)) return current;
    }
  }
  return null;
}

function isInsideJsx(node) {
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxElement(current) || ts.isJsxSelfClosingElement(current) || ts.isJsxFragment(current)) return true;
  }
  return false;
}

function isUserFacingLiteral(node) {
  if (ts.isJsxText(node)) return visible(node.getText());
  if (!ts.isStringLiteral(node) && !ts.isNoSubstitutionTemplateLiteral(node)) return false;
  if (!visible(node.text)) return false;
  const parent = node.parent;
  if (ts.isJsxAttribute(parent) && parent.initializer === node) {
    return TRANSLATABLE_ATTRIBUTES.has(parent.name.text);
  }
  if (!isInsideJsx(node)) return false;
  for (let current = node.parent; current; current = current.parent) {
    if (ts.isJsxAttribute(current)) return false;
    if (ts.isVariableDeclaration(current) || ts.isCallExpression(current) || ts.isArrowFunction(current)) return false;
  }
  if (/^[a-z][a-z0-9_]*:[a-z0-9_]+$/i.test(node.text)) return false;
  for (let current = node; current.parent; current = current.parent) {
    const parent = current.parent;
    if (ts.isJsxExpression(parent)) return true;
    if (ts.isConditionalExpression(parent) && parent.condition === current) return false;
    if (ts.isBinaryExpression(parent) && /(?:Equals|ExclamationEquals|LessThan|GreaterThan|AmpersandAmpersand|BarBar)/.test(ts.formatSyntaxKind(parent.operatorToken.kind))) return false;
  }
  return false;
}

function keyBase(file, text) {
  const module = path.basename(file, ".tsx").replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
  const words = text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 7);
  return `${module}.general.${words.join("") || "copy"}`;
}

function insertUseTranslation(component) {
  const position = component.body.getStart() + 1;
  return { start: position, end: position, replacement: "\n  const { t } = useTranslation();" };
}

function hasTranslationImport(source) {
  return source.statements.some((statement) => ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier) && statement.moduleSpecifier.text === "@/i18n");
}

function scan(file) {
  const sourceText = fs.readFileSync(file, "utf8");
  const source = uiProject.program.getSourceFile(file);
  if (!source) throw new Error(`TypeScript compiler API did not load ${file}`);
  const candidates = [];
  const edits = [];
  const translatedComponents = new Set();
  const keys = new Set();
  let keySuffix = 0;

  const visit = (node) => {
    if (isUserFacingLiteral(node)) {
      const text = node.getText().trim();
      const normalized = ts.isJsxText(node) ? text : node.text;
      const component = componentAncestor(node);
      const kind = ts.isJsxText(node) ? "jsx_text" : ts.isJsxAttribute(node.parent) ? `attribute:${node.parent.name.text}` : "jsx_expression";
      if (!component) {
        candidates.push({ kind, text: normalized, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, automatic: false, reason: "outside React component" });
      } else {
        const base = keyBase(file, normalized);
        let key = base;
        while (keys.has(key)) key = `${base}${++keySuffix}`;
        keys.add(key);
        candidates.push({ kind, text: normalized, key, line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1, automatic: true });
        const quote = JSON.stringify(key);
        // JSX text can carry inline separator spaces, e.g. `Images · {count}`
        // or `{page} of {total}`. Keep those literal spaces outside the
        // translation call; trimming the key must not join adjacent nodes.
        const nodeSourceText = sourceText.slice(node.getStart(source), node.getEnd());
        const siblings = ts.isJsxElement(node.parent) ? node.parent.children : [];
        const index = siblings.indexOf(node);
        const previousSibling = index > 0 ? siblings[index - 1] : null;
        const nextSibling = index >= 0 ? siblings[index + 1] : null;
        const leadingInlineSpace = ts.isJsxText(node) && Boolean(previousSibling) && ts.isJsxExpression(previousSibling)
          ? (nodeSourceText.match(/^[ \\t]+/)?.[0] ?? "")
          : "";
        const trailingInlineSpace = ts.isJsxText(node) && Boolean(nextSibling) && ts.isJsxExpression(nextSibling)
          ? (nodeSourceText.match(/[ \\t]+$/)?.[0] ?? "")
          : "";
        const replacement = ts.isJsxText(node) || ts.isJsxAttribute(node.parent)
          ? `${leadingInlineSpace}{t(${quote})}${trailingInlineSpace}`
          : `t(${quote})`;
        edits.push({ start: node.getStart(source), end: node.getEnd(), replacement });
        translatedComponents.add(component);
      }
    }
    node.forEachChild(visit);
  };
  visit(source);

  if (write && edits.length) {
    if (!hasTranslationImport(source)) {
      const lastImport = source.statements.filter(ts.isImportDeclaration).at(-1);
      edits.push({
        start: lastImport ? lastImport.getEnd() : 0,
        end: lastImport ? lastImport.getEnd() : 0,
        replacement: `${lastImport ? "\n" : ""}import { useTranslation } from "@/i18n";`,
      });
    }
    for (const component of translatedComponents) edits.push(insertUseTranslation(component));
    const next = edits.sort((left, right) => right.start - left.start)
      .reduce((value, edit) => `${value.slice(0, edit.start)}${edit.replacement}${value.slice(edit.end)}`, sourceText);
    fs.writeFileSync(file, next);
  }
  return { file: path.relative(sourceRoot, file), candidates, keys: candidates.filter((entry) => entry.key).map((entry) => ({ key: entry.key, text: entry.text })) };
}

const reports = filesUnder(directory).sort().map(scan);
const candidates = reports.flatMap((report) => report.candidates);
const automatic = candidates.filter((entry) => entry.automatic).length;
const baseline = expected ?? candidates.length;
const report = {
  directory: path.relative(sourceRoot, directory),
  mode: write ? "write" : "scan",
  files: reports,
  summary: {
    scannedFiles: reports.length,
    detectedVisibleStrings: candidates.length,
    expectedVisibleStrings: baseline,
    automatic,
    manual: Math.max(0, baseline - automatic),
    automaticRate: baseline === 0 ? 1 : automatic / baseline,
  },
};
if (reportPath) fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
snapshot.dispose();
compilerApi.close();
