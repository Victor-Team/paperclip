#!/usr/bin/env node
/**
 * Apply {key: chineseText} translations into zh-CN.json.
 *
 * Usage:
 *   node scripts/i18n-apply-zh.mjs <translations.json>
 */
import fs from "node:fs";
import path from "node:path";

const translationsPath = process.argv[2];
if (!translationsPath) throw new Error("Usage: node scripts/i18n-apply-zh.mjs <translations.json>");

const translations = JSON.parse(fs.readFileSync(translationsPath, "utf8"));
const localeDirectory = path.resolve(process.cwd(), "ui/src/i18n/locales");
const zhPath = path.join(localeDirectory, "zh-CN.json");
const zh = JSON.parse(fs.readFileSync(zhPath, "utf8"));

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

let count = 0;
for (const [key, value] of Object.entries(translations)) {
  setDeep(zh, key, value);
  count++;
}

fs.writeFileSync(zhPath, `${JSON.stringify(zh, null, 2)}\n`);
process.stderr.write(`Applied ${count} zh-CN translations.\n`);
