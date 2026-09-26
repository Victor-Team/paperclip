import { describe, expect, it } from "vitest";
import { localizeServerMessage, translateServerMessage } from "./translate.js";
import { ZH_CN_EXACT } from "./zh-cn-messages.js";

describe("translateServerMessage", () => {
  it("returns the message unchanged for en (default path)", () => {
    expect(translateServerMessage("Issue not found", "en")).toBe("Issue not found");
    expect(translateServerMessage("anything at all", "en")).toBe("anything at all");
  });

  it("translates exact catalog entries to zh-CN", () => {
    expect(translateServerMessage("Issue not found", "zh-CN")).toBe("未找到任务");
    expect(translateServerMessage("Agent not found", "zh-CN")).toBe("未找到智能体");
    expect(translateServerMessage("Validation error", "zh-CN")).toBe("校验错误");
    expect(translateServerMessage("Internal server error", "zh-CN")).toBe("服务器内部错误");
    expect(translateServerMessage("Invalid JSON body", "zh-CN")).toBe("请求体不是有效的 JSON");
  });

  it("translates frames while passing interpolated data through verbatim", () => {
    expect(translateServerMessage("Plugin not found: acme-tools", "zh-CN")).toBe(
      "未找到插件：acme-tools",
    );
    expect(translateServerMessage("Missing permission: tools:manage_connections", "zh-CN")).toBe(
      "缺少权限：tools:manage_connections",
    );
    expect(translateServerMessage("displayName is required", "zh-CN")).toBe(
      "displayName为必填项",
    );
    expect(translateServerMessage('An environment named "staging" already exists for this instance.', "zh-CN")).toBe(
      "此实例已存在名为「staging」的环境。",
    );
    expect(translateServerMessage("Invalid pageSize query value", "zh-CN")).toBe(
      "「pageSize」查询参数值无效",
    );
  });

  it("prefers the exact entry when a static string also fits a template", () => {
    // "Secret key is required" is an exact entry; the generic `X is required`
    // template must not shadow it.
    expect(translateServerMessage("Secret key is required", "zh-CN")).toBe(
      ZH_CN_EXACT["Secret key is required"],
    );
  });

  it("handles the empty string without throwing", () => {
    expect(translateServerMessage("", "zh-CN")).toBe("");
  });
});

describe("localizeServerMessage — uncatalogued English", () => {
  it("rewrites uncatalogued English prose to a status-class Chinese fallback", () => {
    const result = localizeServerMessage(
      "Some rare domain-specific message",
      "zh-CN",
      404,
    );
    expect(result).toEqual({ text: "未找到", usedFallback: true });
  });

  it("uses the status class when the uncatalogued frame would have leaked an entity word", () => {
    // No catalog entry and no anchored template matches; do not emit
    // "Widget 未找到". The UI sees a Chinese status sentence instead.
    const result = localizeServerMessage("Widget not found", "zh-CN", 404);
    expect(result).toEqual({ text: "未找到", usedFallback: true });
  });

  it("picks the fallback by HTTP status class", () => {
    expect(localizeServerMessage("obscure failure", "zh-CN", 400).text).toBe("请求无效");
    expect(localizeServerMessage("obscure failure", "zh-CN", 401).text).toBe("未授权");
    expect(localizeServerMessage("obscure failure", "zh-CN", 403).text).toBe("禁止访问");
    expect(localizeServerMessage("obscure failure", "zh-CN", 409).text).toBe("请求冲突");
    expect(localizeServerMessage("obscure failure", "zh-CN", 422).text).toBe("请求无法处理");
    expect(localizeServerMessage("obscure failure", "zh-CN", 429).text).toBe("请求过于频繁");
    expect(localizeServerMessage("obscure failure", "zh-CN", 500).text).toBe("服务器内部错误");
    expect(localizeServerMessage("obscure failure", "zh-CN", 503).text).toBe("服务不可用");
    expect(localizeServerMessage("obscure failure", "zh-CN", 418).text).toBe("请求失败");
    expect(localizeServerMessage("obscure failure", "zh-CN").text).toBe("请求失败");
  });

  it("does not mark catalog or template hits as fallback", () => {
    expect(localizeServerMessage("Issue not found", "zh-CN", 404)).toEqual({
      text: "未找到任务",
      usedFallback: false,
    });
    expect(localizeServerMessage("Plugin not found: acme", "zh-CN", 404)).toEqual({
      text: "未找到插件：acme",
      usedFallback: false,
    });
  });
});

describe("localizeServerMessage — exceptions that stay verbatim", () => {
  it("passes through identifier-shaped technical tokens", () => {
    for (const token of [
      "dev_server_supervisor_unavailable",
      "not_cloud_managed",
      "tools:manage_connections",
      "grant_audience_denied",
    ]) {
      expect(localizeServerMessage(token, "zh-CN", 503)).toEqual({
        text: token,
        usedFallback: false,
      });
    }
  });

  it("does not treat a single lowercase English word as a technical token", () => {
    expect(localizeServerMessage("forbidden", "zh-CN", 403)).toEqual({
      text: "禁止访问",
      usedFallback: true,
    });
  });

  it("passes through ALL_CAPS codes and UUIDs", () => {
    expect(localizeServerMessage("ECONNREFUSED", "zh-CN", 500)).toEqual({
      text: "ECONNREFUSED",
      usedFallback: false,
    });
    const uuid = "550e8400-e29b-41d4-a716-446655440000";
    expect(localizeServerMessage(uuid, "zh-CN", 404)).toEqual({
      text: uuid,
      usedFallback: false,
    });
  });

  it("passes through data payloads (paths, URLs, JSON) and non-prose", () => {
    expect(localizeServerMessage("/home/yuanjian/work/file.ts", "zh-CN", 400).text).toBe(
      "/home/yuanjian/work/file.ts",
    );
    expect(localizeServerMessage("https://example.com/callback", "zh-CN", 400).text).toBe(
      "https://example.com/callback",
    );
    expect(localizeServerMessage('{"ok":false}', "zh-CN", 400).text).toBe('{"ok":false}');
    expect(localizeServerMessage("任务不存在", "zh-CN", 404).text).toBe("任务不存在");
    expect(localizeServerMessage("42", "zh-CN", 400).text).toBe("42");
  });

  it("leaves English unchanged for the default locale", () => {
    expect(localizeServerMessage("Widget not found", "en", 404)).toEqual({
      text: "Widget not found",
      usedFallback: false,
    });
  });
});
