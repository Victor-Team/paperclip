import { MediaArtifactCard } from "@/components/artifacts/MediaArtifactCard";
import { WebhookUrlWarning } from "@/components/routine-triggers/WebhookUrlWarning";
import { SetupWizardNavigation, SetupWizardFooter } from "../components/SetupWizard";
import { RemoteMcpDesignExample } from "@/features/connections/remote-mcp/RemoteMcpDesignExample";
import { AgentChatPicker } from "@/components/AgentChatPicker";
import { TaskChatProjectCreatedCard } from "@/components/task-chat/TaskChatProjectCreatedCard";
import { AnnouncementCard } from "@/components/AnnouncementCard";
import { announcementPreview, announcementAnimationPreview, localizedAnnouncementAnimationPreviewSrc } from "@/lib/announcement-preview";
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
import { useEffect, useState } from "react";
import { useTranslation } from "@/i18n";
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
    <p className="text-sm text-muted-foreground">{running ? t("designGuide.runningHint") : t("designGuide.pausedHint")}</p>
    <TaskChatProjectCreatedCard item={{ id: "design-project", kind: "project_created", projectId: "example-project", name: t("designGuide.extra33"), description: t("designGuide.extra34"), timestamp: "2026-09-11T00:00:00Z", repositories: [{ id: "1", name: "paperclipai/paperclip", url: "https://github.com/paperclipai/paperclip" }] }} />
    {!running ? <TaskChatMarker item={{ id: "design-cancelled", kind: "marker", variant: "interrupted", tone: "neutral", label: t("designGuide.runCancelled"), detail: t("designGuide.runCancelledDetail"), collapsible: true }} /> : null}
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
    <Button variant="outline" onClick={() => setState("empty")}>{t("designGuide.d0001")}</Button>
    <Button variant="outline" onClick={() => setState("loading")}>{t("designGuide.d0002")}</Button>
    <Button variant="outline" onClick={() => setState("error")}>{t("designGuide.d0003")}</Button>
    <AgentChatPicker agents={[]} open={state !== "closed"} onOpenChange={(open) => { if (!open) setState("closed"); }} onSelect={() => {}}
      loading={state === "loading"} error={state === "error" ? new Error(t("designGuide.unavailable")) : null} onRetry={() => setState("empty")} />
  </div>;
}

export function DesignGuide() {
  const { t, i18n } = useTranslation();
  const localizedDesignGuideTask = { ...DESIGN_GUIDE_TASK, title: t("designGuide.extra37") };
  const statusLabels: Record<string, string> = {
    backlog: t("designGuide.extra42"), todo: t("designGuide.extra43"), in_progress: t("designGuide.extra44"),
    in_review: t("designGuide.extra45"), done: t("designGuide.extra46"), blocked: t("designGuide.extra47"),
    cancelled: t("designGuide.extra48"), running: t("designGuide.extra49"), active: t("designGuide.extra50"),
    paused: t("designGuide.extra51"), error: t("designGuide.extra52"), archived: t("designGuide.extra53"),
    timer: t("designGuide.extra54"), assignment: t("designGuide.extra55"), on_demand: t("designGuide.extra56"),
    automation: t("designGuide.extra57"), critical: t("designGuide.extra58"), high: t("designGuide.extra59"),
    medium: t("designGuide.extra60"), low: t("designGuide.extra61"),
  };
  const [wizardStep, setWizardStep] = useState(0);
  const [status, setStatus] = useState("todo");
  const [priority, setPriority] = useState("medium");
  const [selectValue, setSelectValue] = useState("in_progress");
  const [menuChecked, setMenuChecked] = useState(true);
  const [collapsibleOpen, setCollapsibleOpen] = useState(false);
  const [inlineText, setInlineText] = useState(() => t("designGuide.editText"));
  const [inlineTitle, setInlineTitle] = useState(() => t("designGuide.editableTitle"));
  const [inlineDesc, setInlineDesc] = useState(
    t("designGuide.editableDescription")
  );
  const [filters, setFilters] = useState<FilterValue[]>([
    { key: "status", label: t("designGuide.d0241"), value: t("designGuide.active") },
    // PAP-411: priority filter demo row suppressed while SHOW_TASK_PRIORITY_UI is off.
    ...(SHOW_TASK_PRIORITY_UI
      ? [{ key: "priority", label: t("designGuide.d0242"), value: t("designGuide.d0130") } as FilterValue]
      : []),
  ]);
  useEffect(() => {
    setInlineText(t("designGuide.editText"));
    setInlineTitle(t("designGuide.editableTitle"));
    setInlineDesc(t("designGuide.editableDescription"));
    setFilters((current) => current.map((filter) => filter.key === "status"
      ? { ...filter, label: t("designGuide.d0241"), value: t("designGuide.active") }
      : filter.key === "priority"
        ? { ...filter, label: t("designGuide.d0242"), value: t("designGuide.d0130") }
        : filter));
  }, [i18n.language, t]);
  const [allowExternal, setAllowExternal] = useState(false);
  const [allowUnpinned, setAllowUnpinned] = useState(false);
  const [allowLocalPath, setAllowLocalPath] = useState(false);
  const isChinesePreview = i18n.language.toLowerCase().startsWith("zh");
  const [localizedAnnouncementImageSrc, setLocalizedAnnouncementImageSrc] = useState("/announcement-preview.svg");
  useEffect(() => {
    let active = true;
    if (!isChinesePreview) {
      setLocalizedAnnouncementImageSrc("/announcement-preview.svg");
      return () => { active = false; };
    }
    void fetch("/announcement-preview.svg")
      .then((response) => response.text())
      .then((svg) => {
        if (active) {
          setLocalizedAnnouncementImageSrc("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg.replace("Ideas become work.", t("designGuide.artworkTagline"))));
        }
      });
    return () => { active = false; };
  }, [isChinesePreview, t]);
  const localizedAnnouncementAnimationSrc = localizedAnnouncementAnimationPreviewSrc(i18n.language, t);
  const localizedAnnouncement = {
    ...announcementPreview,
    eyebrow: t("designGuide.announcementEyebrow"),
    title: t("designGuide.announcementTitle"),
    description: t("designGuide.announcementDescription"),
    image: announcementPreview.image && { ...announcementPreview.image, alt: t("designGuide.announcementImageAlt") },
    secondaryLink: announcementPreview.secondaryLink && { ...announcementPreview.secondaryLink, label: t("designGuide.announcementLearn") },
    primaryAction: { ...announcementPreview.primaryAction, label: t("designGuide.announcementExplore") },
  };
  const localizedAnimatedAnnouncement = {
    ...announcementAnimationPreview,
    ...localizedAnnouncement,
    animation: announcementAnimationPreview.animation && { ...announcementAnimationPreview.animation, alt: t("designGuide.announcementAnimationAlt") },
  };

  return (
    <div className="space-y-10 max-w-4xl">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-bold">{t("designGuide.d0004")}</h2>
        <p className="text-sm text-muted-foreground mt-1">{" "}{t("designGuide.d0005")}{" "}</p>
      </div>

      {/* ============================================================ */}
      {/*  COVERAGE                                                     */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0006")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0007")}{" "}</p>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.d0008")}>
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
          <SubSection title={t("designGuide.d0009")}>
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

      <Section title={t("designGuide.d0010")}>
        <div className="grid gap-4 md:grid-cols-2">
          <AnnouncementCard announcement={localizedAnimatedAnnouncement} imageSrc={localizedAnnouncementImageSrc} animationSrc={localizedAnnouncementAnimationSrc} onDismiss={() => {}} />
          <AnnouncementCard announcement={localizedAnnouncement} imageSrc={localizedAnnouncementImageSrc} onDismiss={() => {}} />
          <AnnouncementCard announcement={{ ...localizedAnnouncement, image: undefined, secondaryLink: undefined }} onDismiss={() => {}} />
        </div>
      </Section>

      <Section title={t("designGuide.d0011")}>
        <TaskExecutionControlsExample />
      </Section>

      <Section title={t("designGuide.d0012")}>
        <p className="max-w-prose text-sm text-muted-foreground">{" "}{t("designGuide.d0013")}{" "}</p>
        <CollectionToolbar
          context={<span className="text-sm font-medium">{t("designGuide.d0014")}</span>}
          search={<Input aria-label={t("designGuide.d0015")} placeholder={t("designGuide.d0016")} />}
          controls={<Button variant="outline" size="sm">{t("designGuide.d0017")}</Button>}
          actions={<Button size="sm">{t("designGuide.d0018")}</Button>}
          feedback={<span className="text-xs text-muted-foreground">{t("designGuide.d0019")}</span>}
        />
        <div className="overflow-hidden rounded-lg border border-border">
          <IssueRow
            issue={localizedDesignGuideTask}
            presentation="task"
            unreadState="visible"
            metadata={<span className="text-xs text-muted-foreground">{t("designGuide.d0020")}</span>}
            actions={<Button variant="ghost" size="xs">{t("designGuide.d0021")}</Button>}
          />
        </div>
      </Section>

      <Section title={t("designGuide.d0022")}>
        <SubSection title={t("designGuide.d0023")}>
          <div className="flex max-w-sm flex-col items-start gap-3">
            <ThemeToggle />
            <ThemeToggle variant="menu-action" />
            <ThemeToggle variant="compact-menu-action" />
          </div>
        </SubSection>
      </Section>

      <Section title={t("designGuide.d0024")}>
        <SubSection title={t("designGuide.d0023")}>
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
      <Section title={t("designGuide.d0025")}>
        <SubSection title={t("designGuide.d0026")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.d0027")} cssVar="--background" />
            <Swatch name={t("designGuide.d0028")} cssVar="--foreground" />
            <Swatch name={t("designGuide.d0029")} cssVar="--card" />
            <Swatch name={t("designGuide.d0030")} cssVar="--primary" />
            <Swatch name={t("designGuide.d0031")} cssVar="--primary-foreground" />
            <Swatch name={t("designGuide.d0032")} cssVar="--secondary" />
            <Swatch name={t("designGuide.d0033")} cssVar="--muted" />
            <Swatch name={t("designGuide.d0034")} cssVar="--muted-foreground" />
            <Swatch name={t("designGuide.d0035")} cssVar="--accent" />
            <Swatch name={t("designGuide.d0036")} cssVar="--destructive" />
            <Swatch name={t("designGuide.d0037")} cssVar="--border" />
            <Swatch name={t("designGuide.d0038")} cssVar="--ring" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0039")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.d0039")} cssVar="--sidebar" />
            <Swatch name={t("designGuide.d0040")} cssVar="--sidebar-border" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0041")}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Swatch name={t("designGuide.d0042")} cssVar="--chart-1" />
            <Swatch name={t("designGuide.d0043")} cssVar="--chart-2" />
            <Swatch name={t("designGuide.d0044")} cssVar="--chart-3" />
            <Swatch name={t("designGuide.d0045")} cssVar="--chart-4" />
            <Swatch name={t("designGuide.d0046")} cssVar="--chart-5" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TYPOGRAPHY                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0047")}>
        <TaskChatRunnerActivityGroup item={{ id: "design-runner-activity", kind: "activity_phase", active: true, summary: "", interstitial: { id: "design-runner-commentary", kind: "message", author: "agent", text: t("designGuide.extra35"), interstitial: true }, items: [
          { id: "design-runner-read", kind: "tool", name: "read", target: "TaskChatRunnerTurn.tsx", status: "completed", detail: t("designGuide.runnerFound") },
          { id: "design-runner-check", kind: "tool", name: "exec_command", target: "pnpm check:token-gates", status: "in_progress" },
        ] }} />
        <TaskChatRunnerActivityGroup item={{ id: "design-runner-completed", kind: "activity_phase", active: false, summary: "", items: [
          { id: "design-completed-read", kind: "tool", name: "read", target: "TaskChatRunnerTurn.tsx", status: "completed", detail: t("designGuide.runnerRead") },
          { id: "design-completed-check", kind: "tool", name: "exec_command", target: "pnpm check:token-gates", status: "failed", detail: t("designGuide.runnerToken") },
        ] }} />
      </Section>

      <Section title={t("designGuide.d0048")}>
        <div className="space-y-3">
          <h2 className="text-xl font-bold">{t("designGuide.d0049")}</h2>
          <h2 className="text-lg font-semibold">{t("designGuide.d0050")}</h2>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{" "}{t("designGuide.d0051")}{" "}</h3>
          <p className="text-sm font-medium">{t("designGuide.d0052")}</p>
          <p className="text-sm font-semibold">{t("designGuide.d0053")}</p>
          <p className="text-sm">{t("designGuide.d0054")}</p>
          <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0055")}{" "}</p>
          <p className="text-xs text-muted-foreground">{" "}{t("designGuide.d0056")}{" "}</p>
          <p className="text-sm font-mono text-muted-foreground">{" "}{t("designGuide.d0057")}{" "}</p>
          <p className="text-2xl font-bold">{t("designGuide.d0058")}</p>
          <p className="font-mono text-xs">{t("designGuide.d0059")}</p>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SPACING & RADIUS                                             */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0060")}>
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
      <Section title={t("designGuide.d0061")}>
        <SubSection title={t("designGuide.d0023")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="default">{t("designGuide.d0062")}</Button>
            <Button variant="secondary">{t("designGuide.d0032")}</Button>
            <Button variant="outline">{t("designGuide.d0063")}</Button>
            <Button variant="ghost">{t("designGuide.d0064")}</Button>
            <Button variant="destructive">{t("designGuide.d0036")}</Button>
            <Button variant="link">{t("designGuide.d0065")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0066")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="xs">{t("designGuide.d0067")}</Button>
            <Button size="sm">{t("designGuide.d0068")}</Button>
            <Button size="default">{t("designGuide.d0062")}</Button>
            <Button size="lg">{t("designGuide.d0069")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0070")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="icon-xs"><Search /></Button>
            <Button variant="ghost" size="icon-sm"><Search /></Button>
            <Button variant="outline" size="icon"><Search /></Button>
            <Button variant="outline" size="icon-lg"><Search /></Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0071")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button><Plus />{" "}{t("designGuide.d0072")}</Button>
            <Button variant="outline"><Upload />{" "}{t("designGuide.d0073")}</Button>
            <Button variant="destructive"><Trash2 />{" "}{t("designGuide.d0074")}</Button>
            <Button size="sm"><Plus />{" "}{t("designGuide.d0075")}</Button>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0076")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Button disabled>{t("designGuide.d0077")}</Button>
            <Button variant="outline" disabled>{t("designGuide.d0078")}</Button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  BADGES                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0079")}>
        <SubSection title={t("designGuide.d0023")}>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default">{t("designGuide.d0062")}</Badge>
            <Badge variant="secondary">{t("designGuide.d0032")}</Badge>
            <Badge variant="outline">{t("designGuide.d0063")}</Badge>
            <Badge variant="destructive">{t("designGuide.d0036")}</Badge>
            <Badge variant="ghost">{t("designGuide.d0064")}</Badge>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  STATUS BADGES & ICONS                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0080")}>
        <SubSection title={t("designGuide.d0081")}>
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

        <SubSection title={t("designGuide.d0082")}>
          <div className="flex items-center gap-2 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "blocked", "cancelled"].map(
              (s) => (
                <IssueStatusBadge key={s} status={s} />
              )
            )}
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0083")}>
          <StatusIcon status="in_review" externalConversationState="waiting" showLabel />
          <IssueStatusBadge status="in_review" externalConversationState="waiting" />
        </SubSection>
        <SubSection title={t("designGuide.d0084")}>
          <div className="flex items-center gap-3 flex-wrap">
            {["backlog", "todo", "in_progress", "in_review", "done", "cancelled", "blocked"].map(
              (s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <StatusIcon status={s} />
                  <span className="text-xs text-muted-foreground">{statusLabels[s] ?? s}</span>
                </div>
              )
            )}
          </div>
          <div className="flex items-center gap-2 mt-2">
            <StatusIcon status={status} onChange={setStatus} />
            <span className="text-sm">{t("designGuide.d0085")}{" "}{statusLabels[status] ?? status})</span>
          </div>
        </SubSection>

        {/* PAP-411: PriorityIcon showcase gated behind SHOW_TASK_PRIORITY_UI per board decision. */}
        {SHOW_TASK_PRIORITY_UI && (
        <SubSection title={t("designGuide.d0086")}>
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
            <span className="text-sm">{t("designGuide.d0087")}{" "}{statusLabels[priority] ?? priority})</span>
          </div>
        </SubSection>
        )}

        <SubSection title={t("designGuide.d0088")}>
          <div className="flex items-center gap-4 flex-wrap">
            {(["running", "active", "paused", "error", "archived"] as const).map((label) => (
              <div key={label} className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`inline-flex h-full w-full rounded-full ${agentStatusDot[label] ?? agentStatusDotDefault}`} />
                </span>
                <span className="text-xs text-muted-foreground">{statusLabels[label] ?? label}</span>
              </div>
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0089")}>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              ["timer", "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"],
              ["assignment", "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300"],
              ["on_demand", "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"],
              ["automation", "bg-muted text-muted-foreground"],
            ].map(([label, cls]) => (
              <Badge variant="ghost" key={label} className={`px-1.5 text-(length:--text-nano) ${cls}`}>
                {statusLabels[label] ?? label}
              </Badge>
            ))}
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0090")}>
          <p className="text-xs text-muted-foreground">{" "}{t("designGuide.d0091")}{" "}<code className="font-mono">status</code>{" "}{t("designGuide.d0092")}{" "}<code className="font-mono">variant="property"</code>{" "}{t("designGuide.d0093")}{" "}<code className="font-mono">onRemove</code>{" "}{t("designGuide.d0094")}{" "}<code className="font-mono">strikethrough</code>{" "}{t("designGuide.d0095")}{" "}</p>
          <div className="flex items-center gap-2 flex-wrap">
            <IssueReferencePill issue={{ id: "demo-1", identifier: "PAP-123", title: t("designGuide.extra31") }} />
            <IssueReferencePill issue={{ id: "demo-2", identifier: "PAP-456", title: t("designGuide.extra32"), status: "in_progress" }} />
            <IssueReferencePill issue={{ id: "demo-3", identifier: "PAP-789", title: t("designGuide.doneStatusTitle"), status: "done" }} />
            <IssueReferencePill issue={{ id: "demo-4", identifier: "PAP-101", title: t("designGuide.blockedStatusTitle"), status: "blocked" }} />
            <IssueReferencePill onRemove={() => window.alert(t("designGuide.blockerRemoved"))} issue={{ id: "demo-blocker", identifier: "PAP-303", title: t("designGuide.removeBlockerTitle"), status: "in_review" }} />
            <IssueReferencePill strikethrough issue={{ id: "demo-5", identifier: "PAP-202", title: t("designGuide.removedTitle"), status: "todo" }} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  AGENT CAPSULE                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0096")}>
        <p className="text-sm text-muted-foreground max-w-prose">{" "}{t("designGuide.d0097")}<code className="font-mono">--agent-Na</code> →{" "}
          <code className="font-mono">--agent-Nb</code>); <code className="font-mono">prefers-reduced-motion</code>{" "}{" "}{t("designGuide.d0098")}{" "}</p>
        <SubSection title={t("designGuide.d0076")}>
          <div className="flex items-end gap-10">
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="slot" />
              <span className="text-xs text-muted-foreground">{t("designGuide.d0099")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="configured" />
              <span className="text-xs text-muted-foreground">{t("designGuide.d0100")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" gradient={5} />
              <span className="text-xs text-muted-foreground">{t("designGuide.d0101")}</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" gradient={5} glow="blue" />
              <span className="text-xs text-muted-foreground">{t("designGuide.d0102")}</span>
            </div>
          </div>
        </SubSection>
        <SubSection title={t("designGuide.d0066")}>
          <div className="flex items-end gap-8">
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="sm" gradient={1} />
              <span className="text-xs text-muted-foreground">sm</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="md" gradient={4} />
              <span className="text-xs text-muted-foreground">md</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size="lg" gradient={8} />
              <span className="text-xs text-muted-foreground">lg</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <AgentCapsule state="online" size={{ width: 28, height: 96 }} gradient={6} />
              <span className="text-xs text-muted-foreground">{t("designGuide.extra62")}</span>
            </div>
          </div>
        </SubSection>
        <SubSection title={t("designGuide.d0103")}>
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
      <Section title={t("designGuide.d0104")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.d0105")}>
            <Input placeholder={t("designGuide.d0106")} />
            <Input placeholder={t("designGuide.d0107")} disabled className="mt-2" />
          </SubSection>

          <SubSection title={t("designGuide.d0108")}>
            <Textarea placeholder={t("designGuide.d0109")} />
          </SubSection>

          <SubSection title={t("designGuide.d0110")}>
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Checkbox id="check1" defaultChecked />
                <Label htmlFor="check1">{t("designGuide.d0111")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check2" />
                <Label htmlFor="check2">{t("designGuide.d0112")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="check3" disabled />
                <Label htmlFor="check3">{t("designGuide.d0113")}</Label>
              </div>
            </div>
          </SubSection>

          <SubSection title={t("designGuide.d0114")}>
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.d0115")}</p>
                <InlineEditor
                  value={inlineTitle}
                  onSave={setInlineTitle}
                  as="h2"
                  className="text-xl font-bold"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.d0116")}</p>
                <InlineEditor
                  value={inlineText}
                  onSave={setInlineText}
                  as="p"
                  className="text-sm"
                />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">{t("designGuide.d0117")}</p>
                <InlineEditor
                  value={inlineDesc}
                  onSave={setInlineDesc}
                  as="p"
                  className="text-sm text-muted-foreground"
                  placeholder={t("designGuide.d0118")}
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
      <Section title={t("designGuide.d0119")}>
        <div className="grid gap-6 md:grid-cols-2">
          <SubSection title={t("designGuide.d0120")}>
            <Select value={selectValue} onValueChange={setSelectValue}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("designGuide.d0121")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="backlog">{t("designGuide.d0122")}</SelectItem>
                <SelectItem value="todo">{t("designGuide.d0123")}</SelectItem>
                <SelectItem value="in_progress">{t("designGuide.d0124")}</SelectItem>
                <SelectItem value="in_review">{t("designGuide.d0125")}</SelectItem>
                <SelectItem value="done">{t("designGuide.d0126")}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{t("designGuide.d0127")}{" "}{selectValue}</p>
          </SubSection>
          <SubSection title={t("designGuide.d0128")}>
            <Select defaultValue="high">
              <SelectTrigger size="sm" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="critical">{t("designGuide.d0129")}</SelectItem>
                <SelectItem value="high">{t("designGuide.d0130")}</SelectItem>
                <SelectItem value="medium">{t("designGuide.d0131")}</SelectItem>
                <SelectItem value="low">{t("designGuide.d0132")}</SelectItem>
              </SelectContent>
            </Select>
          </SubSection>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DROPDOWN MENU                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0133")}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">{" "}{t("designGuide.d0134")}{" "}<ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuItem>
              <Check className="h-4 w-4" />{" "}{t("designGuide.d0135")}{" "}<DropdownMenuShortcut>⌘D</DropdownMenuShortcut>
            </DropdownMenuItem>
            <DropdownMenuItem>
              <BookOpen className="h-4 w-4" />{" "}{t("designGuide.d0136")}{" "}</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuCheckboxItem
              checked={menuChecked}
              onCheckedChange={(value) => setMenuChecked(value === true)}
            >{" "}{t("designGuide.d0137")}{" "}</DropdownMenuCheckboxItem>
            <DropdownMenuItem variant="destructive">
              <Trash2 className="h-4 w-4" />{" "}{t("designGuide.d0138")}{" "}</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Section>

      {/* ============================================================ */}
      {/*  POPOVER                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0139")}>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">{t("designGuide.d0140")}</Button>
          </PopoverTrigger>
          <PopoverContent className="space-y-2">
            <p className="text-sm font-medium">{t("designGuide.d0141")}</p>
            <p className="text-xs text-muted-foreground">{" "}{t("designGuide.d0142")}{" "}</p>
            <Button size="xs">{t("designGuide.d0143")}</Button>
          </PopoverContent>
        </Popover>
      </Section>

      {/* ============================================================ */}
      {/*  COLLAPSIBLE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0144")}>
        <Collapsible open={collapsibleOpen} onOpenChange={setCollapsibleOpen} className="space-y-2">
          <CollapsibleTrigger asChild>
            <Button variant="outline" size="sm">
              {collapsibleOpen ? t("designGuide.hide") : t("designGuide.show")}{" "}{t("designGuide.d0145")}{" "}</Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="rounded-md border border-border p-3">
            <div className="space-y-2">
              <Label htmlFor="owner-filter">{t("designGuide.d0146")}</Label>
              <Input id="owner-filter" placeholder={t("designGuide.d0147")} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Section>

      {/* ============================================================ */}
      {/*  SHEET                                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0148")}>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm">{t("designGuide.d0149")}</Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle>{t("designGuide.d0150")}</SheetTitle>
              <SheetDescription>{t("designGuide.d0151")}</SheetDescription>
            </SheetHeader>
            <div className="space-y-4 px-4">
              <div className="space-y-1">
                <Label htmlFor="sheet-title">{t("designGuide.d0152")}</Label>
                <Input id="sheet-title" defaultValue={t("designGuide.extra02")} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="sheet-description">{t("designGuide.d0153")}</Label>
                <Textarea id="sheet-description" defaultValue={t("designGuide.extra03")} />
              </div>
            </div>
            <SheetFooter>
              <Button variant="outline">{t("designGuide.d0154")}</Button>
              <Button>{t("designGuide.d0155")}</Button>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </Section>

      {/* ============================================================ */}
      {/*  SCROLL AREA                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0156")}>
        <ScrollArea className="h-36 rounded-md border border-border">
          <div className="space-y-2 p-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} className="rounded-md border border-border p-2 text-sm">{" "}{t("designGuide.d0157")}{i + 1}{t("designGuide.d0158")}{" "}</div>
            ))}
          </div>
        </ScrollArea>
      </Section>

      {/* ============================================================ */}
      {/*  COMMAND                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0159")}>
        <div className="rounded-md border border-border">
          <Command>
            <CommandInput placeholder={t("designGuide.d0160")} />
            <CommandList>
              <CommandEmpty>{t("designGuide.d0161")}</CommandEmpty>
              <CommandGroup heading={t("designGuide.d0162")}>
                <CommandItem>
                  <LayoutDashboard className="h-4 w-4" />{" "}{t("designGuide.d0163")}{" "}</CommandItem>
                <CommandItem>
                  <CircleDot className="h-4 w-4" />{" "}{t("designGuide.d0164")}{" "}</CommandItem>
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading={t("designGuide.d0165")}>
                <CommandItem>
                  <CommandIcon className="h-4 w-4" />{" "}{t("designGuide.d0166")}{" "}</CommandItem>
                <CommandItem>
                  <Plus className="h-4 w-4" />{" "}{t("designGuide.d0167")}{" "}</CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  BREADCRUMB                                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0168")}>
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designGuide.d0169")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="#">{t("designGuide.d0170")}</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbPage>{t("designGuide.d0171")}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
      </Section>

      {/* ============================================================ */}
      {/*  CARDS                                                        */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0172")}>
        <SubSection title={t("designGuide.d0173")}>
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
                issue={{ identifier: "PAP-559", title: t("designGuide.extra01"), status: status === "succeeded" ? "done" : "in_progress" }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{t("designGuide.d0174")}</p>
        </SubSection>
        <SubSection title={t("designGuide.d0175")}>
          <Card>
            <CardHeader>
              <CardTitle>{t("designGuide.d0176")}</CardTitle>
              <CardDescription>{t("designGuide.d0177")}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{t("designGuide.d0178")}</p>
            </CardContent>
            <CardFooter className="gap-2">
              <Button size="sm">{t("designGuide.d0179")}</Button>
              <Button variant="outline" size="sm">{t("designGuide.d0154")}</Button>
            </CardFooter>
          </Card>
        </SubSection>

        <SubSection title={t("designGuide.d0180")}>
          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
            <MetricCard icon={Bot} value={12} label={t("designGuide.d0181")} description={t("designGuide.d0182")} />
            <MetricCard icon={CircleDot} value={48} label={t("designGuide.d0183")} />
            <MetricCard icon={DollarSign} value="$1,234" label={t("designGuide.d0184")} description={t("designGuide.d0185")} />
            <MetricCard icon={Zap} value="99.9%" label={t("designGuide.d0186")} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TABS                                                         */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0187")}>
        <SubSection title={t("designGuide.d0188")}>
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">{t("designGuide.d0189")}</TabsTrigger>
              <TabsTrigger value="runs">{t("designGuide.d0190")}</TabsTrigger>
              <TabsTrigger value="config">{t("designGuide.d0191")}</TabsTrigger>
              <TabsTrigger value="costs">{t("designGuide.d0192")}</TabsTrigger>
            </TabsList>
            <TabsContent value="overview">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0193")}</p>
            </TabsContent>
            <TabsContent value="runs">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0194")}</p>
            </TabsContent>
            <TabsContent value="config">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0195")}</p>
            </TabsContent>
            <TabsContent value="costs">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0196")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>

        <SubSection title={t("designGuide.d0197")}>
          <Tabs defaultValue="summary">
            <TabsList variant="line">
              <TabsTrigger value="summary">{t("designGuide.d0198")}</TabsTrigger>
              <TabsTrigger value="details">{t("designGuide.d0199")}</TabsTrigger>
              <TabsTrigger value="comments">{t("designGuide.d0200")}</TabsTrigger>
            </TabsList>
            <TabsContent value="summary">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0201")}</p>
            </TabsContent>
            <TabsContent value="details">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0202")}</p>
            </TabsContent>
            <TabsContent value="comments">
              <p className="text-sm text-muted-foreground py-4">{t("designGuide.d0203")}</p>
            </TabsContent>
          </Tabs>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  ENTITY ROWS                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0204")}>
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
            title={t("designGuide.extra04")}
            subtitle={t("designGuide.extra05")}
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
            title={t("designGuide.extra06")}
            subtitle={t("designGuide.extra07")}
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
            title={t("designGuide.extra08")}
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
            title={t("designGuide.extra09")}
            subtitle={t("designGuide.extra10")}
            trailing={<IssueStatusBadge status="blocked" />}
            selected
          />
        </div>
        <SubSection title={t("designGuide.d0205")}>
          <div className="border border-border rounded-md">
            <EntityRow
              title={t("designGuide.extra11")}
              subtitle={t("designGuide.extra12")}
              className="group"
              trailing={
                <MembershipAction
                  state="joined"
                  resourceName={t("designGuide.d0206")}
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designGuide.extra13")}
              subtitle={t("designGuide.extra14")}
              className="group text-foreground/55"
              trailing={
                <MembershipAction
                  state="left"
                  resourceName={t("designGuide.d0207")}
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designGuide.extra15")}
              subtitle={t("designGuide.extra16")}
              className="group text-foreground/55"
              trailing={
                <MembershipAction
                  state="left"
                  pending
                  pendingState="left"
                  resourceName={t("designGuide.d0208")}
                  onJoin={() => {}}
                  onLeave={() => {}}
                />
              }
            />
            <EntityRow
              title={t("designGuide.extra17")}
              subtitle={t("designGuide.extra18")}
              className="group"
              trailing={
                <MembershipAction
                  state="joined"
                  pending
                  pendingState="joined"
                  resourceName={t("designGuide.d0209")}
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
      <Section title={t("designGuide.d0210")}>
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
                { key: "status", label: t("designGuide.d0241"), value: t("designGuide.active") },
                // PAP-411: priority filter demo row suppressed while SHOW_TASK_PRIORITY_UI is off.
                ...(SHOW_TASK_PRIORITY_UI
                  ? [{ key: "priority", label: t("designGuide.d0242"), value: t("designGuide.d0130") } as FilterValue]
                  : []),
              ])
            }
          >{" "}{t("designGuide.d0211")}{" "}</Button>
        )}
      </Section>

      {/* ============================================================ */}
      {/*  AVATARS                                                      */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0212")}>
        <SubSection title={t("designGuide.d0066")}>
          <div className="flex items-center gap-3">
            <Avatar size="sm"><AvatarFallback>SM</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>DF</AvatarFallback></Avatar>
            <Avatar size="lg"><AvatarFallback>LG</AvatarFallback></Avatar>
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0213")}>
          <AvatarGroup>
            <Avatar><AvatarFallback>A1</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A2</AvatarFallback></Avatar>
            <Avatar><AvatarFallback>A3</AvatarFallback></Avatar>
            <AvatarGroupCount>+5</AvatarGroupCount>
          </AvatarGroup>
        </SubSection>
      </Section>

      <Section title={t("designGuide.d0214")}>
        <SubSection title={t("designGuide.d0215")}>
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
      <Section title={t("designGuide.d0216")}>
        <SubSection title={t("designGuide.d0217")}>
          <div className="flex flex-wrap gap-3">{AGENT_PALETTE_IDS.map(palette => <AgentAvatar key={palette} appearance={appearanceForPalette(palette)} size={48} label={palette} />)}</div>
        </SubSection>
        <SubSection title={t("designGuide.d0218")}>
          <p className="text-sm text-muted-foreground">{t("designGuide.d0219")}</p>
          <div className="flex gap-4"><AgentCharacter muted state="sleepy" motion="still" size={128} /><AgentCharacter size={128} /></div>
        </SubSection>
      </Section>
      <Section title={t("designGuide.d0220")}>
        <SubSection title={t("designGuide.d0066")}>
          <div className="flex items-center gap-6">
            <Identity name="Alex Morgan" size="sm" />
            <Identity name="Alex Morgan" />
            <Identity name="Alex Morgan" size="lg" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0221")}>
          <div className="flex flex-col gap-2">
            <Identity name="Casey Jordan" size="sm" />
            <Identity name="Alpha" size="sm" />
            <Identity name="Quinn Lee" size="sm" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0222")}>
          <Identity name={t("designGuide.extra36")} initials="BS" size="sm" />
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLTIPS                                                     */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0223")}>
        <div className="flex items-center gap-4">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">{t("designGuide.d0224")}</Button>
            </TooltipTrigger>
            <TooltipContent>{t("designGuide.d0225")}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon-sm"><Settings /></Button>
            </TooltipTrigger>
            <TooltipContent>{t("designGuide.d0226")}</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  DIALOG                                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0227")}>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">{t("designGuide.d0228")}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("designGuide.d0229")}</DialogTitle>
              <DialogDescription>{" "}{t("designGuide.d0230")}{" "}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("designGuide.d0231")}</Label>
                <Input placeholder={t("designGuide.d0232")} className="mt-1.5" />
              </div>
              <div>
                <Label>{t("designGuide.d0153")}</Label>
                <Textarea placeholder={t("designGuide.d0233")} className="mt-1.5" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline">{t("designGuide.d0154")}</Button>
              <Button>{t("designGuide.d0155")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </Section>

      {/* ============================================================ */}
      {/*  EMPTY STATE                                                  */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0234")}>
        <div className="border border-border rounded-md">
          <EmptyState
            icon={Inbox}
            message={t("designGuide.d0235")}
            action={t("designGuide.d0236")}
            onAction={() => {}}
          />
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROGRESS BARS                                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0237")}>
        <div className="space-y-3">
          {[
            { label: t("designGuide.underBudget"), pct: 40, color: "bg-green-400" },
            { label: t("designGuide.budgetWarning"), pct: 75, color: "bg-yellow-400" },
            { label: t("designGuide.overBudget"), pct: 95, color: "bg-red-400" },
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
      <Section title={t("designGuide.d0238")}>
        <div className="bg-neutral-950 rounded-lg p-3 font-mono text-xs max-h-80 overflow-y-auto">
          <div className="text-foreground">[12:00:01] INFO  {t("designGuide.extra21")}</div>
          <div className="text-foreground">[12:00:02] INFO  {t("designGuide.extra22")} PAP-001</div>
          <div className="text-yellow-400">[12:00:05] WARN  {t("designGuide.extra23")}</div>
          <div className="text-foreground">[12:00:08] INFO  {t("designGuide.extra24")} PAP-001</div>
          <div className="text-red-400">[12:00:12] ERROR {t("designGuide.extra25")}</div>
          <div className="text-blue-300">[12:00:12] SYS   {t("designGuide.extra26")}</div>
          <div className="text-foreground">[12:00:17] INFO  {t("designGuide.extra27")}</div>
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-blue-400 animate-pulse" />
              <span className="inline-flex h-full w-full rounded-full bg-blue-500" />
            </span>
            <span className="text-blue-600 dark:text-blue-400">{t("designGuide.d0239")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  PROPERTY ROW PATTERN                                         */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0240")}>
        <div className="border border-border rounded-md p-4 space-y-1 max-w-sm">
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.d0241")}</span>
            <StatusBadge status="active" />
          </div>
          {/* PAP-411: priority metadata row hidden behind SHOW_TASK_PRIORITY_UI. */}
          {SHOW_TASK_PRIORITY_UI && (
            <div className="flex items-center justify-between py-1.5">
              <span className="text-xs text-muted-foreground">{t("designGuide.d0242")}</span>
              <PriorityIcon priority="high" />
            </div>
          )}
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.d0243")}</span>
            <div className="flex items-center gap-1.5">
              <Avatar size="sm"><AvatarFallback>A</AvatarFallback></Avatar>
              <span className="text-xs">{t("designGuide.d0244")}</span>
            </div>
          </div>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-xs text-muted-foreground">{t("designGuide.d0245")}</span>
            <span className="text-xs">{t("designGuide.d0246")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  NAVIGATION PATTERNS                                          */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0247")}>
        <SubSection title={t("designGuide.d0248")}>
          <p className="text-sm text-muted-foreground">{t("designGuide.d0249")}</p>
          <RemoteMcpDesignExample />
        </SubSection>
        <SubSection title={t("designGuide.d0250")}>
          <p className="text-sm text-muted-foreground">{t("designGuide.d0251")}</p>
          <div className="max-w-sm space-y-6">
            <SetupWizardNavigation inline labels={[t("designGuide.chooseTrigger"), t("designGuide.configure"), t("designGuide.review")]} step={wizardStep} availableStep={2} onSelect={setWizardStep} />
            <SetupWizardFooter onSaveExit={() => setWizardStep(0)}><Button onClick={() => setWizardStep((wizardStep + 1) % 3)}>{t("designGuide.d0252")}</Button></SetupWizardFooter>
          </div>
        </SubSection>
        <SubSection title={t("designGuide.d0253")}>
          <AgentChatPickerExample />
        </SubSection>
        <SubSection title={t("designGuide.d0254")}>
          <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0255")}{" "}</p>
          <Card className="block w-60 p-3 space-y-0.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium bg-accent text-accent-foreground">
              <LayoutDashboard className="h-4 w-4" />{" "}{t("designGuide.d0163")}{" "}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <CircleDot className="h-4 w-4" />{" "}{t("designGuide.d0164")}{" "}<Badge variant="ghost" className="ml-auto bg-primary text-primary-foreground px-1.5">
                12
              </Badge>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Bot className="h-4 w-4" />{" "}{t("designGuide.d0256")}{" "}</div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground cursor-pointer">
              <Hexagon className="h-4 w-4" />{" "}{t("designGuide.d0169")}{" "}</div>
          </Card>
        </SubSection>

        <SubSection title={t("designGuide.d0257")}>
          <div className="flex items-center border border-border rounded-md w-fit">
            <button className="px-3 py-1.5 text-xs font-medium bg-accent text-foreground rounded-l-md">
              <ListTodo className="h-3.5 w-3.5 inline mr-1" />{" "}{t("designGuide.d0258")}{" "}</button>
            <button className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent/50 rounded-r-md">
              <Target className="h-3.5 w-3.5 inline mr-1" />{" "}{t("designGuide.d0259")}{" "}</button>
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  GROUPED LIST (Issues pattern)                                */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0260")}>
        <div>
          <div className="flex items-center gap-2 px-4 py-2 bg-muted/50 rounded-t-md">
            <StatusIcon status="in_progress" />
            <span className="text-sm font-medium">{t("designGuide.d0124")}</span>
            <span className="text-xs text-muted-foreground ml-1">2</span>
          </div>
          <div className="border border-border rounded-b-md">
            {/* PAP-411: leading PriorityIcon hidden behind SHOW_TASK_PRIORITY_UI. */}
            <EntityRow
              leading={SHOW_TASK_PRIORITY_UI ? <PriorityIcon priority="high" /> : undefined}
              identifier="PAP-101"
              title={t("designGuide.extra19")}
              onClick={() => {}}
            />
            <EntityRow
              leading={SHOW_TASK_PRIORITY_UI ? <PriorityIcon priority="medium" /> : undefined}
              identifier="PAP-102"
              title={t("designGuide.extra20")}
              onClick={() => {}}
            />
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COMMENT THREAD PATTERN                                       */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0261")}>
        <div className="space-y-3 max-w-2xl">
          <h3 className="text-sm font-semibold">{t("designGuide.d0262")}</h3>
          <div className="space-y-3">
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designGuide.d0263")}</span>
                <span className="text-xs text-muted-foreground">{t("designGuide.d0246")}</span>
              </div>
                <p className="text-sm">{t("designGuide.extra38")}</p>
            </div>
            <div className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">{t("designGuide.d0264")}</span>
                <span className="text-xs text-muted-foreground">{t("designGuide.d0265")}</span>
              </div>
                <p className="text-sm">{t("designGuide.extra39")}</p>
            </div>
          </div>
          <div className="space-y-2">
            <Textarea placeholder={t("designGuide.d0266")} rows={3} />
            <Button size="sm">{t("designGuide.d0267")}</Button>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  COST TABLE PATTERN                                           */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0268")}>
        <div className="border border-border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="border-b border-border bg-accent/20">
              <tr>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.d0269")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.d0270")}</th>
                <th className="text-left px-3 py-2 font-medium text-muted-foreground">{t("designGuide.d0271")}</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border">
                <td className="px-3 py-2">claude-sonnet-4-20250514</td>
                <td className="px-3 py-2 font-mono">1.2M</td>
                <td className="px-3 py-2 font-mono">$18.00</td>
              </tr>
              <tr className="border-b border-border">
                <td className="px-3 py-2">claude-haiku-4-20250506</td>
                <td className="px-3 py-2 font-mono">500k</td>
                <td className="px-3 py-2 font-mono">$1.25</td>
              </tr>
              <tr>
                <td className="px-3 py-2 font-medium">{t("designGuide.d0272")}</td>
                <td className="px-3 py-2 font-mono">1.7M</td>
                <td className="px-3 py-2 font-mono font-medium">$19.25</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  SKELETONS                                                    */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0273")}>
        <SubSection title={t("designGuide.d0274")}>
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-8 w-full max-w-sm" />
            <Skeleton className="h-20 w-full" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0275")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="list" />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0276")}>
          <div className="border border-border rounded-md p-4">
            <PageSkeleton variant="detail" />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  SEPARATOR                                                    */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0277")}>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t("designGuide.d0278")}</p>
          <Separator />
          <div className="flex items-center gap-4 h-8">
            <span className="text-sm">{t("designGuide.d0279")}</span>
            <Separator orientation="vertical" />
            <span className="text-sm">{t("designGuide.d0280")}</span>
          </div>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  ICON REFERENCE                                               */}
      {/* ============================================================ */}
      {/*  TEAM CATALOG                                                 */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0281")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0282")}<code className="font-mono text-xs">/teams-catalog</code>{t("designGuide.d0283")}{" "}</p>

        <SubSection title={t("designGuide.d0284")}>
          <div className="w-(--sz-28rem) rounded-md border border-border">
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">{" "}{t("designGuide.d0285")}{" "}</div>
            <TeamRow team={sampleTeam} selected onSelect={() => {}} />
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">{" "}{t("designGuide.d0286")}{" "}</div>
            <TeamRow team={optionalTeam} selected={false} onSelect={() => {}} />
            <div className="px-3 py-2 text-(length:--text-micro) font-semibold uppercase tracking-wide text-muted-foreground">{" "}{t("designGuide.d0287")}{" "}</div>
            <TeamRow team={sampleTeam} selected={false} onSelect={() => {}} installed={outOfDateInstalledState} />
            <TeamRow team={warnTeam} selected={false} onSelect={() => {}} installed={currentInstalledState} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0288")}{" "}<code className="font-mono">INSTALLED · N</code>{t("designGuide.d0289")}{" "}<code className="font-mono">originHash</code>{" "}{t("designGuide.d0290")}{" "}<code className="font-mono">contentHash</code>{t("designGuide.d0291")}{" "}<code className="font-mono">↑</code>{" "}{t("designGuide.d0292")}{" "}</p>
        </SubSection>

        <SubSection title={t("designGuide.d0293")}>
          <p className="text-xs text-muted-foreground">{" "}{t("designGuide.d0294")}{" "}
            <code className="font-mono">ring-2 ring-ring</code>{t("designGuide.d0295")}{" "}
            <code className="font-mono">useInstallTeamCatalogEntry</code>{" "}{t("designGuide.d0296")}{" "}</p>
          <TeamCardShowcase />
        </SubSection>

        <SubSection title={t("designGuide.d0297")}>
          <div className="max-w-md">
            <TeamHierarchyPreview team={sampleTeam} />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0298")}>
          <div className="max-w-xl">
            <RequiredSkillsList skills={sampleTeam.requiredSkills} />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0299")}>
          <div className="max-w-xl">
            <EnvInputsList inputs={sampleTeam.envInputs} />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0300")}>
          <div className="max-w-xl">
            <ExternalSourcesList sources={sampleTeam.sourceRefs} />
          </div>
        </SubSection>

        <SubSection title={t("designGuide.d0301")}>
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

        <SubSection title={t("designGuide.d0302")}>
          <div className="max-w-xl rounded-md border border-border p-4">
            <StepSkillPlan team={sampleTeam} preparations={sampleSkillPreparations} />
          </div>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      <Section title={t("designGuide.d0303")}>
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
      <Section title={t("designGuide.d0304")}>
        <div className="border border-border rounded-md divide-y divide-border text-sm">
          {[
            ["Cmd+K / Ctrl+K", t("designGuide.shortcutCommand")],
            ["C", t("designGuide.shortcutNew")],
            ["[", t("designGuide.shortcutSidebar")],
            ["]", t("designGuide.shortcutProperties")],

            ["Cmd+Enter / Ctrl+Enter", t("designGuide.shortcutComment")],
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

      <Section title={t("designGuide.d0305")}>
        <SubSection title={t("designGuide.d0306")}>
          <IssueOutputSection workProducts={DESIGN_GUIDE_OUTPUTS} />
        </SubSection>
        <SubSection title={t("designGuide.d0307")}>
          <IssueOutputSection workProducts={DESIGN_GUIDE_DEGRADED_OUTPUTS} />
        </SubSection>
        <SubSection title={t("designGuide.d0308")}>
          <p className="text-xs text-muted-foreground">{" "}{t("designGuide.d0309")}{" "}</p>
        </SubSection>
      </Section>

      {/* ============================================================ */}
      {/*  TOOLS & ACCESS (PAP-10389)                                   */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0310")}>
        <SubSection title={t("designGuide.d0311")}>
          <div className="space-y-3">
            <EnforcementBanner companyId="" forceVariant="default" recentDenialCount={0} />
            <EnforcementBanner companyId="" forceVariant="denied-detected" recentDenialCount={3} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0312")}{" "}<code>denied-detected</code>{" "}{t("designGuide.d0313")}{" "}</p>
        </SubSection>

        <SubSection title={t("designGuide.d0314")}>
          <div className="space-y-3">
            <EnforcementBanner
              tone="info"
              title={t("designGuide.d0315")}
              body={t("designGuide.d0316")}
            />
            <EnforcementBanner
              tone="warning"
              title={t("designGuide.d0317")}
              body={t("designGuide.d0318")}
            />
            <EnforcementBanner
              tone="error"
              title={t("designGuide.d0319")}
              body={t("designGuide.d0320")}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0321")}{" "}<code>title</code>/<code>body</code>{" "}{t("designGuide.d0322")}{" "}
            <code>icon</code>.
          </p>
        </SubSection>

        <SubSection title={t("designGuide.d0323")}>
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
              reason={t("designGuide.d0324")}
              policyNumber={7}
              expiresInLabel={t("designGuide.d0325")}
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
              reason={t("designGuide.d0324")}
              policyNumber={7}
              expiresInLabel={t("designGuide.d0326")}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0327")}{" "}
            <code>stale</code>{" "}{t("designGuide.d0328")}{" "}<code>Approve</code>{" "}{t("designGuide.d0329")}{" "}</p>
        </SubSection>

        <SubSection title={t("designGuide.d0330")}>
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
              reason={t("designGuide.d0324")}
              policyNumber={7}
              expiresInLabel={t("designGuide.d0325")}
            />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0331")}{" "}</p>
        </SubSection>

        <SubSection title={t("designGuide.d0332")}>
          <BindingsTable
            rows={[
              { label: t("designGuide.bindingApplication"), value: "Slack · manifest v2.4.1" },
              { label: t("designGuide.bindingConnection"), value: "https://slack.com/api · acme-workspace", mono: true },
              { label: t("designGuide.bindingCatalog"), value: "sha256:9f86d081…f00a08", mono: true },
              { label: t("designGuide.bindingPayload"), value: "sha256:2c26b46b…66e7ae", mono: true },
            ]}
          />
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0333")}{" "}<code>ActionCard</code>{" "}{t("designGuide.d0334")}{" "}</p>
        </SubSection>

        <SubSection title={t("designGuide.d0335")}>
          <div className="flex flex-wrap items-center gap-2">
            {[
              "allowed", "denied", "block", "require-approval", "redacted", "rate-limit",
              "deferred", "hidden", "quarantined", "healthy", "degraded", "runtime-error", "unchecked",
            ].map((s) => (
              <StatusBadge key={s} status={s} />
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{" "}{t("designGuide.d0336")}{" "}
            <code>StatusBadge</code>{" "}{t("designGuide.d0337")}{" "}<code>lib/status-colors</code>.
          </p>
        </SubSection>

        <SubSection title={t("designGuide.d0338")}>
          <EmptyState
            icon={Inbox}
            message={t("designGuide.d0339")}
            description={t("designGuide.d0340")}
            action={t("designGuide.d0341")}
            onAction={() => {}}
          />
        </SubSection>
      </Section>

      <Section title={t("designGuide.d0342")}>
        <SubSection title={t("designGuide.d0343")}>
          <RepositoryEditor selected={[]} onChange={() => {}} state="disconnected" onConnect={() => {}} onRetry={() => {}} />
        </SubSection>
        <SubSection title={t("designGuide.d0344")}>
          <RepositoryEditor selected={[{ id: "1", fullName: "paperclipai/paperclip", url: "https://github.com/paperclipai/paperclip", connections: [t("designGuide.extra40")] }]}
            available={[{ id: "2", fullName: "paperclipai/docs", url: "https://github.com/paperclipai/docs", connections: [t("designGuide.extra41")] }]}
            onChange={() => {}} onConnect={() => {}} onRetry={() => {}} />
        </SubSection>
        <p className="text-sm text-muted-foreground">{t("designGuide.d0345")}</p>
      </Section>

      <Section title={t("designGuide.d0346")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0347")}{" "}<span className="font-mono">Product/Environment Variables Editor</span>{" "}{t("designGuide.d0348")}{" "}</p>
        <EnvironmentVariablesEditorShowcase />
      </Section>

      <Section title={t("designGuide.d0349")}>
        <SubSection title={t("designGuide.d0350")}>
          <div className="max-w-xl">
            <TaskDetailTasksPanel
              subtasks={[localizedDesignGuideTask]}
              createdTasks={[
                { ...localizedDesignGuideTask, projectId: "design-board", project: { id: "design-board", name: t("designGuide.extra28") } as Issue["project"] },
                { ...localizedDesignGuideTask, id: "design-followup", identifier: "PAP-428", title: t("designGuide.extra29"), status: "todo", projectId: null },
              ]}
              projects={[]}
            />
          </div>
        </SubSection>
        <SubSection title={t("designGuide.d0351")}>
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} />
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} isLoading />
          <TaskDetailTasksPanel subtasks={[]} createdTasks={[]} projects={[]} hasError onRetry={() => {}} />
        </SubSection>
      </Section>

      <Section title={t("designGuide.d0352")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0353")}{" "}</p>
      </Section>

      <Section title={t("designGuide.d0354")}>
        <SavedProviderKeySelect options={[{ id: "example", label: t("designGuide.extra30"), binding: { type: "user_secret_ref", key: "ANTHROPIC_API_KEY", version: "latest" } }]} value="example" onChange={() => {}} loading={false} error={false} />
        <SavedProviderKeySelect options={[]} value="" onChange={() => {}} loading error={false} />
        <SavedProviderKeySelect options={[]} value="" onChange={() => {}} loading={false} error />
      </Section>

      <Section title={t("designGuide.d0355")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0356")}{" "}</p>
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

      <Section title={t("designGuide.d0357")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0358")}{" "}<span className="font-mono">react-resizable-panels</span>{" "}{" "}{t("designGuide.d0359")}<span className="font-mono">minSize="240px"</span>{t("designGuide.d0360")}{" "}</p>
        <div className="h-48 max-w-2xl overflow-hidden rounded-md border border-border">
          <ResizablePanelGroup>
            <ResizablePanel id="a" minSize="120px" className="bg-muted/30">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{" "}{t("designGuide.d0361")}{" "}</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="b" minSize="120px" collapsible collapsedSize="40px" className="bg-muted/10">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{" "}{t("designGuide.d0362")}{" "}</div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel id="c" minSize="120px" className="bg-muted/30">
              <div className="flex h-full items-center justify-center text-xs text-muted-foreground">{" "}{t("designGuide.d0363")}{" "}</div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </Section>

      {/* ============================================================ */}
      {/*  INLINE BANNER + BUILT-IN AGENTS                              */}
      {/* ============================================================ */}
      <Section title={t("designGuide.d0364")}>
        <div className="space-y-3">
          {["http://localhost:3100", "https://paperclip.internal", "https://paperclip.example-tailnet.ts.net", "http://paperclip.example.com", "not-a-url"].map((url) => <WebhookUrlWarning key={url} url={url} />)}
        </div>
      </Section>

      <Section title={t("designGuide.d0365")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0366")}<span className="font-mono">brandBanner</span>{" "}{t("designGuide.d0367")}{" "}
          <span className="font-mono">info</span>{" "}{t("designGuide.d0368")}{" "}
          <span className="font-mono">warning</span>{" "}{t("designGuide.d0369")}{" "}
          <span className="font-mono">bg-yellow-*</span>/<span className="font-mono">bg-blue-*</span>{" "}{" "}{t("designGuide.d0370")}{" "}</p>
        <div className="space-y-3">
          <InlineBanner
            tone="info"
            title={t("designGuide.d0371")}
            actions={<Button variant="outline" size="sm">{t("designGuide.d0372")}</Button>}
          >{" "}{t("designGuide.d0373")}{" "}<strong>{t("designGuide.d0374")}</strong>{t("designGuide.d0375")}{" "}</InlineBanner>
          <InlineBanner
            tone="warning"
            title={t("designGuide.d0376")}
            actions={
              <>
                <Button variant="ghost" size="sm">{t("designGuide.d0377")}</Button>
                <Button size="sm">{t("designGuide.d0378")}</Button>
              </>
            }
          >{" "}{t("designGuide.d0379")}{" "}</InlineBanner>
          <InlineBanner
            tone="danger"
            title={t("designGuide.d0380")}
            actions={<Button size="sm">{t("designGuide.d0381")}</Button>}
          >{" "}{t("designGuide.d0382")}{" "}</InlineBanner>
          <InlineBanner tone="info" compact>{" "}{t("designGuide.d0383")}{" "}</InlineBanner>
        </div>
      </Section>

      <Section title={t("designGuide.d0384")}>
        <p className="text-sm text-muted-foreground">{t("designGuide.d0385")}</p>
        <div className="grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
          <MediaArtifactCard id="design-image" title={t("designGuide.d0386")} contentPath="/announcement-preview.svg" contentType="image/svg+xml" originalFilename="launch.svg" detail={t("designGuide.d0387")} />
          <MediaArtifactCard id="design-video" title={t("designGuide.d0388")} contentPath="" contentType="video/mp4" originalFilename="preview.mp4" detail={t("designGuide.d0389")} />
        </div>
      </Section>

      <Section title={t("designGuide.d0390")}>
        <AiConnectionDesignExamples />
      </Section>

      <Section title={t("designGuide.d0391")}>
        <p className="text-sm text-muted-foreground">{" "}{t("designGuide.d0392")}{" "}
          <span className="font-mono">needs_setup</span> / <span className="font-mono">pending_approval</span>.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <BuiltInLifecycleChip status="needs_setup" />
          <BuiltInLifecycleChip status="pending_approval" />
          <BuiltInLifecycleChip status="needs_setup" compact />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          <span className="font-mono">&lt;BuiltInAgentGate agentKey&gt;</span>{" "}{t("designGuide.d0393")}{" "}
          <span className="font-mono">PageSkeleton</span> + <span className="font-mono">EmptyState</span>{" "}
          + <span className="font-mono">InlineBanner</span>{" "}{t("designGuide.d0394")}{" "}</p>
      </Section>
    </div>
  );
}
