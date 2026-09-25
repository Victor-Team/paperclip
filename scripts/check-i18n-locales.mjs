#!/usr/bin/env node
/** Fail when a locale has a missing or extra key compared with en.json. */
import fs from "node:fs";
import path from "node:path";

const localeDirectory = path.resolve(process.cwd(), "ui/src/i18n/locales");
const reference = JSON.parse(fs.readFileSync(path.join(localeDirectory, "en.json"), "utf8"));

function keys(value, prefix = "") {
  return Object.entries(value).flatMap(([key, child]) => {
    const next = prefix ? `${prefix}.${key}` : key;
    return child && typeof child === "object" && !Array.isArray(child) ? keys(child, next) : [next];
  });
}

const referenceKeys = new Set(keys(reference));
const failures = [];
for (const filename of fs.readdirSync(localeDirectory).filter((file) => file.endsWith(".json")).sort()) {
  const actualKeys = new Set(keys(JSON.parse(fs.readFileSync(path.join(localeDirectory, filename), "utf8"))));
  const missing = [...referenceKeys].filter((key) => !actualKeys.has(key));
  const extra = [...actualKeys].filter((key) => !referenceKeys.has(key));
  if (missing.length || extra.length) failures.push({ filename, missing, extra });
}

if (failures.length) {
  process.stderr.write(`${JSON.stringify(failures, null, 2)}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Locale key sets match en.json (${referenceKeys.size} keys across ${fs.readdirSync(localeDirectory).filter((file) => file.endsWith(".json")).length} locales).\n`);
}
