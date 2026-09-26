// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ProviderQuotaResumeBanner, summarizeProviderQuotaResume } from "./ProviderQuotaResumeBanner";

const waitsMock = vi.hoisted(() => vi.fn());
const resumeNowMock = vi.hoisted(() => vi.fn());

vi.mock("../api/providerQuota", () => ({
  providerQuotaApi: { waits: waitsMock, resumeNow: resumeNowMock },
}));

async function flushReact() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  }
  flushSync(() => {});
}

describe("ProviderQuotaResumeBanner", () => {
  let container: HTMLDivElement;
  let root: Root | null = null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    waitsMock.mockReset();
    resumeNowMock.mockReset();
  });

  afterEach(() => {
    flushSync(() => root?.unmount());
    root = null;
    container.remove();
  });

  async function render(companyId: string | null = "company-1") {
    root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
    flushSync(() => {
      root!.render(
        <QueryClientProvider client={queryClient}>
          <ProviderQuotaResumeBanner companyId={companyId} />
        </QueryClientProvider>,
      );
    });
    await flushReact();
  }

  function button() {
    return container.querySelector<HTMLButtonElement>('[data-testid="dashboard-provider-quota-resume-now"]');
  }

  it("renders nothing when no work waits for quota", async () => {
    waitsMock.mockResolvedValue({ count: 0, waits: [] });
    await render();
    expect(waitsMock).toHaveBeenCalledWith("company-1");
    expect(container.textContent).toBe("");
    expect(button()).toBeNull();
  });

  it("shows the waiting count and resumes the whole company on click, then reports the result", async () => {
    waitsMock.mockResolvedValueOnce({ count: 3, waits: [] }).mockResolvedValue({ count: 0, waits: [] });
    resumeNowMock.mockResolvedValue({
      results: [
        { issueId: "i1", agentId: "a1", phase: "scheduled_retry", outcome: "released", message: null },
        { issueId: "i2", agentId: "a1", phase: "quota_monitor", outcome: "released", message: null },
        { issueId: "i3", agentId: "a2", phase: "quota_monitor", outcome: "failed", message: "busy" },
      ],
    });
    await render();
    expect(container.textContent).toContain("3 items are waiting for model quota to come back");
    expect(button()?.textContent).toBe("Quota is back, continue now");

    flushSync(() => button()!.click());
    await flushReact();

    expect(resumeNowMock).toHaveBeenCalledTimes(1);
    expect(resumeNowMock).toHaveBeenCalledWith("company-1");
    expect(container.querySelector('[data-testid="dashboard-provider-quota-resume-result"]')?.textContent)
      .toBe("Released 2 items; 1 could not be released.");
    // the waits query is refreshed after the action
    expect(waitsMock).toHaveBeenCalledTimes(2);
  });

  it("shows the error inline instead of a browser dialog", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    waitsMock.mockResolvedValue({ count: 1, waits: [] });
    resumeNowMock.mockRejectedValue(new Error("forbidden"));
    await render();
    flushSync(() => button()!.click());
    await flushReact();
    expect(container.querySelector('[data-testid="dashboard-provider-quota-resume-error"]')?.textContent)
      .toBe("Could not continue: forbidden");
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("counts already-running items as released", () => {
    expect(summarizeProviderQuotaResume({
      results: [
        { issueId: "i1", agentId: null, phase: "scheduled_retry", outcome: "already_running", message: null },
        { issueId: "i2", agentId: null, phase: "stale_monitor", outcome: "stale_monitor_cleared", message: null },
      ],
    })).toEqual({ released: 1, failed: 0 });
  });
});
