import fs from "node:fs";
import path from "node:path";
import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Serve the `.br` / `.gz` siblings that the UI build writes next to each
 * hashed asset (ui/src/lib/vite-precompress.ts) when the browser accepts them.
 *
 * The UI bundle is tens of MB uncompressed; serving it raw made every cold
 * load transfer all of it. Precompressed siblings cost no runtime CPU. Anything
 * without a sibling, range requests, and clients that accept neither encoding
 * fall through to the regular static handler unchanged.
 */

const ENCODINGS = [
  { token: "br", extension: ".br" },
  { token: "gzip", extension: ".gz" },
] as const;

/** Encodings the client accepts, honouring explicit `;q=0` refusals. */
export function acceptedEncodings(header: string | undefined): Set<string> {
  const accepted = new Set<string>();
  if (!header) return accepted;
  for (const part of header.split(",")) {
    const [rawToken, ...params] = part.trim().split(";");
    const token = rawToken?.trim().toLowerCase();
    if (!token) continue;
    const q = params
      .map((param) => param.trim().split("="))
      .find(([key]) => key?.trim().toLowerCase() === "q")?.[1];
    if (q !== undefined && Number(q) === 0) continue;
    accepted.add(token);
  }
  return accepted;
}

export function precompressedStatic(
  root: string,
  options: { cacheControl: string },
): RequestHandler {
  const resolvedRoot = path.resolve(root);
  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.headers.range) return next();
    let relativePath: string;
    try {
      relativePath = decodeURIComponent(req.path);
    } catch {
      return next();
    }
    const filePath = path.resolve(resolvedRoot, `.${relativePath}`);
    if (!filePath.startsWith(resolvedRoot + path.sep)) return next();

    const accepted = acceptedEncodings(req.headers["accept-encoding"]);
    for (const encoding of ENCODINGS) {
      if (!accepted.has(encoding.token)) continue;
      const encodedPath = `${filePath}${encoding.extension}`;
      let stat: fs.Stats;
      try {
        stat = fs.statSync(encodedPath);
      } catch {
        continue;
      }
      if (!stat.isFile()) continue;
      res.vary("Accept-Encoding");
      res.type(path.extname(filePath));
      res.set({
        "Content-Encoding": encoding.token,
        "Cache-Control": options.cacheControl,
      });
      // `root` keeps send's dot-file check on the asset path only: installs
      // live under dot-directories (e.g. ~/.paperclip), which an absolute
      // path would trip into a 404.
      res.sendFile(path.relative(resolvedRoot, encodedPath), { root: resolvedRoot, cacheControl: false, lastModified: true }, (error) => {
        if (!error || res.headersSent) return;
        // Fall back to the plain file rather than failing the asset.
        res.removeHeader("Content-Encoding");
        res.removeHeader("Cache-Control");
        res.removeHeader("Content-Type");
        next();
      });
      return;
    }
    // A cache in front of this server must not reuse an identity response
    // for a client that could have taken a compressed one.
    res.vary("Accept-Encoding");
    next();
  };
}
