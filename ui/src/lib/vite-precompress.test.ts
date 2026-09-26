// @vitest-environment node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { afterEach, describe, expect, it } from "vitest";
import { isPrecompressibleAsset, precompressDirectory } from "./vite-precompress";

let dir: string | null = null;
afterEach(() => {
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
  dir = null;
});

describe("precompressDirectory", () => {
  it("writes decodable br and gz siblings for compressible assets only", () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "vite-precompress-"));
    const js = `console.log(${JSON.stringify("y".repeat(4000))});`;
    fs.writeFileSync(path.join(dir, "index-a.js"), js);
    fs.writeFileSync(path.join(dir, "tiny-b.js"), "x");
    fs.writeFileSync(path.join(dir, "logo-c.png"), Buffer.alloc(4000));

    expect(precompressDirectory(dir)).toBe(1);
    expect(zlib.brotliDecompressSync(fs.readFileSync(path.join(dir, "index-a.js.br"))).toString()).toBe(js);
    expect(zlib.gunzipSync(fs.readFileSync(path.join(dir, "index-a.js.gz"))).toString()).toBe(js);
    expect(fs.existsSync(path.join(dir, "tiny-b.js.gz"))).toBe(false);
    expect(fs.existsSync(path.join(dir, "logo-c.png.gz"))).toBe(false);
  });

  it("classifies assets by extension and size", () => {
    expect(isPrecompressibleAsset("app.css", 2048)).toBe(true);
    expect(isPrecompressibleAsset("app.css", 10)).toBe(false);
    expect(isPrecompressibleAsset("font.woff2", 50_000)).toBe(false);
  });
});
