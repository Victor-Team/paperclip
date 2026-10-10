// @vitest-environment jsdom

import { flushSync } from "react-dom";
import { createRoot, type Root } from "react-dom/client";
import type { AnchorHTMLAttributes } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApprovalDetail } from "./ApprovalDetail";

const companyState = vi.hoisted(() => ({ selectedCompanyId: "company-1", setSelectedCompanyId: vi.fn() }));
const mockApprovalsApi = vi.hoisted(() => ({
  get: vi.fn(),
  listComments: vi.fn(),
  listIssues: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  requestRevision: vi.fn(),
  resubmit: vi.fn(),
  addComment: vi.fn(),
}));
const mockAgentsApi = vi.hoisted(() => ({ list: vi.fn(), remove: vi.fn() }));

vi.mock("@/context/CompanyContext", () => ({ useCompany: () => companyState }));
vi.mock("@/context/BreadcrumbContext", () => ({ useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }) }));
vi.mock("@/api/approvals", () => ({ approvalsApi: mockApprovalsApi }));
vi.mock("@/api/agents", () => ({ agentsApi: mockAgentsApi }));
vi.mock("@/components/MarkdownBody", () => ({
  MarkdownBody: ({ children }: { children: string }) => <div data-testid="md">{children}</div>,
}));
vi.mock("@/components/AgentIdentity", () => ({
  AgentIdentity: ({ agent }: { agent: { name: string } }) => <span>{agent.name}</span>,
}));
vi.mock("@/components/ApprovalPayload", () => ({
  approvalLabel: () => "Board approval",
  typeIcon: {},
  defaultTypeIcon: () => null,
  ApprovalPayloadRenderer: () => null,
}));
vi.mock("@/lib/router", () => ({
  useParams: () => ({ approvalId: "approval-9" }),
  useNavigate: () => vi.fn(),
  useSearchParams: () => [new URLSearchParams()],
  Link: ({ children, to, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>{children}</a>
  ),
}));

async function flush() {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
    await new Promise((r) => setTimeout(r, 0));
  }
  flushSync(() => {});
}

async function waitForAssertion(assertion: () => void, attempts = 20) {
  let lastError: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      assertion();
      return;
    } catch (e) {
      lastError = e;
      await flush();
    }
  }
  throw lastError;
}

function card(status: string) {
  return {
    id: "approval-9",
    companyId: "company-1",
    type: "request_board_approval",
    status,
    payload: { title: "Ruling" },
    requestedByAgentId: "agent-9",
    requestedByUserId: null,
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: "2026-10-10T14:02:35.392Z",
    updatedAt: "2026-10-10T14:02:35.392Z",
  };
}

describe("ApprovalDetail decision note (#69)", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    mockApprovalsApi.listComments.mockResolvedValue([]);
    mockApprovalsApi.listIssues.mockResolvedValue([]);
    mockAgentsApi.list.mockResolvedValue([{ id: "agent-9", name: "Producer" }]);
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    flushSync(() => root.unmount());
    container.remove();
  });

  function render() {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    flushSync(() => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <ApprovalDetail />
        </QueryClientProvider>,
      );
    });
  }

  it("sends the board's note with a revision request and refuses an empty one", async () => {
    mockApprovalsApi.get.mockResolvedValue(card("pending"));
    mockApprovalsApi.requestRevision.mockResolvedValue(card("revision_requested"));
    render();

    const button = await (async () => {
      let found: HTMLButtonElement | null = null;
      await waitForAssertion(() => {
        found = container.querySelector<HTMLButtonElement>('[data-testid="approval-request-revision"]');
        expect(found).not.toBeNull();
      });
      return found as unknown as HTMLButtonElement;
    })();
    expect(button.disabled).toBe(true);

    const note = container.querySelector<HTMLTextAreaElement>('[data-testid="approval-decision-note"]');
    expect(note).not.toBeNull();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!;
    flushSync(() => {
      setter.call(note, "Put the plan link on the card");
      note!.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await waitForAssertion(() => expect(button.disabled).toBe(false));

    flushSync(() => button.click());
    await waitForAssertion(() =>
      expect(mockApprovalsApi.requestRevision).toHaveBeenCalledWith("approval-9", "Put the plan link on the card"),
    );
  });

  it("does not offer 'mark resubmitted' to the board on an agent's card", async () => {
    mockApprovalsApi.get.mockResolvedValue(card("revision_requested"));
    render();

    await waitForAssertion(() =>
      expect(container.querySelector('[data-testid="approval-revision-waiting"]')).not.toBeNull(),
    );
    expect(mockApprovalsApi.resubmit).not.toHaveBeenCalled();
    const labels = Array.from(container.querySelectorAll("button")).map((b) => b.textContent ?? "");
    expect(labels.some((label) => /resubmitted/i.test(label))).toBe(false);
  });
});
