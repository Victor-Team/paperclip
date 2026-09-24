/** Redacted presentation contracts shared with the production API. */
import type { AiProvider, AiAuthMethod, AiManagedConnectionSummary, AiConnectionBinding } from "@paperclipai/shared";
export type { AiProvider, AiAuthMethod, AiConnectionBinding } from "@paperclipai/shared";
export type AiConnectionStatus = AiManagedConnectionSummary["status"];
export type AiConnectionTranslator = (
  key: string,
  options?: Record<string, unknown>,
) => string;

export const AI_PROVIDERS: Record<
  AiProvider,
  { name: string; subscriptionName?: string; logo?: string }
> = {
  anthropic: {
    name: "Claude",
    subscriptionName: "Claude subscription",
    logo: "/brands/claude-color.svg",
  },
  openai: {
    name: "OpenAI",
    subscriptionName: "ChatGPT subscription",
    logo: "/brands/codex-color.svg",
  },
  openrouter: { name: "OpenRouter", logo: "/brands/apps/openrouter.svg" },
  xai: {
    name: "Grok",
    subscriptionName: "Grok subscription",
    logo: "/brands/adapters/grok.svg",
  },
};

export type AiConnectionSummary = Omit<AiManagedConnectionSummary, "isDefault"> & { isDefault?: boolean };

export interface AiConnectionRequirement {
  companyId: string;
  provider: AiProvider;
  method?: AiAuthMethod;
}

export const AI_CONNECTION_STATUS: Record<AiConnectionStatus, string> = {
  connected: "aiconnectionmodel.general.connected",
  needs_attention: "aiconnectionmodel.general.needsattention",
  expired: "aiconnectionmodel.general.expired",
  revoked: "aiconnectionmodel.general.revoked",
};

export function aiMethodLabel(
  provider: AiProvider,
  method: AiAuthMethod,
  t: AiConnectionTranslator,
) {
  if (method !== "subscription") return t("aiconnectionmodel.general.apikey");
  return t(
    provider === "anthropic"
      ? "aiconnectionmodel.general.claudesubscription"
      : provider === "openai"
        ? "aiconnectionmodel.general.chatgptsubscription"
        : provider === "xai"
          ? "aiconnectionmodel.general.groksubscription"
          : "aiconnectionmodel.general.subscriptionunavailable",
  );
}

export function matchesAiRequirement(
  connection: AiConnectionSummary,
  requirement: AiConnectionRequirement,
) {
  return (
    connection.companyId === requirement.companyId &&
    connection.provider === requirement.provider &&
    (requirement.method === undefined || connection.method === requirement.method)
  );
}

export function personalAiDefault(
  connections: AiConnectionSummary[],
  requirement: AiConnectionRequirement,
  userId: string,
) {
  // Never choose another account because the declared default is unhealthy.
  return connections.find(
    (connection) =>
      matchesAiRequirement(connection, { ...requirement, method: undefined }) &&
      connection.ownership === "personal" &&
      connection.ownerUserId === userId &&
      connection.isDefault,
  );
}

export function aiConnectionProblem(
  connection: AiConnectionSummary | undefined,
  t: AiConnectionTranslator,
) {
  if (!connection)
    return t("aiconnectionmodel.general.noconnectionselected");
  return (
    connection.unavailableReason ??
    (connection.status === "connected"
      ? null
      : t("aiconnectionmodel.general.statusrequiresreconnection", {
          status: t(AI_CONNECTION_STATUS[connection.status]),
        }))
  );
}

export function bindingProblem(
  binding: AiConnectionBinding,
  requirement: AiConnectionRequirement,
  connections: AiConnectionSummary[],
  userId: string,
  _agentId: string,
  t: AiConnectionTranslator,
) {
  if (
    binding.provider !== requirement.provider ||
    (binding.mode !== "responsible_user" && requirement.method !== undefined && binding.method !== requirement.method)
  )
    return t("aiconnectionmodel.general.choosecompatibleconnection");
  if (binding.mode === "responsible_user")
    return aiConnectionProblem(
      personalAiDefault(connections, requirement, userId),
      t,
    );
  const connection = connections.find(
    (item) =>
      item.id === binding.connectionId &&
      item.grantId === binding.grantId &&
      item.method === binding.method &&
      matchesAiRequirement(item, requirement),
  );
  if (!connection)
    return t("aiconnectionmodel.general.connectionnolongeravailable");
  if (binding.mode === "shared" && connection.ownership !== "shared")
    return t("aiconnectionmodel.general.choosecompanysharedconnection");
  if (
    binding.mode === "delegated" &&
    (connection.ownership !== "personal" ||
      connection.ownerUserId !== userId)
  )
    return t("aiconnectionmodel.general.credentialnotshared");
  return aiConnectionProblem(connection, t);
}
