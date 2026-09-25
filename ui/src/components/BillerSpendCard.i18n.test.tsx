import { renderToStaticMarkup } from "react-dom/server";
import type { CostByBiller } from "@paperclipai/shared";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { BillerSpendCard } from "./BillerSpendCard";

const row: CostByBiller = {
  biller: "openai",
  costCents: 2500,
  inputTokens: 100,
  cachedInputTokens: 0,
  outputTokens: 50,
  apiRunCount: 2,
  subscriptionRunCount: 1,
  subscriptionCachedInputTokens: 0,
  subscriptionInputTokens: 0,
  subscriptionOutputTokens: 0,
  providerCount: 2,
  modelCount: 2,
};

afterEach(async () => {
  await i18n.changeLanguage("en");
});

describe("BillerSpendCard localization", () => {
  it("renders full English count phrases and allocation text", async () => {
    await i18n.changeLanguage("en");
    const html = renderToStaticMarkup(<BillerSpendCard row={row} weekSpendCents={1000} budgetMonthlyCents={10000} totalCompanySpendCents={5000} providerRows={[]} />);
    expect(html).toContain("2 providers");
    expect(html).toContain("2 models");
    expect(html).toContain("2 metered runs");
    expect(html).toContain("1 subscription run");
    expect(html).toContain("50% of allocation");
  });

  it("renders Chinese phrases without an English plural suffix", async () => {
    await i18n.changeLanguage("zh-CN");
    const html = renderToStaticMarkup(<BillerSpendCard row={row} weekSpendCents={1000} budgetMonthlyCents={10000} totalCompanySpendCents={5000} providerRows={[]} />);
    expect(html).toContain("2 个供应商");
    expect(html).toContain("2 个模型");
    expect(html).toContain("2 次计量运行");
    expect(html).toContain("1 次订阅运行");
    expect(html).toContain("已用分配额度的 50%");
    expect(html).not.toContain("供应商s");
  });

  it("renders billing type labels from the component's three-level namespace", async () => {
    await i18n.changeLanguage("zh-CN");
    const html = renderToStaticMarkup(<BillerSpendCard
      row={row}
      weekSpendCents={1000}
      budgetMonthlyCents={10000}
      totalCompanySpendCents={5000}
      providerRows={[{
        provider: "openai", biller: "openai", billingType: "metered_api", model: "test-model",
        costCents: 1000, inputTokens: 0, cachedInputTokens: 0, outputTokens: 0,
        apiRunCount: 1, subscriptionRunCount: 0, subscriptionCachedInputTokens: 0,
        subscriptionInputTokens: 0, subscriptionOutputTokens: 0,
      }]}
    />);
    expect(html).toContain("计量 API");
    expect(html).not.toContain("billerspendcard.billingTypes.metered_api");
  });
});
