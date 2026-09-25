#!/usr/bin/env node
/**
 * Merge codemod-reported {key, text} pairs into en.json (English source text)
 * and print a dedup'd list of {key, text} needing zh-CN translation.
 *
 * Usage:
 *   node scripts/i18n-merge-keys.mjs <report.json>
 */
import fs from "node:fs";
import path from "node:path";

const reportPath = process.argv[2];
if (!reportPath) throw new Error("Usage: node scripts/i18n-merge-keys.mjs <report.json>");

const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
const localeDirectory = path.resolve(process.cwd(), "ui/src/i18n/locales");
const enPath = path.join(localeDirectory, "en.json");
const en = JSON.parse(fs.readFileSync(enPath, "utf8"));

function setDeep(object, dottedKey, value) {
  const parts = dottedKey.split(".");
  let cursor = object;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (typeof cursor[part] !== "object" || cursor[part] === null || Array.isArray(cursor[part])) {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = value;
}

function getDeep(object, dottedKey) {
  return dottedKey.split(".").reduce((cursor, part) => (cursor && typeof cursor === "object" ? cursor[part] : undefined), object);
}

const allKeys = report.files.flatMap((file) => file.keys);
const newEntries = [];
for (const { key, text } of allKeys) {
  if (getDeep(en, key) === undefined) {
    setDeep(en, key, text);
    newEntries.push({ key, text });
  }
}

fs.writeFileSync(enPath, `${JSON.stringify(en, null, 2)}\n`);
process.stdout.write(`${JSON.stringify(newEntries, null, 2)}\n`);
process.stderr.write(`Merged ${newEntries.length} new keys into en.json (${allKeys.length} total reported).\n`);
