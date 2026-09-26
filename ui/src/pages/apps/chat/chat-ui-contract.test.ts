import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const english = JSON.parse(source("../../../i18n/locales/en.json")) as Record<string, unknown>;

function englishCopy(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]];
  if (!value || typeof value !== "object") return [];
  return Object.entries(value).flatMap(([key, child]) =>
    englishCopy(child, prefix ? `${prefix}.${key}` : key),
  );
}

// A source contract still checks that the component uses the translation key
// and that English keeps the promised copy after a literal is localized.
function expectCopy(componentSource: string, copy: string) {
  if (componentSource.includes(copy)) return;
  const normalize = (value: string) => value.replace(/\\n/g, " ").replace(/\s+/g, " ");
  const match = englishCopy(english).find(([key, value]) =>
    normalize(value).includes(normalize(copy)) && (
      componentSource.includes(`t("${key}"`) ||
      componentSource.includes(`t('${key}'`) ||
      componentSource.includes(`i18nKey="${key}"`)
    ),
  );
  expect(match, `No translated source key with English copy: ${copy}`).toBeDefined();
}

describe("chat connector UI contract", () => {
  it("describes the close command as a conversation control rather than a task status change", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expectCopy(setup, "Close the active chat conversation");
    expect(setup).not.toContain("Close the active Paperclip task");
  });

  it("retries the selected failed run from every Board entry point", () => {
    for (const file of [
      "AgentDetail.tsx",
      "AgentDetail.production.tsx",
      "Inbox.tsx",
      "LegacyInbox.tsx",
    ]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /agentsApi\.retryFailedRun\(\s*run\.agentId,\s*run\.id,\s*run\.companyId,?\s*\)/,
      );
      expect(page).not.toContain('reason: "retry_failed_run"');
      expect(page).toContain("newRun.runId");
      expect(page).toContain("newRun.issueId");
    }
    const issue = source("../../IssueDetail.tsx");
    expect(issue).toMatch(
      /agentsApi\.retryFailedRun\(\s*failedRun\.agentId,\s*failedRun\.runId,\s*companyId/,
    );
    expectCopy(issue, "Retry queued");
    for (const file of ["Inbox.tsx", "LegacyInbox.tsx"]) {
      const page = source(`../../${file}`);
      expect(page).toMatch(
        /const retryRunMutation = useMutation\(\{[\s\S]*?onError: \(error\) => \{\s*pushToast\(\{\s*title: "Run retry failed"/,
      );
    }
  });
  it("keeps the exact dual-purpose choice and immutable searchable agent selection", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    expectCopy(setup, "Chat with an agent");
    expectCopy(setup, "Use this connection as an agent tool");
    expectCopy(setup, "<AgentSelect");
    expect(setup).not.toContain("Change agent");
  });

  it("provides every settled detail tab and no detach control", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    for (const tab of ["settings", "access", "conversations", "activity"]) {
      expectCopy(detail, `"${tab}"`);
    }
    expect(detail).not.toContain('"overview"');
    expectCopy(detail, "Open");
    expect(detail).toContain("providerNames[provider]");
    expectCopy(detail, "Open task");
    expect(detail.toLowerCase()).not.toContain("detach");
  });

  it("shows independent Slack callback surfaces and public URL drift", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expectCopy(detail, "Slack callback health");
    expectCopy(detail, "Events API");
    expectCopy(detail, "Interactivity");
    expectCopy(detail, "Slash command");
    expectCopy(detail, "callbacksNeedUpdate");
    expectCopy(detail, "Slack callback URLs need an update");
    expectCopy(detail, "Not observed");
  });

  it("lists every supported provider in the agent channel empty state", () => {
    const panel = source("../../../components/chat/AgentChannelsPanel.tsx");
    expectCopy(panel,
      "Connect AgentMail, Slack, GitHub, Discord, Microsoft Teams, or Telegram from",
    );
  });

  it("keeps provider capabilities automatic and settings focused on plausible reach", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    expectCopy(detail, "Allow direct messages");
    expectCopy(detail, "Allow group chats");
    expectCopy(detail, "Their tasks run only with an isolated workspace");
    expectCopy(detail, "otherwise Paperclip safely refuses the request");
    expectCopy(setup, "Link the account you’re testing");
    expectCopy(setup, "Paperclip does not replay the refused request");
    expectCopy(setup, "Review identity access");
    expectCopy(setup, "instanceSettingsApi.getExperimental()");
    expectCopy(setup, "chatEndpointsApi.listPrincipals(endpointId)");
    expectCopy(setup, "queryKeys.chatEndpoints.detail(next.id)");
    expectCopy(setup, 'target="_blank" rel="noopener noreferrer"');
    expect(detail).not.toContain("Enable streaming");
    expect(detail).not.toContain("Delivery transport");
  });

  it("explains Discord's independent per-server direct-message restriction", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    expectCopy(detail, 'endpoint.provider === "discord"');
    expectCopy(detail,
      "People must also enable Direct Messages in their shared Discord server’s Privacy Settings.",
    );
  });

  it("offers only real connection lifecycle actions", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const settings = detail.slice(
      detail.indexOf("function Settings"),
      detail.indexOf("function SettingToggle"),
    );
    const activity = detail.slice(detail.indexOf("function Activity"));
    expectCopy(detail, '"pause" | "resume" | "remove"');
    expectCopy(detail, "Remove this connection?");
    expectCopy(detail, "purpose=chat&resume=${endpoint.id}");
    expectCopy(detail, '? "" : "&reconnect=1"');
    expectCopy(detail, "Finish setup");
    expectCopy(detail, "Continue setup");
    expectCopy(detail, 'endpoint.setup?.step !== "complete"');
    expectCopy(detail, "Reconnect");
    expect(detail).not.toContain("Change agent");
    for (const label of ["Pause", "Resume", "Reconnect", "Remove connection"]) {
      expectCopy(activity, label);
      expect(settings).not.toContain(label);
    }
  });

  it("states the provider boundary for reconnect and removal", () => {
    const detail = source("./ChatEndpointDetail.tsx");
    const setup = source("./ChatEndpointSetup.tsx");
    for (const reconnectCopy of [
      "does not reinstall the app or change its workspace or channel membership",
      "does not reinstall the App or change repository access",
      "does not add or remove the bot from the server",
      "does not upload or reinstall the Teams app",
      "automatically refreshes its Paperclip webhook and command menu",
    ]) {
      expectCopy(detail, reconnectCopy);
      expectCopy(setup, reconnectCopy);
    }
    for (const removalCopy of [
      "It does not uninstall the Slack app",
      "It does not uninstall the GitHub App",
      "It does not uninstall the bot",
      "It does not uninstall the Teams app",
      "queues durable removal of its Telegram webhook and command menu",
      "After Telegram confirms that cleanup, Paperclip retires the saved token",
      "BotFather bot and its chat memberships remain",
    ]) {
      expectCopy(detail, removalCopy);
    }
  });

  it("uses only executable provider credential flows", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    for (const credential of [
      "botToken",
      "appId",
      "applicationId",
      "guildId",
      "clientId",
      "tenantId",
      "clientSecret",
    ]) {
      expectCopy(setup, `\"${credential}\"`);
    }
    expectCopy(setup, "credentials.privateKey");
    expectCopy(setup, "credentials.signingSecret");
    expectCopy(setup, "Create Slack app");
    expectCopy(setup, "Create or connect a GitHub App");
    expectCopy(setup, "create a single-tenant app registration");
    expectCopy(setup, "Create a bot with BotFather");
    expectCopy(setup, "Create one dedicated Discord application");
    expectCopy(setup, "enable Message Content Intent");
    expectCopy(setup, "Create Public Threads");
    expectCopy(setup, "permissions=309237763136&scope=bot");
    expect(setup).not.toContain("applications.commands");
    expectCopy(setup, "Generate webhook secret");
    expectCopy(setup, "will not show it again");
    expectCopy(setup, 'params.get("reconnect") === "1"');
    expectCopy(setup,
      "Leave the token blank to reuse the saved credential",
    );
    expectCopy(setup,
      "Leave credentials blank to reuse the saved values",
    );
    expectCopy(setup,
      "immediately invalidates GitHub webhook signatures",
    );
    expectCopy(setup, "generatingSetupSecret ||\n            pending");
    expect(setup).not.toContain("/setprivacy");
    expectCopy(setup, "/task@bot_username");
    expectCopy(setup, "registers its command menu automatically");
    expectCopy(setup,
      "ordinary\n          mentions are not delivered to bots",
    );
    expectCopy(setup, "Create Azure Bot");
    expectCopy(setup, "Microsoft 365 work or school organization");
    expectCopy(setup, "teams.live.com");
    expectCopy(setup, "commercial cloud tenants only");
    expectCopy(setup, "GCC High");
    expectCopy(setup, "operated by 21Vianet");
    expectCopy(setup, "Client secret value");
    expectCopy(setup, "Microsoft portal field map");
    expectCopy(setup,
      "Accounts in this organizational directory only (Single tenant)",
    );
    expectCopy(setup, "Use existing app registration");
    expectCopy(setup, "Settings · Configuration");
    expectCopy(setup, "Configure · App features · Bot");
    expectCopy(setup, "Configure · Permissions");
    expectCopy(setup, "Upload an app · Upload a custom app");
    expectCopy(setup, "Copy manifest settings");
    expectCopy(setup, "disabled={!credentials.clientId?.trim()}");
    expectCopy(setup,
      "Enter the Application / Client ID above before copying",
    );
    expectCopy(setup, "not a complete app package");
    expectCopy(setup, 'scopes: ["personal", "team", "groupChat"]');
    expectCopy(setup, 'scopes: ["personal", "groupChat"]');
    expectCopy(setup, 'title: "/status"');
    expectCopy(setup, 'title: "/new"');
    expectCopy(setup, 'title: "/close"');
    expect(setup).not.toContain("supportsTargetedMessages");
    expectCopy(setup, "resourceSpecific");
    expectCopy(setup, "ChannelMessage.Read.Group");
    expectCopy(setup, "ChatMessage.Read.Chat");
    expectCopy(setup, "not Microsoft Graph permissions in Entra");
    expectCopy(setup, "does not use Teams single sign-on");
    expectCopy(setup, "webApplicationInfo");
    expectCopy(setup, 'resource: "https://paperclip.ing"');
    expectCopy(setup, "only associates the RSC");
    expectCopy(setup, "you do not need to register an Entra");
    expectCopy(setup, "receive every message");
    expectCopy(setup, "One team install covers its standard");
    expectCopy(setup, "Private and shared channels require");
    expect(setup).not.toContain(
      "does not require a <code>webApplicationInfo</code>",
    );
    expect(setup).not.toContain("api://paperclip-chat/");
    expectCopy(setup, "not private channels");
    expectCopy(setup, "native file receipt and consent-based sending");
    expectCopy(setup, "issue_comment");
    expectCopy(setup, "pull_request");
    expectCopy(setup, "pull_request_review_comment");
    expectCopy(setup, "Enable SSL verification");
    expectCopy(setup, "Only on this account");
    expectCopy(setup, 'type="password"');
    expect(setup).not.toContain("WebkitTextSecurity");
    expectCopy(setup, "Verify Slack connection");
    expectCopy(setup, "member_joined_channel");
    expectCopy(setup, "member_left_channel");
    expectCopy(setup, "channel_left");
    expectCopy(setup, "group_left");
    expectCopy(setup, "group_archive");
    expectCopy(setup, "group_unarchive");
    expectCopy(setup, "group_rename");
    expectCopy(setup, "app_uninstalled");
    expectCopy(setup, "slackBotNameForAgent");
    expect(setup).not.toContain("- im:write");
    expectCopy(setup, "- reactions:write");
    expect(setup).not.toContain("always_online");
    expectCopy(setup, "- reactions:read");
    expectCopy(setup, "- assistant:write");
    expectCopy(setup, "agent_view:");
    expectCopy(setup, "agent_session_stopped");
    expect(setup).not.toContain("assistant_view:");
    expectCopy(setup, "reaction_added");
    expectCopy(setup, "reaction_removed");
    expectCopy(setup, "home_tab_enabled: false");
    expectCopy(setup, "messages_tab_enabled: true");
    expectCopy(setup, "messages_tab_read_only_enabled: false");
    expect(setup).not.toContain("No credentials");
    expect(setup).not.toContain("managed Microsoft app");
    expectCopy(setup, "endpoint.providerAccountId && !repairing");
    expect(setup).not.toContain('field("webhookSecret"');
    expect(setup).not.toContain("@paperclipai/teams-connect");
    expect(setup).not.toContain("Copy setup command");
    expect(setup).not.toContain("Add {agentName} to Slack");
    expect(setup).not.toContain("Create in GitHub");
  });

  it("keeps provider setup failures visible without rendering submitted credentials", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    const setupError = source("./chat-setup-error.ts");
    expectCopy(setup, "sanitizedSetupErrorMessage");
    expectCopy(setup, 'role="alert"');
    expect(setupError).toContain('message.replaceAll(candidate, "[redacted]")');
    expect(setupError).toContain("return encodeURIComponent(value)");
    expectCopy(setup, "onMutate: () => setSetupError(null)");
    expect(setup).not.toContain('title: "Connection failed"');
  });

  it("keeps GitHub setup on the shipped customer-owned App path", () => {
    const setup = source("./ChatEndpointSetup.tsx");
    const generator = source(
      "../../../../../doc/plans/chat-adapters/generate-wireframes-v8.mjs",
    );
    const setupData = source(
      "../../../../../doc/plans/chat-adapters/setup-wireframe-data-v8.mjs",
    );
    expectCopy(setup, "Generate webhook secret");
    expectCopy(setup, "GitHub App ID");
    expectCopy(setup, "Private key (PEM)");
    expectCopy(setup, "Choose .pem file");
    expectCopy(setup, "Choose GitHub App private key file");
    expectCopy(setup, "readGitHubPrivateKeyFile");
    expectCopy(setup, "privateKeyReadGuard.invalidate()");
    expectCopy(setup, "privateKeyFileLoading ||");
    expectCopy(setup, "Show private key");
    expectCopy(setup, 'type="password"');
    expectCopy(setup, 'event.clipboardData.getData("text")');
    expect(setup).not.toContain("WebkitTextSecurity");
    expect(generator).toContain("./setup-wireframe-data-v8.mjs");
    expect(generator).not.toContain("./setup-wireframe-data-v6.mjs");
    expect(setupData).not.toContain('primary: "Create in GitHub"');
  });
});
