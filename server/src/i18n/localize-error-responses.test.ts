import { describe, expect, it, vi, type Mock } from "vitest";
import type { Request, Response } from "express";
import express from "express";
import type { AddressInfo } from "node:net";
import { localizeErrorResponses } from "./localize-error-responses.js";

type FakeRes = {
  json: Mock;
  statusCode: number;
};

/**
 * Drive the middleware against a fake route that writes via res.json.
 * The fake `json` returns the response itself, mimicking Express's chainable
 * `res.json()`.
 */
function run(
  headers: Record<string, string>,
  write: (res: FakeRes, req: Request) => void,
  statusCode = 200,
): { jsonSpy: Mock; res: FakeRes; nextCalls: number; unwrapped: boolean } {
  const middleware = localizeErrorResponses();
  const req = { headers } as unknown as Request;
  const res: FakeRes = {
    json: vi.fn(function json(this: FakeRes) { return this as unknown as Response; }),
    statusCode,
  };
  const jsonSpy = res.json;
  let nextCalls = 0;
  middleware(req, res as unknown as Response, () => {
    nextCalls += 1;
    write(res, req);
  });
  return { jsonSpy, res, nextCalls, unwrapped: res.json === jsonSpy };
}

describe("localizeErrorResponses", () => {
  it("does not wrap res.json for default (en) requests", () => {
    const { jsonSpy, nextCalls, unwrapped } = run({}, (r) => {
      r.json({ error: "Issue not found" });
    });
    expect(nextCalls).toBe(1);
    expect(unwrapped).toBe(true);
    expect(jsonSpy).toHaveBeenCalledWith({ error: "Issue not found" });
  });

  it("translates a known catalog error for zh-CN requests", () => {
    const { jsonSpy } = run({ "accept-language": "zh-CN,zh;q=0.9" }, (r) => {
      r.json({ error: "Issue not found" });
    }, 404);
    expect(jsonSpy).toHaveBeenCalledWith({ error: "未找到任务" });
  });

  it("honors the explicit X-Paperclip-Locale header", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Agent not found", code: "not_found" });
    }, 404);
    expect(jsonSpy).toHaveBeenCalledWith({ error: "未找到智能体", code: "not_found" });
  });

  it("leaves non-error payloads, nested fields, and details untouched", () => {
    const body = {
      ok: true,
      items: [{ id: 1 }],
      error: null,
      details: [{ message: "Validation error" }],
    };
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json(body);
    });
    expect(jsonSpy).toHaveBeenCalledWith(body);
  });

  it("rewrites uncataloged English prose to Chinese and keeps the original on errorOriginal", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Something domain specific happened" });
    }, 404);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: "未找到",
      errorOriginal: "Something domain specific happened",
    });
  });

  it("does not attach errorOriginal for a precise catalog translation", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Validation error", details: [{ path: "name" }], requestId: "req-1" });
    }, 400);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: "校验错误",
      details: [{ path: "name" }],
      requestId: "req-1",
    });
  });

  it("passes through a technical identifier without inventing a Chinese sentence", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "dev_server_supervisor_unavailable", code: "unavailable" });
    }, 503);
    expect(jsonSpy).toHaveBeenCalledWith({
      error: "dev_server_supervisor_unavailable",
      code: "unavailable",
    });
  });

  it("preserves all sibling fields when translating", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Validation error", details: [{ path: "name" }], requestId: "req-1" });
    });
    expect(jsonSpy).toHaveBeenCalledWith({
      error: "校验错误",
      details: [{ path: "name" }],
      requestId: "req-1",
    });
  });

  it("does not mutate the original body object", () => {
    const body = { error: "Issue not found", extra: 1 };
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json(body);
    });
    expect(body).toEqual({ error: "Issue not found", extra: 1 });
    expect(jsonSpy).toHaveBeenCalledWith({ error: "未找到任务", extra: 1 });
  });

  it("falls back to the original body if translation throws", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json(
        Object.create(null, {
          error: {
            get() {
              throw new Error("boom");
            },
          },
        }),
      );
    });
    expect(jsonSpy).toHaveBeenCalledOnce();
  });

  it("keeps arrays and primitives untouched", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json([1, 2, 3]);
      r.json(null);
      r.json("text");
    });
    expect(jsonSpy).toHaveBeenNthCalledWith(1, [1, 2, 3]);
    expect(jsonSpy).toHaveBeenNthCalledWith(2, null);
    expect(jsonSpy).toHaveBeenNthCalledWith(3, "text");
  });

  it("treats Traditional Chinese requests as default (no catalog)", () => {
    const { jsonSpy } = run({ "accept-language": "zh-TW" }, (r) => {
      r.json({ error: "Issue not found" });
    });
    expect(jsonSpy).toHaveBeenCalledWith({ error: "Issue not found" });
  });
});

describe("localizeErrorResponses HTTP", () => {
  async function withServer<T>(
    register: (app: express.Express) => void,
    fn: (base: string) => Promise<T>,
  ): Promise<T> {
    const app = express();
    app.use(localizeErrorResponses());
    register(app);
    const server = await new Promise<import("node:http").Server>((resolve) => {
      const s = app.listen(0, "127.0.0.1", () => resolve(s));
    });
    try {
      const addr = server.address() as AddressInfo;
      return await fn(`http://127.0.0.1:${addr.port}`);
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  }

  async function readJson(
    base: string,
    path: string,
    headers: Record<string, string>,
  ): Promise<{ status: number; body: unknown }> {
    const res = await fetch(`${base}${path}`, { headers });
    return { status: res.status, body: await res.json() };
  }

  it("normal path: success JSON is unchanged under X-Paperclip-Locale: zh-CN", async () => {
    await withServer(
      (app) => {
        app.get("/ok", (_req, res) => {
          res.json({ ok: true, name: "ANC 测试公司" });
        });
      },
      async (base) => {
        const got = await readJson(base, "/ok", { "X-Paperclip-Locale": "zh-CN" });
        expect(got.status).toBe(200);
        expect(got.body).toEqual({ ok: true, name: "ANC 测试公司" });
      },
    );
  });

  it("known error: catalog copy becomes precise Chinese", async () => {
    await withServer(
      (app) => {
        app.get("/issue", (_req, res) => {
          res.status(404).json({ error: "Issue not found" });
        });
      },
      async (base) => {
        const zh = await readJson(base, "/issue", { "X-Paperclip-Locale": "zh-CN" });
        expect(zh).toEqual({ status: 404, body: { error: "未找到任务" } });
        const en = await readJson(base, "/issue", {});
        expect(en).toEqual({ status: 404, body: { error: "Issue not found" } });
      },
    );
  });

  it("unlisted error: English prose is not returned in error; original is on errorOriginal", async () => {
    await withServer(
      (app) => {
        app.get("/widget", (_req, res) => {
          res.status(404).json({ error: "Widget not found" });
        });
        app.get("/conflict", (_req, res) => {
          res.status(409).json({ error: "Widget already claimed by another process" });
        });
      },
      async (base) => {
        const missing = await readJson(base, "/widget", { "X-Paperclip-Locale": "zh-CN" });
        expect(missing.status).toBe(404);
        expect(missing.body).toEqual({
          error: "未找到",
          errorOriginal: "Widget not found",
        });
        const conflict = await readJson(base, "/conflict", {
          "X-Paperclip-Locale": "zh-CN",
        });
        expect(conflict.status).toBe(409);
        expect(conflict.body).toEqual({
          error: "请求冲突",
          errorOriginal: "Widget already claimed by another process",
        });
      },
    );
  });

  it("default path: unlisted English stays English with no extra fields", async () => {
    await withServer(
      (app) => {
        app.get("/widget", (_req, res) => {
          res.status(404).json({ error: "Widget not found" });
        });
      },
      async (base) => {
        const got = await readJson(base, "/widget", {});
        expect(got).toEqual({ status: 404, body: { error: "Widget not found" } });
      },
    );
  });
});
