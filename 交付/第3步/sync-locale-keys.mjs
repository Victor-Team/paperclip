// 把 en.json 的键集深度合并进其余 locale 文件：只补缺失键（值用英文原文占位），
// 已有的翻译原样保留，不覆盖。2 空格缩进，文件末尾保留换行。
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "..", "ui", "src", "i18n", "locales");
const en = JSON.parse(readFileSync(join(localesDir, "en.json"), "utf8"));

function isPlainObject(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function mergeMissing(target, source) {
  const result = isPlainObject(target) ? { ...target } : {};
  for (const [key, value] of Object.entries(source)) {
    if (isPlainObject(value)) {
      result[key] = mergeMissing(isPlainObject(result[key]) ? result[key] : {}, value);
    } else if (!(key in result)) {
      result[key] = value; // missing key: fill with English placeholder
    }
  }
  return result;
}

const files = readdirSync(localesDir).filter((f) => f.endsWith(".json") && f !== "en.json" && f !== "zh-CN.json");
for (const file of files) {
  const path = join(localesDir, file);
  const existing = JSON.parse(readFileSync(path, "utf8"));
  const merged = mergeMissing(existing, en);
  writeFileSync(path, JSON.stringify(merged, null, 2) + "\n", "utf8");
  console.log(`synced ${file}`);
}
