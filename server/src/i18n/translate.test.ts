import { describe, expect, it } from "vitest";
import { translateServerMessage } from "./translate.js";
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

  it("falls back to the original English for uncataloged messages", () => {
    expect(translateServerMessage("Some rare domain-specific message", "zh-CN")).toBe(
      "Some rare domain-specific message",
    );
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

  it("keeps templates anchored so entity words cannot leak into frames", () => {
    // No catalog entry and no anchored template matches; nothing is mangled.
    expect(translateServerMessage("Widget not found", "zh-CN")).toBe("Widget not found");
  });

  it("handles the empty string without throwing", () => {
    expect(translateServerMessage("", "zh-CN")).toBe("");
  });
});
