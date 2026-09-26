import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import express from "express";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptedEncodings, precompressedStatic } from "../static-precompressed.js";

const source = `export const bundle = ${JSON.stringify("x".repeat(5000))};\n`;
let dir: string;

function appFor(assetsDir: string) {
  const app = express();
  // Same stack as app.ts: precompressed siblings first, then plain static files.
  app.use(
    "/assets",
    precompressedStatic(assetsDir, { cacheControl: "public, max-age=31536000, immutable" }),
    express.static(assetsDir, { maxAge: "1y", immutable: true }),
  );
  return app;
}

// Raw HTTP so the test sees the bytes on the wire (supertest decodes them).
async function rawGet(app: express.Express, urlPath: string, headers: Record<string, string>) {
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  try {
    return await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
      http
        .get({ host: "127.0.0.1", port, path: urlPath, headers }, (res) => {
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => chunks.push(chunk));
          res.on("end", () => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks) }));
        })
        .on("error", reject);
    });
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

beforeAll(() => {
  // Real installs sit under a dot-directory (~/.paperclip/...); keep that shape.
  dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "precompressed-")), ".paperclip", "ui-dist", "assets");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index-abc.js"), source);
  fs.writeFileSync(path.join(dir, "index-abc.js.gz"), zlib.gzipSync(source));
  fs.writeFileSync(path.join(dir, "index-abc.js.br"), zlib.brotliCompressSync(source));
  fs.writeFileSync(path.join(dir, "plain-def.css"), "body{color:red}");
});

afterAll(() => {
  fs.rmSync(path.resolve(dir, "../../.."), { recursive: true, force: true });
});

describe("precompressedStatic", () => {
  it("serves the brotli sibling with the original content type when br is accepted", async () => {
    const res = await rawGet(appFor(dir), "/assets/index-abc.js", { "Accept-Encoding": "gzip, deflate, br" });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBe("br");
    expect(res.headers["content-type"]).toMatch(/javascript/);
    expect(res.headers["vary"]).toMatch(/Accept-Encoding/i);
    expect(res.headers["cache-control"]).toBe("public, max-age=31536000, immutable");
    expect(zlib.brotliDecompressSync(res.body).toString()).toBe(source);
  });

  it("serves the gzip sibling when only gzip is accepted", async () => {
    const res = await rawGet(appFor(dir), "/assets/index-abc.js", { "Accept-Encoding": "gzip" });
    expect(res.headers["content-encoding"]).toBe("gzip");
    expect(zlib.gunzipSync(res.body).toString()).toBe(source);
  });

  it("serves the original bytes when no compression is accepted", async () => {
    const res = await rawGet(appFor(dir), "/assets/index-abc.js", { "Accept-Encoding": "identity" });
    expect(res.status).toBe(200);
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.body.toString()).toBe(source);
    expect(res.headers["cache-control"]).toMatch(/immutable/);
  });

  it("falls through for files without a sibling and for range requests", async () => {
    const plain = await request(appFor(dir)).get("/assets/plain-def.css").set("Accept-Encoding", "br, gzip");
    expect(plain.status).toBe(200);
    expect(plain.headers["content-encoding"]).toBeUndefined();
    expect(plain.text).toBe("body{color:red}");

    const ranged = await request(appFor(dir))
      .get("/assets/index-abc.js")
      .set("Accept-Encoding", "br")
      .set("Range", "bytes=0-9");
    expect(ranged.status).toBe(206);
    expect(ranged.headers["content-encoding"]).toBeUndefined();
  });

  it("does not escape the assets directory", async () => {
    fs.writeFileSync(path.join(path.dirname(dir), "secret.txt.gz"), zlib.gzipSync("secret"));
    const res = await request(appFor(dir))
      .get("/assets/..%2Fsecret.txt")
      .set("Accept-Encoding", "gzip");
    expect(res.headers["content-encoding"]).toBeUndefined();
    expect(res.status).not.toBe(200);
  });
});

describe("acceptedEncodings", () => {
  it("honours explicit q=0 refusals", () => {
    expect([...acceptedEncodings("br;q=0, gzip;q=0.8")]).toEqual(["gzip"]);
    expect(acceptedEncodings(undefined).size).toBe(0);
  });
});
