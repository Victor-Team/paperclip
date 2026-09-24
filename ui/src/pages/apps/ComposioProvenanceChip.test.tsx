// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import { ConnectionProvenanceChip } from "./ComposioProvenanceChip";

vi.mock("@/lib/router", () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

describe("ConnectionProvenanceChip", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(async () => {
    await i18n.changeLanguage("en");
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
  });

  function render(connection: Parameters<typeof ConnectionProvenanceChip>[0]["connection"]) {
    flushSync(() => {
      root.render(<ConnectionProvenanceChip connection={connection} />);
    });
  }

  it("keeps Vercel Connect branding while localizing its fixed credentials label", async () => {
    await i18n.changeLanguage("zh-CN");

    render({ credentialSource: "vercel_connect", externalCredential: { connectorUid: "connector-42" } });

    expect(container.textContent).toContain("通过 Vercel Connect");
    expect(container.querySelector("span")?.getAttribute("title")).toBe(
      "凭据由 Vercel Connect 管理（connector-42）",
    );
  });

  it("localizes Composio provenance while preserving its dynamic toolkit and target", async () => {
    await i18n.changeLanguage("zh-CN");

    render({ config: { provider: "composio", toolkitSlug: "github", parentConnectionId: "parent-1" } });

    expect(container.textContent).toContain("通过 Composio");
    expect(container.querySelector("a")?.getAttribute("title")).toBe(
      "由 Composio 代理（github）— 打开 Composio 服务页",
    );
    expect(container.querySelector("a")?.getAttribute("href")).toContain("parent-1");
  });
});
