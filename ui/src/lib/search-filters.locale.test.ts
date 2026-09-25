import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import {
  buildFilterChips,
  describeLoosenSuggestion,
  priorityLabel,
  sortLabel,
  statusLabel,
  updatedWithinLabel,
} from "./search-filters";

const lookups = {
  agentName: () => undefined,
  userName: () => undefined,
  projectName: () => undefined,
  labelName: () => undefined,
  currentUserId: null,
};

afterEach(async () => { await i18n.changeLanguage("en"); });

describe("search filter locale labels", () => {
  it("keeps the English default and translates the same values in Chinese", async () => {
    await i18n.changeLanguage("en");
    expect(sortLabel("relevance")).toBe("Relevance");
    expect(statusLabel("todo")).toBe("Todo");
    expect(updatedWithinLabel("7d")).toBe("Last 7 days");

    await i18n.changeLanguage("zh-CN");
    expect(sortLabel("relevance")).toBe("相关性");
    expect(statusLabel("todo")).toBe("待办");
    expect(priorityLabel("high")).toBe("高");
    expect(updatedWithinLabel("7d")).toBe("最近 7 天");
    expect(buildFilterChips({ status: ["todo"], updatedWithin: "7d" }, lookups).map((chip) => chip.label))
      .toEqual(["状态：待办", "更新：最近 7 天"]);
    expect(describeLoosenSuggestion("status", ["todo"], lookups)).toBe("状态：待办");
  });
});
