import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import type { Plugin } from "vite";

/**
 * Write `.br` and `.gz` siblings for the hashed build assets.
 *
 * The server serves `/assets/*` straight from disk and picks a precompressed
 * sibling when the browser accepts it (server/src/static-precompressed.ts).
 * Compressing once at build time keeps that path free of runtime CPU work;
 * without it every cold load shipped the JS uncompressed.
 */

const COMPRESSIBLE_EXTENSIONS = new Set([".js", ".mjs", ".css", ".json", ".svg", ".html", ".txt", ".wasm"]);
const MIN_BYTES = 1024;

export function isPrecompressibleAsset(fileName: string, size: number): boolean {
  return size >= MIN_BYTES && COMPRESSIBLE_EXTENSIONS.has(path.extname(fileName).toLowerCase());
}

export function precompressFile(filePath: string): void {
  const source = fs.readFileSync(filePath);
  fs.writeFileSync(`${filePath}.gz`, zlib.gzipSync(source, { level: 9 }));
  fs.writeFileSync(
    `${filePath}.br`,
    zlib.brotliCompressSync(source, {
      params: {
        // Quality 9 is ~20x faster than 11 on multi-MB bundles for ~9% larger output.
        [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
        [zlib.constants.BROTLI_PARAM_SIZE_HINT]: source.length,
      },
    }),
  );
}

export function precompressDirectory(directory: string): number {
  if (!fs.existsSync(directory)) return 0;
  let count = 0;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const filePath = path.join(directory, entry.name);
    if (!isPrecompressibleAsset(entry.name, fs.statSync(filePath).size)) continue;
    precompressFile(filePath);
    count += 1;
  }
  return count;
}

export function precompressAssetsPlugin(options: { assetsDir?: string } = {}): Plugin {
  let outDir = "dist";
  return {
    name: "paperclip-precompress-assets",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      precompressDirectory(path.join(outDir, options.assetsDir ?? "assets"));
    },
  };
}
