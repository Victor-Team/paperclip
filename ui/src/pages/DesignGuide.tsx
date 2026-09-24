import { MediaArtifactCard } from "@/components/artifacts/MediaArtifactCard";
import { WebhookUrlWarning } from "@/components/routine-triggers/WebhookUrlWarning";
import { SetupWizardNavigation, SetupWizardFooter } from "../components/SetupWizard";
import { RemoteMcpDesignExample } from "@/features/connections/remote-mcp/RemoteMcpDesignExample";
import { AgentChatPicker } from "@/components/AgentChatPicker";
import { TaskChatProjectCreatedCard } from "@/components/task-chat/TaskChatProjectCreatedCard";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { announcementPreview, announcementAnimationPreview, announcementAnimationPreviewSrc } from "@/lib/announcement-preview";
import { TaskDetailTasksPanel } from "@/components/task-detail/TaskDetailTasksPanel";
import { AiConnectionDesignExamples } from "@/components/ai-connections/AiConnectionDesignExamples";
import { SavedProviderKeySelect } from "../components/onboarding/SavedProviderKeySelect";
import { AgentAvatar } from "@/components/AgentAvatar";
import { AgentCharacter } from "@/components/AgentCharacter";
import { AGENT_PALETTE_IDS, appearanceForPalette } from "@paperclipai/shared";
import { RepositoryEditor } from "@/components/RepositoryEditor";
import { TaskChatRunnerActivityGroup } from "@/components/task-chat/TaskChatRunnerActivityGroup";
import { TaskChatMarker } from "@/components/task-chat/TaskChatMarker";
import { TaskChatComposer } from "@/components/task-chat/TaskChatComposer";
import { TaskTreeControlDialog, TaskTreeControlMenuItems } from "@/components/TaskTreeControls";
import { useState } from "react";
import {
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Command as CommandIcon,
  DollarSign,
  Hexagon,
  History,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Mail,
  Plus,
  Search,
  Settings,
  Target,
  Trash2,
  Upload,
  User,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Badge } from "@/components/ui/badge";
import { InlineBanner } from "@/components/InlineBanner";
import { BuiltInLifecycleChip } from "@/components/BuiltInAgentBadges";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable-panels";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuCheckboxItem,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Command,
  CommandInput,
  CommandList,
  CommandGroup,
  CommandItem,
  CommandEmpty,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
} from "@/components/ui/avatar";
import { AgentCapsule, AGENT_GRADIENT_COUNT } from "@/components/AgentCapsule";
import { AgentRunCard } from "@/components/ActiveAgentsPanel";
import { StatusBadge, IssueStatusBadge } from "@/components/StatusBadge";
import { StatusIcon } from "@/components/StatusIcon";
import { EnforcementBanner } from "@/components/EnforcementBanner";
import { ActionCard, ActionCardMobile, BindingsTable } from "@/components/actions/ActionCard";
import { PriorityIcon } from "@/components/PriorityIcon";
import { SHOW_TASK_PRIORITY_UI } from "@/lib/ui-flags";
import { agentStatusDot, agentStatusDotDefault } from "@/lib/status-colors";
import { EntityRow } from "@/components/EntityRow";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { FilterBar, type FilterValue } from "@/components/FilterBar";
import { InlineEditor } from "@/components/InlineEditor";
import { PageSkeleton } from "@/components/PageSkeleton";
import { Identity } from "@/components/Identity";
import { AppLogo } from "@/pages/apps/AppLogo";
import { IssueReferencePill } from "@/components/IssueReferencePill";
import { MembershipAction } from "@/components/MembershipAction";
import { IssueOutputSection } from "@/components/issue-output/IssueOutputSection";
import { EnvironmentVariablesEditor } from "@/components/environment-variables-editor";
import { IssueThreadInteractionCard } from "@/components/IssueThreadInteractionCard";
import {
  connectedConnectionIntentInteraction,
  issueThreadInteractionFixtureMeta,
  pendingConnectionIntentInteraction,
  retryConnectionIntentInteraction,
} from "@/fixtures/issueThreadInteractionFixtures";
import type { CompanySecret, EnvBinding, Issue } from "@paperclipai/shared";
import { CollectionToolbar } from "@/components/CollectionToolbar";
import { IssueRow } from "@/components/IssueRow";
import {
  EnvInputsList,
  ExternalSourcesList,
  RequiredSkillsList,
  StepSkillPlan,
  StepSourcePolicy,
  TeamCard,
  TeamHierarchyPreview,
  TeamRow,
} from "@/pages/TeamCatalog";
import {
  currentInstalledState,
  onboardingTeams,
  optionalTeam,
  outOfDateInstalledState,
  sampleSkillPreparations,
  sampleTeam,
  warnTeam,
} from "@/pages/TeamCatalog.fixtures";
import type { IssueWorkProduct } from "@paperclipai/shared";
import { useTranslation } from "@/i18n";

/* ------------------------------------------------------------------ */
/*  Sample data for the Issue Output surface showcase                  */
/* ------------------------------------------------------------------ */

function sampleOutput(
  id: string,
  attachmentId: string,
  contentType: string,
  filename: string,
  opts: { byteSize: number; isPrimary?: boolean; createdAt: string },
): IssueWorkProduct {
  const contentPath = `/api/attachments/${attachmentId}/content`;
  return {
    id,
    companyId: "demo-company",
    projectId: null,
    issueId: "demo-issue",
    executionWorkspaceId: null,
    runtimeServiceId: null,
    type: "artifact",
    provider: "paperclip",
    externalId: null,
    title: filename,
    url: null,
    status: "active",
    reviewState: "none",
    isPrimary: Boolean(opts.isPrimary),
    healthStatus: "unknown",
    summary: null,
    createdByRunId: null,
    createdAt: new Date(opts.createdAt),
    updatedAt: new Date(opts.createdAt),
    metadata: {
      attachmentId,
      contentType,
      byteSize: opts.byteSize,
      contentPath,
      openPath: contentPath,
      downloadPath: `${contentPath}?download=1`,
      originalFilename: filename,
    },
  } as IssueWorkProduct;
}

const DESIGN_GUIDE_OUTPUTS: IssueWorkProduct[] = [
  sampleOutput("wp-vid", "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", "video/mp4", "q3-summary.mp4", {
    byteSize: 19_293_798,
    isPrimary: true,
    createdAt: "2026-05-30T12:00:00Z",
  }),
  sampleOutput("wp-pdf", "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", "application/pdf", "talking-points.pdf", {
    byteSize: 421_888,
    createdAt: "2026-05-30T11:52:00Z",
  }),
];

const DESIGN_GUIDE_DEGRADED_OUTPUTS: IssueWorkProduct[] = [
  {
    ...sampleOutput("wp-broken", "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "video/mp4", "corrupt-output.mp4", {
      byteSize: 0,
      isPrimary: true,
      createdAt: "2026-05-30T12:01:00Z",
    }),
    // Strip the path metadata so it fails the shared artifact schema.
    metadata: { attachmentId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", contentType: "video/mp4" },
  } as IssueWorkProduct,
];

const DESIGN_GUIDE_TASK = {
  id: "design-guide-task",
  identifier: "PAP-427",
  title: "Reconcile the navigation model across operator surfaces",
  status: "in_progress",
  priority: "medium",
  blockerAttention: false,
} as unknown as Issue;

/* ------------------------------------------------------------------ */
/*  Section wrapper                                                    */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        {title}
      </h3>
      <Separator />
      {children}
    </section>
  );
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium">{title}</h4>
      {children}
    </div>
  );
}

// Onboarding seam (design §6 + §12.5): the TeamCard tile in its "Pick a starter
// team" 3-col grid, with the first defaultInstall tile selected.
function TeamCardShowcase() {
  const [selectedId, setSelectedId] = useState(onboardingTeams[0]?.id ?? null);
  return (
    <div className="grid max-w-2xl gap-4 md:grid-cols-2 lg:grid-cols-3">
      {onboardingTeams.map((team) => (
        <TeamCard
          key={team.id}
          team={team}
          selected={team.id === selectedId}
          onSelect={() => setSelectedId(team.id)}
        />
      ))}
    </div>
  );
}

// Reusable environment-variables editor: one shared grid, in-field source
// switch, fuzzy secret picker, sensitive-value detection, inline health.
const DESIGN_GUIDE_SECRETS: CompanySecret[] = [
  {
    id: "dg-github",
    companyId: "dg",
    scope: "company",
    ownerUserId: null,
    userSecretDefinitionId: null,
    key: "github_token",
    name: "GITHUB_TOKEN",
    provider: "local_encrypted",
    status: "active",
    managedMode: "paperclip_managed",
    externalRef: null,
    providerConfigId: null,
    providerMetadata: null,
    latestVersion: 3,
    description: null,
    lastResolvedAt: null,
    lastRotatedAt: null,
    deletedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-01T10:00:00.000Z"),
  },
  {
    id: "dg-db",
    companyId: "dg",
    scope: "company",
    ownerUserId: null,
    userSecretDefinitionId: null,
    key: "db_connection",
    name: "DB_CONNECTION",
    provider: "local_encrypted",
    status: "active",
    managedMode: "paperclip_managed",
    externalRef: null,
    providerConfigId: null,
    providerMetadata: null,
    latestVersion: 3,
    description: null,
    lastResolvedAt: null,
    lastRotatedAt: null,
    deletedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-01T10:00:00.000Z"),
  },
];

function EnvironmentVariablesEditorShowcase() {
  const [env, setEnv] = useState<Record<string, EnvBinding>>({
    NODE_ENV: { type: "plain", value: "production" },
    GH_TOKEN: { type: "secret_ref", secretId: "dg-github", version: "latest" },
    DB_URL: { type: "secret_ref", secretId: "dg-db", version: 3 },
    STRIPE_API_KEY: { type: "plain", value: "sk-live-51H8xL0aBcDeFgHiJkLmNoPq" },
  });
  return (
    <div className="max-w-(--sz-640px) rounded-md border border-border p-4">
      <EnvironmentVariablesEditor
        value={env}
        secrets={DESIGN_GUIDE_SECRETS}
        onChange={(next) => setEnv(next ?? {})}
        onCreateSecret={async (name) => ({
          ...DESIGN_GUIDE_SECRETS[0]!,
          id: `dg-${name}`,
          key: name,
          name: name.toUpperCase(),
          latestVersion: 1,
        })}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Color swatch                                                       */
/* ------------------------------------------------------------------ */

function Swatch({ name, cssVar }: { name: string; cssVar: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-8 w-8 rounded-md border border-border shrink-0"
        style={{ backgroundColor: `var(${cssVar})` }}
      />
      <div>
        <p className="text-xs font-mono">{cssVar}</p>
        <p className="text-xs text-muted-foreground">{name}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

function TaskExecutionControlsExample() {
  const { t } = useTranslation();
  const [running, setRunning] = useState(true);
  const [dialogMode, setDialogMode] = useState<"resume" | "cancel" | "restore" | null>(null);
  const [wake, setWake] = useState(true);
  return <div className="max-w-xl space-y-4">
    <div className="w-52 rounded-md border border-border p-1">
      <TaskTreeControlMenuItems scope="subtree" canPause={running} canResume={!running} canCancel canRestore={!running}
        onPause={() => setRunning(false)} onResume={() => setDialogMode("resume")}
        onCancel={() => setDialogMode("cancel")} onRestore={() => setDialogMode("restore")} />
    </div>
    <p className="text-sm text-muted-foreground">{running ? t("designguide.general.runningtypetoswitchstoptosend") : t("designguide.general.pausedresumefromthemenu")}</p>
    <TaskChatProjectCreatedCard item={{ id: "design-project", kind: "project_created", projectId: "example-project", name: "Onboarding improvements", description: "Help new teams reach their first useful result.", timestamp: "2026-09-11T00:00:00Z", repositories: [{ id: "1", name: "paperclipai/paperclip", url: "https://github.com/paperclipai/paperclip" }] }} />
    {!running ? <TaskChatMarker item={{ id: "design-cancelled", kind: "marker", variant: "interrupted", tone: "neutral", label: "Run cancelled", detail: "The run was cancelled before returning an answer.", collapsible: true }} /> : null}
    <TaskChatComposer pause={!running ? { scope: "subtree", onResume: () => setDialogMode("resume") } : null} onAdd={async () => {}} workMode="standard" stopScope="subtree" onStop={running ? async () => setRunning(false) : undefined} />
    <TaskTreeControlDialog open={dialogMode !== null} onOpenChange={(open) => { if (!open) setDialogMode(null); }}
      mode={dialogMode ?? "cancel"} scope="subtree" affectedCount={3} affectedAgentCount={2} loading={false} pending={false} valid
      wakeAgents={wake} onWakeAgentsChange={setWake} onRetry={() => {}}
      onApply={() => { setRunning(dialogMode !== "cancel" && wake); setDialogMode(null); }} />
  </div>;
}

function AgentChatPickerExample() {
  const { t } = useTranslation();
  const [state, setState] = useState<"closed" | "empty" | "loading" | "error">("closed");
  return <div className="flex flex-wrap gap-2">
    <Button variant="outline" onClick={() => setState("empty")}>{t("designguide.general.emptypicker")}</Button>
    <Button variant="outline" onClick={() => setState("loading")}>{t("designguide.general.loadingpicker")}</Button>
    <Button variant="outline" onClick={() => setState("error")}>{t("designguide.general.failedpicker")}</Button>
    <AgentChatPicker agents={[]} open={state !== "closed"} onOpenChange={(open) => { if (!open) setState("closed"); }} onSelect={() => {}}
      loading={state === "loading"} error={state === "error" ? new Error("Unavailable") : null} onRetry={() => setState("empty")} />
  </div>;
}

export function DesignGuide() {
  const { t } = useTranslation();
  const [wizardStep, setWizardStep] = useState(0);
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [selectValue, setSelectValue] = useState("in_progress");
  const [menuChecked, setMenuChecked] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [inlineText, setInlineText] = useState("Click to edit this text");
  const [inlineTitle, setInlineTitle] = useState("Editable Title");
  const [inlineDesc, setInlineDesc] = useState(
    "This is an editable description. Click to edit it — the textarea auto-sizes to fit the content without layout shift."
  );
  const [filters, setFilters] = useState<FilterValue[]>([
    { key: "status", label: "Status", value: "Active" },
    // PAP-411: priority filter demo row suppressed while SHOW_TASK_PRIORITY_UI is off.
    ...(SHOW_TASK_PRIORITY_UI
      ? [{ key: "priority", label: "Priority", value: "High" } as FilterValue]
      : []),
  ]);
  const [allowExternal, setAllowExternal] = useState(false);
  const [allowUnpinned, setAllowUnpinned] = useState(false);
  const [allowLocalPath, setAllowLocalPath] = useState(false);

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold">{t("designguide.general.designguide")}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t("designguide.general.everycomponentstyleandpatternusedacross")}</p>
      </div>

      {/* ============================================================ */}
      {/*  COVERAGE                                                     */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.componentcoverage")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.thispageshouldbeupdatedwhennew")}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designguide.general.uiprimitives")}>
            <div className="flex flex-wrap gap-2">
              {[
                "avatar", "badge", "breadcrumb", "button", "card", "checkbox", "collapsible",
                "command", "dialog", "dropdown-menu", "input", "label", "popover", "resizable-panels",
                "scroll-area", "select", "separator", "sheet", "skeleton", "tabs", "textarea", "tooltip",
              ].map((name) => (
                <Badge key={name} variant="outline" className="font-mono text-(length:--text-nano)">
                  {name}
                </Badge>
              ))}
            </div>
          </SubSection>
          <SubSection title={t("designguide.general.appcomponents")}>
            <div className="flex flex-wrap gap-2">
              {[
                "StatusBadge", "StatusIcon", "PriorityIcon", "EntityRow", "EmptyState", "MetricCard",
                "FilterBar", "InlineEditor", "PageSkeleton", "Identity", "CommentThread", "MarkdownEditor",
                "PropertiesPanel", "Sidebar", "CommandPalette", "EnvironmentVariablesEditor",
                "InlineBanner", "BuiltInAgentGate", "BuiltInLifecycleChip", "CollectionToolbar",
                "IssueRow", "ContextualSidebarFrame",
              ].map((name) => (
                <Badge key={name} variant="ghost" className="font-mono text-(length:--text-nano)">
                  {name}
                </Badge>
              ))}
            </div>
          </SubSection>
        </div>
      </Section>

      <Section title={t("designguide.general.announcements")}>
        <div className="grid gap-4 md:grid-cols-2">
          <AnnouncementCard announcement={announcementAnimationPreview} imageSrc="/announcement-preview.svg" animationSrc={announcementAnimationPreviewSrc} onDismiss={() => {}} />
          <AnnouncementCard announcement={announcementPreview} imageSrc="/announcement-preview.svg" onDismiss={() => {}} />
          <AnnouncementCard announcement={{ ...announcementPreview, image: undefined, secondaryLink: undefined }} onDismiss={() => {}} />
        </div>
      </Section>

      <Section title={t("designguide.general.taskexecutioncontrols")}>
        <TaskExecutionControlsExample />
      </Section>

      <Section title={t("designguide.general.taskcollection")}>
        <p className="max-w-prose text-sm text-muted-foreground">
          {t("designguide.general.collectiontoolbarownssharedgeometrywhileeachpage")}</p>
        <CollectionToolbar
          context={<span className="text-sm font-medium">{t("designguide.general.recenttasks")}</span>}
          search={<Input aria-label={t("designguide.general.searchtaskcollectionexample")} placeholder={t("designguide.general.searchtasks")} />}
          controls={<Button variant="outline" size="sm">{t("designguide.general.filter")}</Button>}
          actions={<Button size="sm">{t("designguide.general.newtask")}</Button>}
          feedback={<span className="text-xs text-muted-foreground">{t("designguide.general.1taskupdatednewestfirst")}</span>}
        />
        <div className="overflow-hidden rounded-lg border border-border">
          <IssueRow
            issue={DESIGN_GUIDE_TASK}
            presentation="task"
            unreadState="visible"
            metadata={<span className="text-xs text-muted-foreground">{t("designguide.general.updated12mago")}</span>}
            actions={<Button variant="ghost" size="xs">{t("designguide.general.more")}</Button>}
          />
        </div>
      </Section>

      <Section title={t("designguide.general.themetoggle")}>
        <SubSection title={t("designguide.general.variants")}>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <ThemeToggle />
            <ThemeToggle variant="menu-action" />
            <ThemeToggle variant="compact-menu-action" />
          </div>
        </SubSection>
      </Section>

      <Section title={t("designguide.general.languagetoggle")}>
        <SubSection title={t("designguide.general.variants1")}>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <LanguageToggle />
            <LanguageToggle variant="menu-action" />
            <LanguageToggle variant="compact-menu-action" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  COLORS                                                       */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.colors")}>
        <SubSection title={t("designguide.general.core")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Background" cssVar="--background" />
            <Swatch name="Foreground" cssVar="--foreground" />
            <Swatch name="Card" cssVar="--card" />
            <Swatch name="Primary" cssVar="--primary" />
            <Swatch name="Primary foreground" cssVar="--primary-foreground" />
            <Swatch name="Secondary" cssVar="--secondary" />
            <Swatch name="Muted" cssVar="--muted" />
            <Swatch name="Muted foreground" cssVar="--muted-foreground" />
            <Swatch name="Accent" cssVar="--accent" />
            <Swatch name="Destructive" cssVar="--destructive" />
            <Swatch name="Border" cssVar="--border" />
            <Swatch name="Ring" cssVar="--ring" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.sidebar")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Sidebar" cssVar="--sidebar" />
            <Swatch name="Sidebar border" cssVar="--sidebar-border" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.chart")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name="Chart 1" cssVar="--chart-1" />
            <Swatch name="Chart 2" cssVar="--chart-2" />
            <Swatch name="Chart 3" cssVar="--chart-3" />
            <Swatch name="Chart 4" cssVar="--chart-4" />
            <Swatch name="Chart 5" cssVar="--chart-5" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TYPOGRAPHY                                                   */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.runneractivity")}>
        <TaskChatRunnerActivityGroup item={{ id: "design-runner-activity", kind: "activity_phase", active: true, summary: "", interstitial: { id: "design-runner-commentary", kind: "message", author: "agent", text: "I’ll inspect the activity feed and check the layout.", interstitial: true }, items: [
          { id: "design-runner-read", kind: "tool", name: "read", target: "TaskChatRunnerTurn.tsx", status: "completed", detail: "Found the activity groups." },
          { id: "design-runner-check", kind: "tool", name: "exec_command", target: "pnpm check:token-gates", status: "in_progress" },
        ] }} />
        <TaskChatRunnerActivityGroup item={{ id: "design-runner-completed", kind: "activity_phase", active: false, summary: "", items: [
          { id: "design-completed-read", kind: "tool", name: "read", target: "TaskChatRunnerTurn.tsx", status: "completed", detail: "Read the activity groups." },
          { id: "design-completed-check", kind: "tool", name: "exec_command", target: "pnpm check:token-gates", status: "failed", detail: "A token check needs another pass." },
        ] }} />
      </Section>

      <Section title={t("designguide.general.typography")}>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">{t("designguide.general.pagetitletextxlfontbold")}</h2>
          <h2 className="text-lg font-semibold">{t("designguide.general.sectiontitletextlgfontsemibold")}</h2>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {t("designguide.general.sectionheadingtextsmfontsemibolduppercase")}</h3>
          <p className="text-sm font-medium">{t("designguide.general.cardtitletextsmfontmedium")}</p>
          <p className="text-sm font-semibold">{t("designguide.general.cardtitlealttextsmfontsemibold")}</p>
          <p className="text-sm">{t("designguide.general.bodytexttextsm")}</p>
          <p className="text-sm text-muted-foreground">
            {t("designguide.general.muteddescriptiontextsmtextmutedforeground")}</p>
          <p className="text-xs text-muted-foreground">
            {t("designguide.general.tinylabeltextxstextmutedforeground")}</p>
          <p className="text-sm font-mono text-muted-foreground">
            {t("designguide.general.monoidentifiertextsmfontmonotext")}</p>
          <p className="text-2xl font-bold">{t("designguide.general.largestattext2xlfontbold")}</p>
          <p className="font-mono text-xs">{t("designguide.general.logcodetextfontmonotextxs")}</p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SPACING & RADIUS                                             */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.radius")}>
        <div className="flex items-end gap-4 flex-wrap">
          {[
            ["sm", "var(--radius-sm)"],
            ["md", "var(--radius-md)"],
            ["lg", "var(--radius-lg)"],
            ["xl", "var(--radius-xl)"],
            ["full", "9999px"],
          ].map(([label, radius]) => (
            <div key={label} className="flex flex-col items-center gap-1">
              <div
                className="h-12 w-12 bg-primary"
                style={{ borderRadius: radius }}
              />
              <span className="text-xs text-muted-foreground">{label}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BUTTONS                                                      */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.buttons")}>
        <SubSection title={t("designguide.general.variants2")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="default">{t("designguide.general.default")}</Button>
            <Button variant="secondary">{t("designguide.general.secondary")}</Button>
            <Button variant="outline">{t("designguide.general.outline")}</Button>
            <Button variant="ghost">{t("designguide.general.ghost")}</Button>
            <Button variant="destructive">{t("designguide.general.destructive")}</Button>
            <Button variant="link">{t("designguide.general.link")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.sizes")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="xs">{t("designguide.general.extrasmall")}</Button>
            <Button size="sm">{t("designguide.general.small")}</Button>
            <Button size="default">{t("designguide.general.default3")}</Button>
            <Button size="lg">{t("designguide.general.large")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.iconbuttons")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon-xs"><Search /></Button>
            <Button variant="ghost" size="icon-sm"><Search /></Button>
            <Button variant="outline" size="icon"><Search /></Button>
            <Button variant="outline" size="icon-lg"><Search /></Button>
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.withicons")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button><Plus /> {t("designguide.general.newissue")}</Button>
            <Button variant="outline"><Upload /> {t("designguide.general.upload")}</Button>
            <Button variant="destructive"><Trash2 /> {t("designguide.general.delete")}</Button>
            <Button size="sm"><Plus /> {t("designguide.general.add")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.states")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button disabled>{t("designguide.general.disabled")}</Button>
            <Button variant="outline" disabled>{t("designguide.general.disabledoutline")}</Button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  BADGES                                                       */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.badges")}>
        <SubSection title={t("designguide.general.variants4")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{t("designguide.general.default5")}</Badge>
            <Badge variant="secondary">{t("designguide.general.secondary6")}</Badge>
            <Badge variant="outline">{t("designguide.general.outline7")}</Badge>
            <Badge variant="destructive">{t("designguide.general.destructive8")}</Badge>
            <Badge variant="ghost">{t("designguide.general.ghost9")}</Badge>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  STATUS BADGES & ICONS                                        */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.statussystem")}>
        <SubSection title={t("designguide.general.statusbadgeallstatuses")}>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              "active", "running", "paused", "idle", "archived", "planned",
              "achieved", "completed", "failed", "timed_out", "succeeded", "error",
              "pending_approval", "backlog", "todo", "in_progress", "in_review", "blocked",
              "done", "terminated", "cancelled", "pending", "revision_requested",
              "approved", "rejected",
            ].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.issuestatusbadgebrandchipglyphpap75")}>
          <div className="flex items-center gap-2 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled"].map(
              (s) => (
                <IssueStatusBadge key={s} status={s} />
              )
            )}
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.idleslackconversation")}>
          <StatusIcon status="in_review" externalConversationState="waiting" showLabel />
          <IssueStatusBadge status="in_review" externalConversationState="waiting" />
        </SubSection>
        <SubSection title={t("designguide.general.statusiconinteractive")}>
          <div className="flex items-center gap-3 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"].map(
              (s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <StatusIcon status={s} />
                  <span className="text-xs text-muted-foreground">{s}</span>
                </div>
              )
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusIcon status={status} onChange={setStatus} />
            <span className="text-sm">{t("designguide.general.clicktheicontochangestatuscurrent")} {status})</span>
          </div>
        </SubSection>

        {/* PAP-411: PriorityIcon showcase gated behind SHOW_TASK_PRIORITY_UI per board decision. */}
        {SHOW_TASK_PRIORITY_UI && (
        <SubSection title={t("designguide.general.priorityiconinteractive")}>
          <div className="flex items-center gap-3 flex-wrap">
            {["critical", "high", "medium", "low"].map((p) => (
              <div key={p} className="flex items-center gap-1.5">
                <PriorityIcon priority={p} />
                <span className="text-xs text-muted-foreground">{p}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <PriorityIcon priority={priority} onChange={setPriority} />
            <span className="text-sm">{t("designguide.general.clicktheicontochangecurrent")} {priority})</span>
          </div>
        </SubSection>
        )}

        <SubSection title={t("designguide.general.agentstatusdots")}>
          <div className="flex items-center gap-4 flex-wrap">
            {(["running", "active", "paused", "error", "archived"] as const).map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`inline-flex h-full w-full rounded-full ${agentStatusDot[label] ?? agentStatusDotDefault}`} />
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.runinvocationbadges")}>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              ["timer", "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"],
              ["assignment", "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"],
              ["on_demand", "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"],
              ["automation", "bg-muted text-muted-foreground"],
            ].map(([label, cls]) => (
              <Badge variant="ghost" key={label} className={`px-1.5 text-(length:--text-nano) ${cls}`}>
                {label}
              </Badge>
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.issuereferencepill")}>
          <p className="text-xs text-muted-foreground">
            {t("designguide.general.usedwhereverataskisreferencedin")}<code className="font-mono">{t("designguide.general.status")}</code> {t("designguide.general.toshowthetargetissueaposs")}<code className="font-mono">{t("designguide.general.variantproperty")}</code> {t("designguide.general.forcompactbadgeswithdirectnavigationpass")}<code className="font-mono">{t("designguide.general.onremove")}</code> {t("designguide.general.foraseparateblockerremovalcontrolwith")}<code className="font-mono">{t("designguide.general.strikethrough")}</code> {t("designguide.general.forquotremovedquotcontexts")}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <IssueReferencePill issue={{ id: "demo-1", identifier: "PAP-123", title: "Identifier only — no status yet" }} />
            <IssueReferencePill issue={{ id: "demo-2", identifier: "PAP-456", title: "With in_progress status", status: "in_progress" }} />
            <IssueReferencePill issue={{ id: "demo-3", identifier: "PAP-789", title: "Done status", status: "done" }} />
            <IssueReferencePill issue={{ id: "demo-4", identifier: "PAP-101", title: "Blocked status", status: "blocked" }} />
            <IssueReferencePill onRemove={() => window.alert("Blocker removed")} issue={{ id: "demo-blocker", identifier: "PAP-303", title: "Hover or focus to remove blocker", status: "in_review" }} />
            <IssueReferencePill strikethrough issue={{ id: "demo-5", identifier: "PAP-202", title: "Removed (strikethrough)", status: "todo" }} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  AGENT CAPSULE                                                */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.agentcapsule")}>
        <p className="text-sm text-muted-foreground max-w-prose">
          {t("designguide.general.thebrandquotcapsuleistheagent")}<code className="font-mono">{t("designguide.general.agentna")}</code> →{" "}
          <code className="font-mono">{t("designguide.general.agentnb")}</code>); <code className="font-mono">{t("designguide.general.prefersreducedmotion")}</code>{" "}
          {t("designguide.general.skipstheliquidriseandpulsesand")}</p>
        <SubSection title={t("designguide.general.states10")}>
          <div className="flex items-end gap-10">
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="slot" />
              <span className="text-xs text-muted-foreground">{t("designguide.general.slot")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="configured" />
              <span className="text-xs text-muted-foreground">{t("designguide.general.configured")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" gradient={5} />
              <span className="text-xs text-muted-foreground">{t("designguide.general.online")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" gradient={5} glow="blue" />
              <span className="text-xs text-muted-foreground">{t("designguide.general.onlineblueglow")}</span>
            </div>
          </div>
        </SubSection>
        <SubSection title={t("designguide.general.sizes11")}>
          <div className="flex items-end gap-8">
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="sm" gradient={1} />
              <span className="text-xs text-muted-foreground">{t("designguide.general.sm")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="md" gradient={4} />
              <span className="text-xs text-muted-foreground">{t("designguide.general.md")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="lg" gradient={8} />
              <span className="text-xs text-muted-foreground">{t("designguide.general.lg")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size={{ width: 28, height: 96 }} gradient={6} />
              <span className="text-xs text-muted-foreground">{t("designguide.general.custompx")}</span>
            </div>
          </div>
        </SubSection>
        <SubSection title={t("designguide.general.gradients")}>
          <div className="flex items-end gap-3 flex-wrap">
            {Array.from({ length: AGENT_GRADIENT_COUNT }, (_, i) => (
              <div key={i} className="flex flex-col items-center gap-1.5">
                <AgentCapsule state="online" size="sm" gradient={i + 1} />
                <span className="text-(length:--text-nano) font-mono text-muted-foreground">{i + 1}</span>
              </div>
            ))}
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  FORM ELEMENTS                                                */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.formelements")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designguide.general.input")}>
            <Input placeholder={t("designguide.general.defaultinput")} />
            <Input placeholder={t("designguide.general.disabledinput")} disabled className="mt-2" />
          </SubSection>

          <SubSection title={t("designguide.general.textarea")}>
            <Textarea placeholder={t("designguide.general.writesomething")} />
          </SubSection>

          <SubSection title={t("designguide.general.checkboxlabel")}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="check1" defaultChecked />
                <Label htmlFor="check1">{t("designguide.general.checkeditem")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check2" />
                <Label htmlFor="check2">{t("designguide.general.uncheckeditem")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check3" disabled />
                <Label htmlFor="check3">{t("designguide.general.disableditem")}</Label>
              </div>
            </div>
          </SubSection>

          <SubSection title={t("designguide.general.inlineeditor")}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designguide.general.titlesingleline")}</p>
                <InlineEditor
                  value={inlineTitle}
                  onSave={setInlineTitle}
                  as="h2"
                  className="text-xl font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designguide.general.bodytextsingleline")}</p>
                <InlineEditor
                  value={inlineText}
                  onSave={setInlineText}
                  as="p"
                  className="text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designguide.general.descriptionmultilineautosizing")}</p>
                <InlineEditor
                  value={inlineDesc}
                  onSave={setInlineDesc}
                  as="p"
                  className="text-sm text-muted-foreground"
                  placeholder={t("designguide.general.addadescription")}
                  multiline
                />
              </div>
            </div>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SELECT                                                       */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.select")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designguide.general.defaultsize")}>
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("designguide.general.selectstatus")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">{t("designguide.general.backlog")}</SelectItem>
                <SelectItem value="todo">{t("designguide.general.todo")}</SelectItem>
                <SelectItem value="in_progress">{t("designguide.general.inprogress")}</SelectItem>
                <SelectItem value="in_review">{t("designguide.general.inreview")}</SelectItem>
                <SelectItem value="done">{t("designguide.general.done")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("designguide.general.currentvalue")} {selectValue}</p>
          </SubSection>
          <SubSection title={t("designguide.general.smalltrigger")}>
            <Select defaultValue="high">
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">{t("designguide.general.critical")}</SelectItem>
                <SelectItem value="high">{t("designguide.general.high")}</SelectItem>
                <SelectItem value="medium">{t("designguide.general.medium")}</SelectItem>
                <SelectItem value="low">{t("designguide.general.low")}</SelectItem>
              </SelectContent>
            </Select>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.dropdownmenu")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              {t("designguide.general.quickactions")}<ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>
              <Check className="h-4 w-4" />
              {t("designguide.general.markasdone")}<DropdownMenuShortcut>{t("designguide.general.d")}</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpen className="h-4 w-4" />
              {t("designguide.general.opendocs")}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={menuChecked}
              onCheckedChange={(value) => setMenuChecked(value === true)}
            >
              {t("designguide.general.watchissue")}</DropdownMenuCheckboxItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 className="h-4 w-4" />
              {t("designguide.general.deleteissue")}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* ============================================================ */}
      {/*  POPOVER                                                      */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.popover")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">{t("designguide.general.openpopover")}</Button>
          </PopoverTrigger>
          <PopoverContent className="space-y-2">
            <p className="text-sm font-medium">{t("designguide.general.agentheartbeat")}</p>
            <p className="text-xs text-muted-foreground">
              {t("designguide.general.lastrunsucceeded24sagonexttimer")}</p>
            <Button size="xs">{t("designguide.general.wakenow")}</Button>
          </PopoverContent>
        </Popover>
      </Section>

      {/* ============================================================ */}
      {/*  COLLAPSIBLE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.collapsible")}>
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} className="space-y-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {collapsibleOpen ? t("designguide.general.hide") : t("designguide.general.show")} {t("designguide.general.advancedfilters")}</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-md border border-border p-3">
            <div className="space-y-2">
              <Label htmlFor="owner-filter">{t("designguide.general.owner")}</Label>
              <Input id="owner-filter" placeholder={t("designguide.general.filterbyagentname")} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {/* ============================================================ */}
      {/*  SHEET                                                        */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.sheet")}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">{t("designguide.general.opensidepanel")}</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t("designguide.general.issueproperties")}</SheetTitle>
              <SheetDescription>{t("designguide.general.editmetadatawithoutleavingthecurrentpage")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-1">
                <Label htmlFor="sheet-title">{t("designguide.general.title")}</Label>
                <Input id="sheet-title" defaultValue="Improve onboarding docs" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sheet-description">{t("designguide.general.description")}</Label>
                <Textarea id="sheet-description" defaultValue="Capture setup pitfalls and screenshots." />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline">{t("designguide.general.cancel")}</Button>
              <Button>{t("designguide.general.save")}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Section>

      {/* ============================================================ */}
      {/*  SCROLL AREA                                                  */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.scrollarea")}>
        <ScrollArea className="h-36 rounded-md border border-border">
          <div className="space-y-2 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border p-2 text-sm">
                {t("designguide.general.heartbeatrun")}{i + 1}{t("designguide.general.completedsuccessfully")}</div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* ============================================================ */}
      {/*  COMMAND                                                      */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.commandcmdk")}>
        <div className="rounded-md border border-border">
          <Command>
            <CommandInput placeholder={t("designguide.general.typeacommandorsearch")} />
            <CommandList>
              <CommandEmpty>{t("designguide.general.noresultsfound")}</CommandEmpty>
              <CommandGroup heading="Pages">
                <CommandItem>
                  <LayoutDashboard className="h-4 w-4" />
                  {t("designguide.general.dashboard")}</CommandItem>
                <CommandItem>
                  <CircleDot className="h-4 w-4" />
                  {t("designguide.general.issues")}</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Actions">
                <CommandItem>
                  <CommandIcon className="h-4 w-4" />
                  {t("designguide.general.opencommandpalette")}</CommandItem>
                <CommandItem>
                  <Plus className="h-4 w-4" />
                  {t("designguide.general.createnewissue")}</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BREADCRUMB                                                   */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.breadcrumb")}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designguide.general.projects")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designguide.general.paperclipapp")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("designguide.general.issuelist")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      {/* ============================================================ */}
      {/*  CARDS                                                        */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.cards")}>
        <SubSection title={t("designguide.general.dashboardagentruns")}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {["running", "queued", "succeeded", "failed", "timed_out", "cancelled", "interrupted"].map((status) => (
              <AgentRunCard
                key={status}
                companyId="design-guide"
                run={{
                  id: `design-guide-${status}`, agentId: "design-guide-agent", agentName: "CodexCoder",
                  status, adapterType: "codex_local", invocationSource: "on_demand", triggerDetail: "manual",
                  startedAt: null, finishedAt: null, createdAt: "2026-09-11T12:00:00Z", issueId: "design-guide-task",
                }}
                issue={{ identifier: "PAP-559", title: "Recreate this wireframe on pages Paperclip", status: status === "succeeded" ? "done" : "in_progress" }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("designguide.general.thedashboardandliverunspageuse")}</p>
        </SubSection>
        <SubSection title={t("designguide.general.standardcard")}>
          <Card>
            <CardHeader>
              <CardTitle>{t("designguide.general.cardtitle")}</CardTitle>
              <CardDescription>{t("designguide.general.carddescriptionwithsupportingtext")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t("designguide.general.cardcontentgoesherethisisthe")}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">{t("designguide.general.action")}</Button>
              <Button variant="outline" size="sm">{t("designguide.general.cancel12")}</Button>
            </CardFooter>
          </Card>
        </SubSection>

        <SubSection title={t("designguide.general.metriccards")}>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Bot} value={12} label={t("designguide.general.activeagents")} description="+3 this week" />
            <MetricCard icon={CircleDot} value={48} label={t("designguide.general.openissues")} />
            <MetricCard icon={DollarSign} value="$1,234" label={t("designguide.general.monthlycost")} description="Under budget" />
            <MetricCard icon={Zap} value="99.9%" label={t("designguide.general.uptime")} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TABS                                                         */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.tabs")}>
        <SubSection title={t("designguide.general.defaultpillvariant")}>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("designguide.general.overview")}</TabsTrigger>
              <TabsTrigger value="runs">{t("designguide.general.runs")}</TabsTrigger>
              <TabsTrigger value="config">{t("designguide.general.config")}</TabsTrigger>
              <TabsTrigger value="costs">{t("designguide.general.costs")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.overviewtabcontent")}</p>
            </TabsContent>
            <TabsContent value="runs">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.runstabcontent")}</p>
            </TabsContent>
            <TabsContent value="config">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.configtabcontent")}</p>
            </TabsContent>
            <TabsContent value="costs">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.coststabcontent")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>

        <SubSection title={t("designguide.general.linevariant")}>
          <Tabs defaultValue="summary">
            <TabsList variant="line">
              <TabsTrigger value="summary">{t("designguide.general.summary")}</TabsTrigger>
              <TabsTrigger value="details">{t("designguide.general.details")}</TabsTrigger>
              <TabsTrigger value="comments">{t("designguide.general.comments")}</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.summarycontentwithunderlinetabs")}</p>
            </TabsContent>
            <TabsContent value="details">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.detailscontent")}</p>
            </TabsContent>
            <TabsContent value="comments">
              <p className="text-sm text-muted-foreground py-4">{t("designguide.general.commentscontent")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  ENTITY ROWS                                                  */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.entityrows")}>
        <div className="border border-border rounded-md">
          <EntityRow
            leading={
              <>
                <StatusIcon status="in_progress" />
                {/* PAP-411: PriorityIcon hidden behind SHOW_TASK_PRIORITY_UI. */}
                {SHOW_TASK_PRIORITY_UI && <PriorityIcon priority="high" />}
              </>
            }
            identifier="PAP-001"
            title={t("designguide.general.implementauthenticationflow")}
            subtitle="Responsible: Agent Alpha"
            trailing={<IssueStatusBadge status="in_progress" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="done" />
                {SHOW_TASK_PRIORITY_UI && <PriorityIcon priority="medium" />}
              </>
            }
            identifier="PAP-002"
            title={t("designguide.general.setupcicdpipeline")}
            subtitle="Completed 2 days ago"
            trailing={<IssueStatusBadge status="done" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="todo" />
                {SHOW_TASK_PRIORITY_UI && <PriorityIcon priority="low" />}
              </>
            }
            identifier="PAP-003"
            title={t("designguide.general.writeapidocumentation")}
            trailing={<IssueStatusBadge status="todo" />}
            onClick={() => {}}
          />
          <EntityRow
            leading={
              <>
                <StatusIcon status="blocked" />
                {SHOW_TASK_PRIORITY_UI && <PriorityIcon priority="critical" />}
              </>
            }
            identifier="PAP-004"
            title={t("designguide.general.deploytoproduction")}
            subtitle="Blocked by PAP-001"
            trailing={<IssueStatusBadge status="blocked" />}
            selected
          />
        </div>
        <SubSection title={t("designguide.general.membershipaction")}>
          <div className="border border-border rounded-md">
            <EntityRow
              title={t("designguide.general.joinedresource")}
              subtitle="Hover or focus the row to reveal the reserved action slot."
              className="group"
              trailing={
                <MembershipAction
                  state="joined"
                  resourceName="Joined resource"
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designguide.general.leftresource")}
              subtitle="Persistent action with dimmed row content."
              className="group text-foreground/55"
              trailing={
                <MembershipAction
                  state="left"
                  resourceName="Left resource"
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designguide.general.leavingresource")}
              subtitle="Disabled while the optimistic mutation is pending."
              className="group text-foreground/55"
              trailing={
                <MembershipAction
                  state="left"
                  pending
                  pendingState="left"
                  resourceName="Leaving resource"
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designguide.general.joiningresource")}
              subtitle="The target state is visible immediately while the server confirms."
              className="group"
              trailing={
                <MembershipAction
                  state="joined"
                  pending
                  pendingState="joined"
                  resourceName="Joining resource"
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  FILTER BAR                                                   */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.filterbar")}>
        <FilterBar
          filters={filters}
          onRemove={(key) => setFilters((f) => f.filter((x) => x.key !== key))}
          onClear={() => setFilters([])}
        />
        {filters.length === 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setFilters([
                { key: "status", label: "Status", value: "Active" },
                // PAP-411: priority filter demo row suppressed while SHOW_TASK_PRIORITY_UI is off.
                ...(SHOW_TASK_PRIORITY_UI
                  ? [{ key: "priority", label: "Priority", value: "High" } as FilterValue]
                  : []),
              ])
            }
          >
            {t("designguide.general.resetfilters")}</Button>
        )}
      </Section>

      {/* ============================================================ */}
      {/*  AVATARS                                                      */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.avatars")}>
        <SubSection title={t("designguide.general.sizes13")}>
          <div className="flex items-center gap-3">
            <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>DF</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.group")}>
          <AvatarGroup>
            <Avatar><AvatarFallback>A1</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A2</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A3</AvatarFallback></Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
          </AvatarGroup>
        </SubSection>
      </Section>

      <Section title={t("designguide.general.applogos")}>
        <SubSection title={t("designguide.general.officialmarksandruntimefallback")}>
          <div className="flex items-center gap-3">
            <AppLogo
              name="Notion"
              logoUrl="/brands/apps/notion.svg"
              darkLogoUrl="/brands/apps/notion-dark.svg"
              size={36}
            />
            <AppLogo name="Jira" logoUrl="/brands/apps/jira.svg" darkLogoUrl="/brands/apps/jira-dark.svg" size={44} />
            <AppLogo name="Fallback" logoUrl="/brands/apps/does-not-exist.svg" size={36} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  IDENTITY                                                     */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.agentpersonas")}>
        <SubSection title={t("designguide.general.stablepaletteidentities")}>
          <div className="flex flex-wrap gap-3">{AGENT_PALETTE_IDS.map(palette => <AgentAvatar key={palette} appearance={appearanceForPalette(palette)} size={48} label={palette} />)}</div>
        </SubSection>
        <SubSection title={t("designguide.general.onboardingandlivecharacter")}>
          <p className="text-sm text-muted-foreground">{t("designguide.general.placeonelivecharacterbesidetheagent")}</p>
          <div className="flex gap-4"><AgentCharacter muted state="sleepy" motion="still" size={128} /><AgentCharacter size={128} /></div>
        </SubSection>
      </Section>
      <Section title={t("designguide.general.humanidentity")}>
        <SubSection title={t("designguide.general.sizes14")}>
          <div className="flex items-center gap-6">
            <Identity name="Alex Morgan" size="sm" />
            <Identity name="Alex Morgan" />
            <Identity name="Alex Morgan" size="lg" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.initialsderivation")}>
          <div className="flex flex-col gap-2">
            <Identity name="Casey Jordan" size="sm" />
            <Identity name="Alpha" size="sm" />
            <Identity name="Quinn Lee" size="sm" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.custominitials")}>
          <Identity name="Backend Service" initials="BS" size="sm" />
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLTIPS                                                     */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.tooltips")}>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">{t("designguide.general.hoverme")}</Button>
            </TooltipTrigger>
            <TooltipContent>{t("designguide.general.thisisatooltip")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><Settings /></Button>
            </TooltipTrigger>
            <TooltipContent>{t("designguide.general.settings")}</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DIALOG                                                       */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.dialog")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("designguide.general.opendialog")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("designguide.general.dialogtitle")}</DialogTitle>
              <DialogDescription>
                {t("designguide.general.thisisasampledialogshowingthe")}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("designguide.general.name")}</Label>
                <Input placeholder={t("designguide.general.enteraname")} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("designguide.general.description15")}</Label>
                <Textarea placeholder={t("designguide.general.describe")} className="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t("designguide.general.cancel16")}</Button>
              <Button>{t("designguide.general.save17")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* ============================================================ */}
      {/*  EMPTY STATE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.emptystate")}>
        <div className="border border-border rounded-md">
          <EmptyState
            icon={Inbox}
            message="No items to show. Create your first one to get started."
            action="Create Item"
            onAction={() => {}}
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROGRESS BARS                                                */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.progressbarsbudget")}>
        <div className="space-y-3">
          {[
            { label: "Under budget (40%)", pct: 40, color: "bg-green-400" },
            { label: "Warning (75%)", pct: 75, color: "bg-yellow-400" },
            { label: "Over budget (95%)", pct: 95, color: "bg-red-400" },
          ].map(({ label, pct, color }) => (
            <div key={label} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-mono">{pct}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-(--tp-width-background-color) duration-150 ${color}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  LOG VIEWER                                                   */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.logviewer")}>
        <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto">
          <div className="text-foreground">{t("designguide.general.120001infoagentstartedsuccessfully")}</div>
          <div className="text-foreground">{t("designguide.general.120002infoprocessingtaskpap")}</div>
          <div className="text-yellow-400">{t("designguide.general.120005warnratelimitapproaching")}</div>
          <div className="text-foreground">{t("designguide.general.120008infotaskpap001")}</div>
          <div className="text-red-400">{t("designguide.general.120012errorconnectiontimeoutto")}</div>
          <div className="text-blue-300">{t("designguide.general.120012sysretryingconnectionin")}</div>
          <div className="text-foreground">{t("designguide.general.120017inforeconnectedsuccessfully")}</div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 animate-pulse" />
              <span className="inline-flex h-full w-full rounded-full bg-blue-500" />
            </span>
            <span className="text-blue-600 dark:text-blue-400">{t("designguide.general.live")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROPERTY ROW PATTERN                                         */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.propertyrowpattern")}>
        <div className="border border-border rounded-md p-4 space-y-1 max-w-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designguide.general.status18")}</span>
            <StatusBadge status="active" />
          </div>
          {/* PAP-411: priority metadata row hidden behind SHOW_TASK_PRIORITY_UI. */}
          {SHOW_TASK_PRIORITY_UI && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">{t("designguide.general.priority")}</span>
              <PriorityIcon priority="high" />
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designguide.general.responsible")}</span>
            <div className="flex items-center gap-1.5">
              <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
              <span className="text-xs">{t("designguide.general.agentalpha")}</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designguide.general.created")}</span>
            <span className="text-xs">{t("designguide.general.jan152025")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  NAVIGATION PATTERNS                                          */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.navigationpatterns")}>
        <SubSection title={t("designguide.general.independentmcpconnections")}>
          <p className="text-sm text-muted-foreground">{t("designguide.general.zapierarcadecomposioandexecutoreachown")}</p>
          <RemoteMcpDesignExample />
        </SubSection>
        <SubSection title={t("designguide.general.setupwizard")}>
          <p className="text-sm text-muted-foreground">{t("designguide.general.sharedbyconnectionsetupandtriggerpreviews")}</p>
          <div className="max-w-sm space-y-6">
            <SetupWizardNavigation inline labels={["Choose trigger", "Configure", "Review"]} step={wizardStep} availableStep={2} onSelect={setWizardStep} />
            <SetupWizardFooter onSaveExit={() => setWizardStep(0)}><Button onClick={() => setWizardStep((wizardStep + 1) % 3)}>{t("designguide.general.continue")}</Button></SetupWizardFooter>
          </div>
        </SubSection>
        <SubSection title={t("designguide.general.agentchatpicker")}>
          <AgentChatPickerExample />
        </SubSection>
        <SubSection title={t("designguide.general.sidebarnavitems")}>
          <p className="text-sm text-muted-foreground">
            {t("designguide.general.layoutacceptssidebarsectionstocomposeadditionalsidebarsection")}</p>
          <Card className="block w-60 p-3 space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-accent-foreground">
              <LayoutDashboard className="h-4 w-4" />
              {t("designguide.general.dashboard19")}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <CircleDot className="h-4 w-4" />
              {t("designguide.general.issues20")}<Badge variant="ghost" className="ml-auto bg-primary text-primary-foreground px-1.5">
                12
              </Badge>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Bot className="h-4 w-4" />
              {t("designguide.general.agents")}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Hexagon className="h-4 w-4" />
              {t("designguide.general.projects21")}</div>
          </Card>
        </SubSection>

        <SubSection title={t("designguide.general.viewtoggle")}>
          <div className="flex items-center border border-border rounded-md w-fit">
            <button className="px-3 py-1.5 text-xs font-medium bg-accent text-foreground rounded-l-md">
              <ListTodo className="h-3.5 w-3.5 inline mr-1" />
              {t("designguide.general.list")}</button>
            <button className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-r-md">
              <Target className="h-3.5 w-3.5 inline mr-1" />
              {t("designguide.general.org")}</button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  GROUPED LIST (Issues pattern)                                */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.groupedlistissuespattern")}>
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-md">
            <StatusIcon status="in_progress" />
            <span className="text-sm font-medium">{t("designguide.general.inprogress22")}</span>
            <span className="text-xs text-muted-foreground ml-1">2</span>
          </div>
          <div className="border border-border rounded-b-md">
            {/* PAP-411: leading PriorityIcon hidden behind SHOW_TASK_PRIORITY_UI. */}
            <EntityRow
              leading={SHOW_TASK_PRIORITY_UI ? <PriorityIcon priority="high" /> : undefined}
              identifier="PAP-101"
              title={t("designguide.general.buildagentheartbeatsystem")}
              onClick={() => {}}
            />
            <EntityRow
              leading={SHOW_TASK_PRIORITY_UI ? <PriorityIcon priority="medium" /> : undefined}
              identifier="PAP-102"
              title={t("designguide.general.addcosttrackingdashboard")}
              onClick={() => {}}
            />
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COMMENT THREAD PATTERN                                       */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.commentthreadpattern")}>
        <div className="space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">{t("designguide.general.comments2")}</h3>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designguide.general.agent")}</span>
                <span className="text-xs text-muted-foreground">{t("designguide.general.jan15202523")}</span>
              </div>
              <p className="text-sm">{t("designguide.general.startedworkingontheauthenticationmodulewill")}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designguide.general.human")}</span>
                <span className="text-xs text-muted-foreground">{t("designguide.general.jan162025")}</span>
              </div>
              <p className="text-sm">{t("designguide.general.apikeyshavebeenaddedtothe")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Textarea placeholder={t("designguide.general.leaveacomment")} rows={3} />
            <Button size="sm">{t("designguide.general.comment")}</Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COST TABLE PATTERN                                           */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.costtablepattern")}>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-accent/20">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designguide.general.model")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designguide.general.tokens")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designguide.general.cost")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-2">{t("designguide.general.claudesonnet420250514")}</td>
                <td className="px-3 py-2 font-mono">{t("designguide.general.12m")}</td>
                <td className="px-3 py-2 font-mono">$18.00</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2">{t("designguide.general.claudehaiku420250506")}</td>
                <td className="px-3 py-2 font-mono">{t("designguide.general.500k")}</td>
                <td className="px-3 py-2 font-mono">$1.25</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">{t("designguide.general.total")}</td>
                <td className="px-3 py-2 font-mono">{t("designguide.general.17m")}</td>
                <td className="px-3 py-2 font-mono font-medium">$19.25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SKELETONS                                                    */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.skeletons")}>
        <SubSection title={t("designguide.general.individual")}>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-full max-w-sm" />
            <Skeleton className="h-20 w-full" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.pageskeletonlist")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="list" />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.pageskeletondetail")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="detail" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  SEPARATOR                                                    */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.separator")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("designguide.general.horizontal")}</p>
          <Separator />
          <div className="flex items-center gap-4 h-8">
            <span className="text-sm">{t("designguide.general.left")}</span>
            <Separator orientation="vertical" />
            <span className="text-sm">{t("designguide.general.right")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  ICON REFERENCE                                               */}
      {/* ============================================================ */}
      {/*  TEAM CATALOG                                                 */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.teamcatalog")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.componentsfromtheteamcatalogbrowseinstall")}<code className="font-mono text-xs">/teams-catalog</code>{t("designguide.general.fixturesaresharedwiththestorybookstories")}</p>

        <SubSection title={t("designguide.general.teamrowbrowselist")}>
          <div className="w-(--sz-28rem) rounded-md border border-border">
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">
              {t("designguide.general.bundled1")}</div>
            <TeamRow team={sampleTeam} selected onSelect={() => {}} />
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">
              {t("designguide.general.optional2")}</div>
            <TeamRow team={optionalTeam} selected={false} onSelect={() => {}} />
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">
              {t("designguide.general.installed2")}</div>
            <TeamRow team={sampleTeam} selected={false} onSelect={() => {}} installed={outOfDateInstalledState} />
            <TeamRow team={warnTeam} selected={false} onSelect={() => {}} installed={currentInstalledState} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.installedteamscollapseunder")}<code className="font-mono">{t("designguide.general.installedn")}</code>{t("designguide.general.anoutofdateinstallserver")}<code className="font-mono">{t("designguide.general.originhash")}</code> {t("designguide.general.catalog")}<code className="font-mono">{t("designguide.general.contenthash")}</code>{t("designguide.general.showstheamber")}<code className="font-mono">↑</code> {t("designguide.general.badgepap10256")}</p>
        </SubSection>

        <SubSection title={t("designguide.general.teamcardonboardinggrid")}>
          <p className="text-xs text-muted-foreground">
            {t("designguide.general.squaretilefortheonboardingldquopick")}{" "}
            <code className="font-mono">{t("designguide.general.ring2ringring")}</code>{t("designguide.general.drivesthe")}{" "}
            <code className="font-mono">{t("designguide.general.useinstallteamcatalogentry")}</code> {t("designguide.general.simplifiedflow")}</p>
          <TeamCardShowcase />
        </SubSection>

        <SubSection title={t("designguide.general.teamhierarchypreview")}>
          <div className="max-w-md">
            <TeamHierarchyPreview team={sampleTeam} />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.requiredskillslist")}>
          <div className="max-w-xl">
            <RequiredSkillsList skills={sampleTeam.requiredSkills} />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.envinputslist")}>
          <div className="max-w-xl">
            <EnvInputsList inputs={sampleTeam.envInputs} />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.externalsourceslist")}>
          <div className="max-w-xl">
            <ExternalSourcesList sources={sampleTeam.sourceRefs} />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.sourcepolicystepstepsourcepolicy")}>
          <div className="max-w-xl rounded-md border border-border p-4">
            <StepSourcePolicy
              team={warnTeam}
              allowExternalSources={allowExternal}
              allowUnpinnedOptionalSources={allowUnpinned}
              allowLocalPathSources={allowLocalPath}
              onChange={(key, value) => {
                if (key === "external") setAllowExternal(value);
                if (key === "unpinned") setAllowUnpinned(value);
                if (key === "localPath") setAllowLocalPath(value);
              }}
            />
          </div>
        </SubSection>

        <SubSection title={t("designguide.general.skillplanstepstepskillplan")}>
          <div className="max-w-xl rounded-md border border-border p-4">
            <StepSkillPlan team={sampleTeam} preparations={sampleSkillPreparations} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      <Section title={t("designguide.general.commoniconslucide")}>
        <div className="grid grid-cols-4 md:grid-cols-6 gap-4">
          {[
            ["Inbox", Inbox],
            ["ListTodo", ListTodo],
            ["CircleDot", CircleDot],
            ["Hexagon", Hexagon],
            ["Target", Target],
            ["LayoutDashboard", LayoutDashboard],
            ["Bot", Bot],
            ["DollarSign", DollarSign],
            ["History", History],
            ["Search", Search],
            ["Plus", Plus],
            ["Trash2", Trash2],
            ["Settings", Settings],
            ["User", User],
            ["Mail", Mail],
            ["Upload", Upload],
            ["Zap", Zap],
          ].map(([name, Icon]) => {
            const LucideIcon = Icon as React.FC<{ className?: string }>;
            return (
              <div key={name as string} className="flex flex-col items-center gap-1.5 p-2">
                <LucideIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-(length:--text-nano) text-muted-foreground font-mono">{name as string}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  KEYBOARD SHORTCUTS                                           */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.keyboardshortcuts")}>
        <div className="border border-border rounded-md divide-y divide-border text-sm">
          {[
            ["Cmd+K / Ctrl+K", "Open Command Palette"],
            ["C", "New Issue (outside inputs)"],
            ["[", "Toggle Sidebar"],
            ["]", "Toggle Properties Panel"],

            ["Cmd+Enter / Ctrl+Enter", "Submit markdown comment"],
          ].map(([key, desc]) => (
            <div key={key} className="flex items-center justify-between px-4 py-2">
              <span className="text-muted-foreground">{desc}</span>
              <kbd className="px-2 py-0.5 text-xs font-mono bg-muted rounded border border-border">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t("designguide.general.issueoutputsurface")}>
        <SubSection title={t("designguide.general.multipleoutputsprimaryvideoalsoproduced")}>
          <IssueOutputSection workProducts={DESIGN_GUIDE_OUTPUTS} />
        </SubSection>
        <SubSection title={t("designguide.general.degradedoutputinvalidfailedattachmentmetadata")}>
          <IssueOutputSection workProducts={DESIGN_GUIDE_DEGRADED_OUTPUTS} />
        </SubSection>
        <SubSection title={t("designguide.general.emptystate24")}>
          <p className="text-xs text-muted-foreground">
            {t("designguide.general.whenanissuehasproducednoartifact")}</p>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLS & ACCESS (PAP-10389)                                   */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.toolsaccess")}>
        <SubSection title={t("designguide.general.enforcementbannerdefaultdenieddetected")}>
          <div className="space-y-3">
            <EnforcementBanner companyId="" forceVariant="default" recentDenialCount={0} />
            <EnforcementBanner companyId="" forceVariant="denied-detected" recentDenialCount={3} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.persistentatthetopofthetools")}<code>{t("designguide.general.denieddetected")}</code> {t("designguide.general.whengovernedtoolcallsweredeniedor")}</p>
        </SubSection>

        <SubSection title={t("designguide.general.enforcementbannerpresentationaltonesinfowarningerror")}>
          <div className="space-y-3">
            <EnforcementBanner
              tone="info"
              title={t("designguide.general.effectiveaccessserverresolved")}
              body="This is exactly what the tool gateway will accept. Profile and policy edits reflect within ~5s; the prompt cannot expand it."
            />
            <EnforcementBanner
              tone="warning"
              title={t("designguide.general.localstdioislocalcodeexecutionnot")}
              body="A local-stdio slot runs with the orchestrator's privileges. Only bind trusted commands; quarantine anything you would not run yourself."
            />
            <EnforcementBanner
              tone="error"
              title={t("designguide.general.runtimefailedclosed")}
              body="The supervisor is restarting (attempt 2/3). The gateway returns runtime-error and the agent does not see partial output."
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.staticgovernancecopywithatoneused")}<code>{t("designguide.general.title25")}</code>/<code>{t("designguide.general.body")}</code> {t("designguide.general.andanoptional")}{" "}
            <code>{t("designguide.general.icon")}</code>.
          </p>
        </SubSection>

        <SubSection title={t("designguide.general.actionapprovalcardpendingstalesurfaces11")}>
          <div className="grid gap-4 lg:grid-cols-2">
            <ActionCard
              toolName="slack.post_message"
              risk="medium"
              isWrite
              binding={{
                application: "Slack",
                manifestVersion: "2.4.1",
                connection: "https://slack.com/api · acme-workspace",
                catalogSha256: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
                payloadSha256: "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
              }}
              input={{ channel: "#launch", text: "Deploy v2 is live 🎉", unfurl_links: false }}
              reason="This tool can write to your workspace, so a human signs off before the agent posts."
              policyNumber={7}
              expiresInLabel="expires in 23h 51m"
            />
            <ActionCard
              variant="stale"
              toolName="slack.post_message"
              risk="medium"
              isWrite
              binding={{
                application: "Slack",
                manifestVersion: "2.4.1",
                connection: "https://slack.com/api · acme-workspace",
                catalogSha256: "sha256:7d793037a0760186574b0282f2f435e7a4b1b2b0b822cd15d6c15b0f00a0e3f1",
                previousCatalogSha256: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
                payloadSha256: "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
              }}
              input={{ channel: "#launch", text: "Deploy v2 is live 🎉", unfurl_links: false }}
              reason="This tool can write to your workspace, so a human signs off before the agent posts."
              policyNumber={7}
              expiresInLabel="expires in 18h 02m"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.signedpayloadsha256expirysurfaceonevery")}{" "}
            <code>{t("designguide.general.stale")}</code> {t("designguide.general.varianttintstheborderamberbannersthe")}<code>{t("designguide.general.approve")}</code> {t("designguide.general.disableduntiltherequestisreissued")}</p>
        </SubSection>

        <SubSection title={t("designguide.general.actionapprovalcardmobile390844surface")}>
          <div className="w-(--sz-390px) max-w-full rounded-xl border border-border bg-background p-3">
            <ActionCardMobile
              toolName="slack.post_message"
              risk="medium"
              isWrite
              binding={{
                application: "Slack",
                manifestVersion: "2.4.1",
                connection: "https://slack.com/api · acme-workspace",
                catalogSha256: "sha256:9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
                payloadSha256: "sha256:2c26b46b68ffc68ff99b453c1d30413413422d706483bfa0f98a5e886266e7ae",
              }}
              input={{ channel: "#launch", text: "Deploy v2 is live 🎉" }}
              reason="This tool can write to your workspace, so a human signs off before the agent posts."
              policyNumber={7}
              expiresInLabel="expires in 23h 51m"
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.identicalcontentthethreebuttonsstackfull")}</p>
        </SubSection>

        <SubSection title={t("designguide.general.bindingstablereusedintheauditrowdrilldown")}>
          <BindingsTable
            rows={[
              { label: "Application", value: "Slack · manifest v2.4.1" },
              { label: "Connection", value: "https://slack.com/api · acme-workspace", mono: true },
              { label: "Catalog", value: "sha256:9f86d081…f00a08", mono: true },
              { label: "Payload", value: "sha256:2c26b46b…66e7ae", mono: true },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.twocolumnkeyvalueblockwithmono")}<code>{t("designguide.general.actioncard")}</code> {t("designguide.general.andisreusedstandaloneintheaudit")}</p>
        </SubSection>

        <SubSection title={t("designguide.general.toolaccessstatuskeysstatusbadge")}>
          <div className="flex flex-wrap items-center gap-2">
            {[
              "allowed", "denied", "block", "require-approval", "redacted", "rate-limit",
              "deferred", "hidden", "quarantined", "healthy", "degraded", "runtime-error", "unchecked",
            ].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("designguide.general.policydecisionsconnectionruntimehealthandcatalog")}{" "}
            <code>{t("designguide.general.statusbadge")}</code> {t("designguide.general.keysdefinedin")}<code>{t("designguide.general.libstatuscolors")}</code>.
          </p>
        </SubSection>

        <SubSection title={t("designguide.general.emptystatecanonicalwithdescriptionaction")}>
          <EmptyState
            icon={Inbox}
            message="No connections yet"
            description="Add a connection to an application to configure credentials and discover its tools."
            action="New connection"
            onAction={() => {}}
          />
        </SubSection>
      </Section>

      <Section title={t("designguide.general.sourcerepositories")}>
        <SubSection title={t("designguide.general.emptyanddisconnected")}>
          <RepositoryEditor selected={[]} onChange={() => {}} state="disconnected" onConnect={() => {}} onRetry={() => {}} />
        </SubSection>
        <SubSection title={t("designguide.general.selectedandsearchable")}>
          <RepositoryEditor selected={[{ id: "1", fullName: "paperclipai/paperclip", url: "https://github.com/paperclipai/paperclip", connections: ["Your GitHub"] }]}
            available={[{ id: "2", fullName: "paperclipai/docs", url: "https://github.com/paperclipai/docs", connections: ["Company GitHub"] }]}
            onChange={() => {}} onConnect={() => {}} onRetry={() => {}} />
        </SubSection>
        <p className="text-sm text-muted-foreground">{t("designguide.general.loadingerrorsemptysearchmobileandshort")}</p>
      </Section>

      <Section title={t("designguide.general.environmentvariableseditor")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.reusableenvvareditoragentsprojectsenvironments")}<span className="font-mono">{t("designguide.general.productenvironmentvariableseditor")}</span> {t("designguide.general.storiesforall10states")}</p>
        <EnvironmentVariablesEditorShowcase />
      </Section>

      <Section title={t("designguide.general.taskscreatedfromatask")}>
        <SubSection title={t("designguide.general.subtasksandcreatedworkareindependent")}>
          <div className="max-w-xl">
            <TaskDetailTasksPanel
              subtasks={[DESIGN_GUIDE_TASK]}
              createdTasks={[
                { ...DESIGN_GUIDE_TASK, projectId: "design-board", project: { id: "design-board", name: "Board UI" } as Issue["project"] },
                { ...DESIGN_GUIDE_TASK, id: "design-followup", identifier: "PAP-428", title: "Write release notes", status: "todo", projectId: null },
              ]}
              projects={[]}
            />
          </div>
        </SubSection>
        <SubSection title={t("designguide.general.emptyloadingandfailed")}>
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} />
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} isLoading />
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} hasError onRetry={() => {}} />
        </SubSection>
      </Section>

      <Section title={t("designguide.general.executionrecovery")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.recoveryrunsinthebackgroundtasklists")}</p>
      </Section>

      <Section title={t("designguide.general.savedproviderapikeys")}>
        <SavedProviderKeySelect options={[{ id: "example", label: "Claude API key (Your key)", binding: { type: "user_secret_ref", key: "ANTHROPIC_API_KEY", version: "latest" } }]} value="example" onChange={() => {}} loading={false} error={false} />
        <SavedProviderKeySelect options={[]} value="" onChange={() => {}} loading error={false} />
        <SavedProviderKeySelect options={[]} value="" onChange={() => {}} loading={false} error />
      </Section>

      <Section title={t("designguide.general.connectionintent")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.thetaskcardisthedialoghost")}</p>
        <div className="grid gap-4 xl:grid-cols-3">
          <IssueThreadInteractionCard
            interaction={pendingConnectionIntentInteraction}
            currentUserId={issueThreadInteractionFixtureMeta.currentUserId}
          />
          <IssueThreadInteractionCard
            interaction={retryConnectionIntentInteraction}
            currentUserId={issueThreadInteractionFixtureMeta.currentUserId}
          />
          <IssueThreadInteractionCard
            interaction={connectedConnectionIntentInteraction}
            currentUserId={issueThreadInteractionFixtureMeta.currentUserId}
          />
        </div>
      </Section>

      <Section title={t("designguide.general.resizablepanels")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.designsystemwrapperover")}<span className="font-mono">{t("designguide.general.reactresizablepanels")}</span>{" "}
          {t("designguide.general.skillstudiod2dragahandleto")}<span className="font-mono">{t("designguide.general.minsize240px")}</span>{t("designguide.general.constraintsandthemiddlepaneliscollapsible")}</p>
        <div className="h-48 max-w-2xl overflow-hidden rounded-md border border-border">
          <ResizablePanelGroup>
            <ResizablePanel id="a" minSize="120px" className="bg-muted/30">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("designguide.general.panela")}</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="b" minSize="120px" collapsible collapsedSize="40px" className="bg-muted/10">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("designguide.general.panelbcollapsible")}</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="c" minSize="120px" className="bg-muted/30">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                {t("designguide.general.panelc")}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  INLINE BANNER + BUILT-IN AGENTS                              */}
      {/* ============================================================ */}
      <Section title={t("designguide.general.webhookurlwarnings")}>
        <div className="space-y-3">
          {["http://localhost:3100", "https://paperclip.internal", "https://paperclip.example-tailnet.ts.net", "http://paperclip.example.com", "not-a-url"].map((url) => <WebhookUrlWarning key={url} url={url} />)}
        </div>
      </Section>

      <Section title={t("designguide.general.inlinebanner")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.tokenbackedfullwidthnotice")}<span className="font-mono">{t("designguide.general.brandbanner")}</span> {t("designguide.general.tonesuse")}{" "}
          <span className="font-mono">{t("designguide.general.info")}</span> {t("designguide.general.forprovenancecontextand")}{" "}
          <span className="font-mono">{t("designguide.general.warning")}</span> {t("designguide.general.forpausedattentionsupportsanoptionalbold")}{" "}
          <span className="font-mono">{t("designguide.general.bgyellow")}</span>/<span className="font-mono">{t("designguide.general.bgblue")}</span>{" "}
          {t("designguide.general.banners")}</p>
        <div className="space-y-3">
          <InlineBanner
            tone="info"
            title={t("designguide.general.builtinagent")}
            actions={<Button variant="outline" size="sm">{t("designguide.general.resettodefaults")}</Button>}
          >
            {t("designguide.general.shipswithpaperclipandpowers")}<strong>{t("designguide.general.briefs")}</strong>{t("designguide.general.itcanbepausedbutnotdeleted")}</InlineBanner>
          <InlineBanner
            tone="warning"
            title={t("designguide.general.briefsispaused")}
            actions={
              <>
                <Button variant="ghost" size="sm">{t("designguide.general.viewagent")}</Button>
                <Button size="sm">{t("designguide.general.resumeagent")}</Button>
              </>
            }
          >
            {t("designguide.general.itsbuiltinagentwaspaused2")}</InlineBanner>
          <InlineBanner
            tone="danger"
            title={t("designguide.general.summarygenerationfailed")}
            actions={<Button size="sm">{t("designguide.general.retry")}</Button>}
          >
            {t("designguide.general.thelinkedissuereachedaterminalstate")}</InlineBanner>
          <InlineBanner tone="info" compact>
            {t("designguide.general.compactvariantforembeddinginsidedialogsand")}</InlineBanner>
        </div>
      </Section>

      <Section title={t("designguide.general.mediaartifacts")}>
        <p className="text-sm text-muted-foreground">{t("designguide.general.imagesandvideosusegallerytilesthe")}</p>
        <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <MediaArtifactCard id="design-image" title={t("designguide.general.launchartwork")} contentPath="/announcement-preview.svg" contentType="image/svg+xml" originalFilename="launch.svg" detail="Image" />
          <MediaArtifactCard id="design-video" title={t("designguide.general.videopreviewunavailable")} contentPath="" contentType="video/mp4" originalFilename="preview.mp4" detail="Video" />
        </div>
      </Section>

      <Section title={t("designguide.general.aiconnections")}>
        <AiConnectionDesignExamples />
      </Section>

      <Section title={t("designguide.general.builtinagentlifecyclechips")}>
        <p className="text-sm text-muted-foreground">
          {t("designguide.general.aderivedlifecyclechipamberforattention")}{" "}
          <span className="font-mono">{t("designguide.general.needssetup")}</span> / <span className="font-mono">{t("designguide.general.pendingapproval")}</span>.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <BuiltInLifecycleChip status="needs_setup" />
          <BuiltInLifecycleChip status="pending_approval" />
          <BuiltInLifecycleChip status="needs_setup" compact />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-mono">{t("designguide.general.ltbuiltinagentgateagentkeygt")}</span> {t("designguide.general.composes")}{" "}
          <span className="font-mono">{t("designguide.general.pageskeleton")}</span> + <span className="font-mono">{t("designguide.general.emptystate26")}</span>{" "}
          + <span className="font-mono">{t("designguide.general.inlinebanner27")}</span> {t("designguide.general.torendertheloadingsetuppendingapproval")}</p>
      </Section>
    </div>
  );
}
