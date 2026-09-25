import { describe, expect, it } from "vitest";
import { classifyAdapterFailureForRecovery } from "./service.js";

// Verbatim provider quota errors captured from real runs (request ids trimmed).
// Each must land on the provider-quota wait, not a generic adapter failure.
const now = new Date("2026-09-14T15:00:00Z");

const cases = [
  {
    name: "5-hour usage quota with an absolute +0800 reset",
    error:
      "429 You have exceeded the 5-hour usage quota. It will reset at 2026-09-15 01:13:06 +0800 CST. We recommend upgrading your plan for more quota, or waiting for the reset. (type=TooManyRequests param=AccountQuotaExceeded)",
    retryAt: "2026-09-14T17:13:06.000Z",
  },
  {
    name: "weekly usage quota with an absolute +0800 reset",
    error:
      "429 You have exceeded the weekly usage quota. It will reset at 2026-09-21 00:00:00 +0800 CST. We recommend upgrading your plan for more quota, or waiting for the reset. (type=TooManyRequests param=AccountQuotaExceeded)",
    retryAt: "2026-09-20T16:00:00.000Z",
  },
  {
    name: "Cloud Code Assist RESOURCE_EXHAUSTED without a reset time",
    error:
      'Cloud Code Assist API error (429): {\n  "error": {\n    "code": 429,\n    "message": "Resource has been exhausted (e.g. check quota).",\n    "status": "RESOURCE_EXHAUSTED"\n  }\n}',
    retryAt: null,
  },
  {
    name: "Cloud Code Assist individual quota with a reset timestamp",
    error:
      'Cloud Code Assist API error (429): {\n  "error": {\n    "code": 429,\n    "message": "Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 48m54s.",\n    "status": "RESOURCE_EXHAUSTED",\n    "details": [{ "reason": "QUOTA_EXHAUSTED", "metadata": { "quotaResetDelay": "48m54.596491238s", "quotaResetTimeStamp": "2026-09-14T15:48:54Z" } }]\n  }\n}',
    retryAt: "2026-09-14T15:48:54.000Z",
  },
  {
    name: "individual quota with only a relative reset",
    error: "Individual quota reached. Please upgrade your subscription to increase your limits. Resets in 48m54s.",
    retryAt: "2026-09-14T15:48:54.000Z",
  },
];

describe("real provider quota messages", () => {
  for (const c of cases) {
    it(`waits for quota on: ${c.name}`, () => {
      const result = classifyAdapterFailureForRecovery({ error: c.error, errorCode: "adapter_failed", resultJson: null }, now);
      expect(result?.kind).toBe("provider_quota");
      if (c.retryAt && result?.kind === "provider_quota") {
        expect(result.parsedResetTime).toBe(true);
        expect(result.retryAt.toISOString()).toBe(c.retryAt);
      }
    });
  }
});
