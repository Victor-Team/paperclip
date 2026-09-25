import { describe, expect, it } from "vitest";
import {
  aiConnectionProblem,
  bindingProblem,
  matchesAiRequirement,
  personalAiDefault,
  type AiConnectionSummary,
  type AiConnectionRequirement,
  type AiConnectionBinding,
  type AiConnectionTranslator,
} from "./model";

const t: AiConnectionTranslator = (key, options = {}) => {
  const messages: Record<string, string> = {
    "aiconnectionmodel.general.connected": "Connected",
    "aiconnectionmodel.general.needsattention": "Needs attention",
    "aiconnectionmodel.general.expired": "Expired",
    "aiconnectionmodel.general.revoked": "Revoked",
    "aiconnectionmodel.general.noconnectionselected":
      "No connection selected. Connect an account to continue.",
    "aiconnectionmodel.general.choosecompatibleconnection":
      "Choose a connection compatible with this provider and sign-in method.",
    "aiconnectionmodel.general.connectionnolongeravailable":
      "This connection is no longer available for this agent. Choose another connection.",
    "aiconnectionmodel.general.choosecompanysharedconnection":
      "Choose a company-shared connection.",
    "aiconnectionmodel.general.credentialnotshared":
      "This credential is not shared with you. Choose a connection you can use.",
  };
  return key === "aiconnectionmodel.general.statusrequiresreconnection"
    ? `${options.status}. Reconnect this account to continue.`
    : messages[key] ?? key;
};

const requirement: AiConnectionRequirement = {
  companyId: "company",
  provider: "anthropic",
  method: "subscription",
};
const account: AiConnectionSummary = {
  ...requirement,
  method: "subscription",
  id: "connection",
  grantId: "grant",
  name: "Personal Claude",
  ownership: "personal",
  ownerUserId: "alice",
  status: "connected",
  isDefault: true,
};
const binding: AiConnectionBinding = {
  provider: "anthropic",
  method: "subscription",
  mode: "responsible_user",
};

describe("AI connection selection presentation", () => {
  it("scopes personal defaults to company, user and provider, independently of method", () => {
    for (const change of [
      { companyId: "other" },
      { provider: "openai" as const },
      { ownerUserId: "bob" },
      { ownership: "shared" as const },
    ]) {
      expect(
        personalAiDefault([{ ...account, ...change }], requirement, "alice"),
      ).toBeUndefined();
    }
    expect(personalAiDefault([account], requirement, "alice")).toBe(account);
    const apiDefault = { ...account, method: "api_key" as const };
    expect(personalAiDefault([apiDefault], requirement, "alice")).toBe(apiDefault);
    expect(
      bindingProblem(binding, requirement, [apiDefault], "alice", "agent", t),
    ).toBeNull();
  });
  it("retains a revoked default instead of falling back to a healthy account", () => {
    const revoked = { ...account, status: "revoked" as const };
    const alternate = { ...account, id: "alternate", isDefault: false };
    expect(personalAiDefault([alternate, revoked], requirement, "alice")).toBe(
      revoked,
    );
    expect(
      bindingProblem(
        binding,
        requirement,
        [alternate, revoked],
        "alice",
        "agent",
        t,
      ),
    ).toContain("Revoked");
  });
  it("does not select another user’s account", () => {
    expect(
      bindingProblem(binding, requirement, [account], "bob", "agent", t),
    ).toContain("No connection");
  });
  it("does not infer a default from the first compatible connection", () => {
    expect(
      personalAiDefault(
        [{ ...account, isDefault: false }],
        requirement,
        "alice",
      ),
    ).toBeUndefined();
  });
  it("rejects incompatible bindings without modifying the requirement", () => {
    const original = { ...requirement };
    expect(
      bindingProblem(
        { ...binding, provider: "openai" },
        requirement,
        [account],
        "alice",
        "agent",
        t,
      ),
    ).toContain("compatible");
    expect(requirement).toEqual(original);
    expect(
      matchesAiRequirement({ ...account, method: "api_key" }, requirement),
    ).toBe(false);
  });
  it("requires exact grant identity and human access for a legacy personal selection", () => {
    const delegated = {
      provider: "anthropic",
      method: "subscription",
      mode: "delegated",
      connectionId: account.id,
      grantId: account.grantId,
    } as const;
    expect(
      bindingProblem(delegated, requirement, [account], "bob", "agent", t),
    ).toContain("not shared with you");
    expect(
      bindingProblem(
        delegated,
        requirement,
        [account],
        "alice",
        "agent",
        t,
      ),
    ).toBeNull();
    expect(
      bindingProblem(
        { ...delegated, grantId: "different" },
        requirement,
        [account],
        "alice",
        "agent",
        t,
      ),
    ).toContain("no longer available");
  });
  it("does not mistake a personal account for shared", () => {
    expect(
      bindingProblem(
        {
          ...binding,
          method: "subscription",
          mode: "shared",
          connectionId: account.id,
          grantId: account.grantId,
        },
        requirement,
        [account],
        "alice",
        "agent",
        t,
      ),
    ).toContain("company-shared");
  });
  it("preserves server-projected eligibility denials", () => {
    expect(
      aiConnectionProblem({
        ...account,
        unavailableReason: "Not in the shared audience",
      }, t),
    ).toBe("Not in the shared audience");
  });
});
