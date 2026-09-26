import { describe, expect, it, vi, type Mock } from "vitest";
import type { Request, Response } from "express";
import { localizeErrorResponses } from "./localize-error-responses.js";

type FakeRes = {
  json: Mock;
};

/**
 * Drive the middleware against a fake route that writes via res.json.
 * The fake `json` returns the response itself, mimicking Express's chainable
 * `res.json()`.
 */
function run(
  headers: Record<string, string>,
  write: (res: FakeRes, req: Request) => void,
): { jsonSpy: Mock; res: FakeRes; nextCalls: number; unwrapped: boolean } {
  const middleware = localizeErrorResponses();
  const req = { headers } as unknown as Request;
  const res: FakeRes = {
    json: vi.fn(function json(this: FakeRes) { return this as unknown as Response; }),
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

  it("translates the top-level error for zh-CN requests", () => {
    const { jsonSpy } = run({ "accept-language": "zh-CN,zh;q=0.9" }, (r) => {
      r.json({ error: "Issue not found" });
    });
    expect(jsonSpy).toHaveBeenCalledWith({ error: "未找到任务" });
  });

  it("honors the explicit X-Paperclip-Locale header", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Agent not found", code: "not_found" });
    });
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

  it("leaves uncataloged error strings in English (fallback path)", () => {
    const { jsonSpy } = run({ "x-paperclip-locale": "zh-CN" }, (r) => {
      r.json({ error: "Something domain specific happened" });
    });
    expect(jsonSpy).toHaveBeenCalledWith({ error: "Something domain specific happened" });
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
