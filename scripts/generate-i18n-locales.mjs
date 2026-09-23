#!/usr/bin/env node
/** Synchronize every locale's key shape with en.json without changing values. */
import fs from "node:fs";
import path from "node:path";

const localeDirectory = path.resolve(process.cwd(), "ui/src/i18n/locales");
const english = JSON.parse(fs.readFileSync(path.join(localeDirectory, "en.json"), "utf8"));

function synchronize(reference, current) {
  return Object.fromEntries(Object.entries(reference).map(([key, value]) => {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return [key, synchronize(value, current?.[key])];
    }
    return [key, typeof current?.[key] === "string" ? current[key] : value];
  }));
}

for (const filename of fs.readdirSync(localeDirectory).filter((file) => file.endsWith(".json")).sort()) {
  if (filename === "en.json") continue;
  const filenamePath = path.join(localeDirectory, filename);
  const current = JSON.parse(fs.readFileSync(filenamePath, "utf8"));
  fs.writeFileSync(filenamePath, `${JSON.stringify(synchronize(english, current), null, 2)}\n`);
}
