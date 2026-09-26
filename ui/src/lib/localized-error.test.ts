import { afterEach, describe, expect, it } from "vitest";
import { ApiError } from "@/api/client";
import { i18n } from "@/i18n";
import { localizedError } from "./localized-error";

describe("localizedError", () => {
  afterEach(async () => { await i18n.changeLanguage("en"); });

  it("shows the translated server error and uses Chinese for local and network failures", async () => {
    await i18n.changeLanguage("zh-CN");
    expect(localizedError(new ApiError("无权更新任务", 403, { error: "无权更新任务" }), "操作失败"))
      .toBe("无权更新任务");
    expect(localizedError(new Error("Unable to post comment"), "无法发表评论"))
      .toBe("无法发表评论");
    expect(localizedError(new TypeError("Failed to fetch"), "无法发表评论"))
      .toBe("网络请求失败，请检查连接后重试。");
  });
});
