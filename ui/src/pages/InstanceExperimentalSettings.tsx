import { localizedError } from "@/lib/localized-error";
import { i18n, t, useTranslation } from "@/i18n";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FlaskConical, Lock, Play } from "lucide-react";
import type {
  InstanceExperimentalSettings,
  InstanceExperimentalSettingsWithManaged,
  InstanceFeatureKey,
  ManagedSettingMetadata,
  PatchInstanceExperimentalSettings,
} from "@paperclipai/shared";
import { experimentalSettingKey } from "@paperclipai/shared";
import { instanceSettingsApi } from "@/api/instanceSettings";
import { useHiddenSettings } from "@/hooks/useHiddenSettings";
import { getWorktreeInstanceId, isWorktreeRuntime } from "../lib/worktree-branding";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type WorktreeRunExecutionDisplayState =
  | { kind: "off" }
  | { kind: "armed"; activatedAt: string }
  | { kind: "fail_closed"; reason: "missing_cutoff" | "missing_instance_id" | "instance_mismatch" };

/**
 * Mirror of the server's `resolveWorktreeRunExecutionActivation` fail-closed
 * ladder (server/src/services/instance-settings.ts) so the card never claims a
 * copied/legacy row is arming execution. The derived fields are display-only —
 * the PATCH the toggle sends still writes just the boolean.
 */
function resolveWorktreeRunExecutionDisplayState(
  settings:
    | Pick<
        InstanceExperimentalSettings,
        | "enableWorktreeRunExecution"
        | "worktreeRunExecutionActivatedAt"
        | "worktreeRunExecutionActivationInstanceId"
      >
    | undefined,
  currentInstanceId: string | null,
): WorktreeRunExecutionDisplayState {
  if (settings?.enableWorktreeRunExecution !== true) return { kind: "off" };
  if (!settings.worktreeRunExecutionActivatedAt) return { kind: "fail_closed", reason: "missing_cutoff" };
  if (!currentInstanceId) return { kind: "fail_closed", reason: "missing_instance_id" };
  if (settings.worktreeRunExecutionActivationInstanceId !== currentInstanceId) {
    return { kind: "fail_closed", reason: "instance_mismatch" };
  }
  return { kind: "armed", activatedAt: settings.worktreeRunExecutionActivatedAt };
}

function formatActivationTimestamp(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso;
  return parsed.toLocaleString(i18n.language, { dateStyle: "medium", timeStyle: "short" });
}

// PAP-11233: keep Conference Room code intact, but hide the user-facing opt-in for now.
const SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING = false;

function ManagedByCloudBadge() {
  return (
    <Badge variant="outline" className="text-muted-foreground">
      <Lock aria-hidden="true" />
              {t("tok225.settings_managed_by_paperclip_cloud")}
            </Badge>
  );
}

function ExperimentalToggleCard({
  title,
  description,
  footnote,
  checked,
  onCheckedChange,
  disabled,
  settingKey,
  managed,
  ariaLabel,
}: {
  title: string;
  description: string;
  footnote?: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled: boolean;
  /** Flag key backing this card; operator-hidden keys render nothing. */
  settingKey: InstanceFeatureKey;
  managed?: ManagedSettingMetadata;
  ariaLabel: string;
}) {
  const { hidden: hiddenSettings } = useHiddenSettings();
  const isManaged = managed?.managed === true;
  if (hiddenSettings.has(experimentalSettingKey(settingKey))) return null;
  return (
    <Card className="block bg-transparent p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{title}</h3>
            {isManaged ? <ManagedByCloudBadge /> : null}
          </div>
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
          {footnote ? <p className="max-w-2xl text-xs text-muted-foreground">{footnote}</p> : null}
        </div>
        <ToggleSwitch
          checked={checked}
          onCheckedChange={(next) => {
            if (isManaged) return;
            onCheckedChange(next);
          }}
          disabled={disabled || isManaged}
          aria-label={ariaLabel}
        />
      </div>
    </Card>
  );
}

export function InstanceExperimentalSettings() {
  useTranslation();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const { hidden: hiddenSettings } = useHiddenSettings();
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    setBreadcrumbs([
      { label: t("tok225.settings_settings"), href: "/company/settings" },
      { label: t("tok225.settings_experimental") },
    ]);
  }, [setBreadcrumbs, i18n.language]);

  const experimentalQuery = useQuery({
    queryKey: queryKeys.instance.experimentalSettings,
    queryFn: () => instanceSettingsApi.getExperimental(),
  });

  const toggleMutation = useMutation<
    InstanceExperimentalSettingsWithManaged,
    Error,
    PatchInstanceExperimentalSettings,
    { previousSettings?: InstanceExperimentalSettingsWithManaged }
  >({
    mutationFn: async (patch: PatchInstanceExperimentalSettings) =>
      instanceSettingsApi.updateExperimental(patch),
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.instance.experimentalSettings });
      const previousSettings = queryClient.getQueryData<InstanceExperimentalSettingsWithManaged>(
        queryKeys.instance.experimentalSettings,
      );
      if (previousSettings) {
        queryClient.setQueryData<InstanceExperimentalSettingsWithManaged>(
          queryKeys.instance.experimentalSettings,
          { ...previousSettings, ...patch },
        );
      }
      return { previousSettings };
    },
    onSuccess: async (updatedSettings) => {
      setActionError(null);
      queryClient.setQueryData(queryKeys.instance.experimentalSettings, updatedSettings);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.instance.experimentalSettings }),
        queryClient.invalidateQueries({ queryKey: queryKeys.adapters.all }),
        queryClient.invalidateQueries({ queryKey: ["built-in-agents"] }),
        queryClient.invalidateQueries({ queryKey: queryKeys.health }),
        queryClient.invalidateQueries({ queryKey: ["apps"] }),
      ]);
    },
    onError: (error, _patch, context) => {
      if (context?.previousSettings) {
        queryClient.setQueryData(queryKeys.instance.experimentalSettings, context.previousSettings);
      }
      setActionError(localizedError(error, t("tok225.failed_to_update_experimental_settings")));
    },
  });

  if (experimentalQuery.isLoading) {
    return <div className="text-sm text-muted-foreground">{t("tok225.loading_experimental_settings")}</div>;
  }

  if (experimentalQuery.error) {
    return (
      <div className="text-sm text-destructive">
        {localizedError(experimentalQuery.error, t("tok225.failed_to_load_experimental_settings"))}
      </div>
    );
  }

  const inWorktree = isWorktreeRuntime();
  // Present only on cloud-managed instances: keys the managed overlay controls
  // render locked with the "Managed by Paperclip Cloud" badge. Self-hosted
  // responses carry no `managedKeys`, so every card stays editable.
  const managedKeys = experimentalQuery.data?.managedKeys ?? {};
  const enableWorktreeRunExecution = experimentalQuery.data?.enableWorktreeRunExecution === true;
  const worktreeRunExecutionManaged = managedKeys.enableWorktreeRunExecution?.managed === true;
  const worktreeRunExecutionState = resolveWorktreeRunExecutionDisplayState(
    experimentalQuery.data,
    getWorktreeInstanceId(),
  );
  const enableEnvironments = experimentalQuery.data?.enableEnvironments === true;
  const enableNativeRunner = experimentalQuery.data?.enableNativeRunner === true;
  const enableChatConnectors = experimentalQuery.data?.enableChatConnectors === true;
  const enableManagedSandboxOnly = experimentalQuery.data?.enableManagedSandboxOnly === true;
  const enableIsolatedWorkspaces = experimentalQuery.data?.enableIsolatedWorkspaces === true;
  const enableIsolatedWorkspacesByDefault =
    experimentalQuery.data?.enableIsolatedWorkspacesByDefault === true;
  // Streamlined left navigation is now the standard sidebar (PAP-12472); the
  // experimental opt-out was retired, so it no longer surfaces a toggle here.
  const enableStreamlinedUi = experimentalQuery.data?.enableStreamlinedUi !== false;
  const enableConferenceRoomChat = experimentalQuery.data?.enableConferenceRoomChat === true;
  const enableClassicTaskInterface = experimentalQuery.data?.enableClassicTaskInterface === true;
  const enableIssuePlanDecompositions =
    experimentalQuery.data?.enableIssuePlanDecompositions === true;
  const enableExperimentalFileViewer =
    experimentalQuery.data?.enableExperimentalFileViewer === true;
  const enableExternalObjects = experimentalQuery.data?.enableExternalObjects === true;
  const enableBuiltInAgents = experimentalQuery.data?.enableBuiltInAgents === true;
  const enableBetaSkills = experimentalQuery.data?.enableBetaSkills === true;
  const enableSummaries = experimentalQuery.data?.enableSummaries === true;
  const enableStatusCards = experimentalQuery.data?.enableStatusCards === true;
  const summariesManaged = managedKeys.enableSummaries?.managed === true;
  const statusCardsManaged = managedKeys.enableStatusCards?.managed === true;
  const statusCardsBlockedByManagedSummaries = summariesManaged && !enableSummaries;
  const summariesRequiredByManagedStatusCards = statusCardsManaged && enableStatusCards;
  const enableDecisions = experimentalQuery.data?.enableDecisions === true;
  const enableGoalsSidebarLink = experimentalQuery.data?.enableGoalsSidebarLink === true;
  const enableCases = experimentalQuery.data?.enableCases === true;
  const enableServerInfoDebugView = experimentalQuery.data?.enableServerInfoDebugView === true;
  const enablePaperclipDeveloperMode =
    experimentalQuery.data?.enablePaperclipDeveloperMode === true;
  const enableSimplifiedEnglishInteractions =
    experimentalQuery.data?.enableSimplifiedEnglishInteractions === true;
  const enableFirstTaskPlanProposal =
    experimentalQuery.data?.enableFirstTaskPlanProposal === true;
  const enableSmokeLab = experimentalQuery.data?.enableSmokeLab === true;
  const autoRestartDevServerWhenIdle = experimentalQuery.data?.autoRestartDevServerWhenIdle === true;
  const isVisible = (key: InstanceFeatureKey) => !hiddenSettings.has(experimentalSettingKey(key));
  const showWorktreeRunExecution = inWorktree && isVisible("enableWorktreeRunExecution");
  const showDeveloperSection = showWorktreeRunExecution || ([
    "autoRestartDevServerWhenIdle",
    "enableManagedSandboxOnly",
    "enablePaperclipDeveloperMode",
    "enableServerInfoDebugView",
    "enableSmokeLab",
    "enableIssuePlanDecompositions",
  ] satisfies InstanceFeatureKey[]).some(isVisible);
  const showLegacySection = isVisible("enableClassicTaskInterface") || isVisible("enableGoalsSidebarLink");
  return (
    <div className="max-w-6xl space-y-6">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-lg font-semibold">{t("tok225.settings_experimental")}</h1>
        </div>
        <p className="text-sm text-muted-foreground">
              {t("tok225.settings_opt_into_features_that_are_still_being_evaluated_before_they_become_default_be")}
            </p>
      </div>

      <div
        role="alert"
        className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="space-y-1 text-sm">
            <p className="font-medium text-foreground">{t("tok225.settings_experimental_features_may_break_at_any_time")}</p>
            <p className="text-muted-foreground">
              {t("tok225.settings_these_features_are_opt_in_and_come_with_no_compatibility_guarantees_they_may_c")}
            </p>
          </div>
        </div>
      </div>

      {actionError && (
        <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {actionError}
        </div>
      )}

      <section className="space-y-3" aria-labelledby="experimental-features-heading">
        <div className="space-y-1">
          <h2 id="experimental-features-heading" className="text-sm font-semibold">
              {t("tok225.settings_experimental_features")}
            </h2>
          <p className="text-sm text-muted-foreground">
              {t("tok225.settings_optional_product_features_that_are_still_being_evaluated")}
            </p>
        </div>

        <ExperimentalToggleCard
          title={t("tok225.settings_agent_chat")}
          description={t("tok225.settings_talk_to_each_agent_in_one_ongoing_conversation_clarify_goals_and_create_tasks_")}
          footnote={t("tok225.settings_turning_this_off_preserves_conversations_and_lets_active_runs_finish_but_preve")}
          checked={experimentalQuery.data?.enableAgentChat ?? false}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableAgentChat: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableAgentChat"
          managed={managedKeys.enableAgentChat}
          ariaLabel={t("tok225.settings_toggle_agent_chat_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_beta_skills")}
          description={t("tok225.settings_allow_agents_to_pin_beta_releases_of_the_paperclip_core_skill_disabling_this_r")}
          checked={enableBetaSkills}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBetaSkills: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBetaSkills"
          managed={managedKeys.enableBetaSkills}
          ariaLabel={t("tok225.settings_toggle_beta_skills_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_built_in_agents")}
          description={t("tok225.settings_show_paperclip_managed_built_in_agent_surfaces_including_built_in_roster_badge")}
          checked={enableBuiltInAgents}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableBuiltInAgents: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableBuiltInAgents"
          managed={managedKeys.enableBuiltInAgents}
          ariaLabel={t("tok225.settings_toggle_built_in_agents_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_cases")}
          description={t("tok225.settings_durable_work_products_blog_posts_tweet_storms_that_tasks_create_and_iterate_on")}
          footnote={t("tok225.settings_turning_cases_off_hides_the_tab_and_blocks_the_case_api_existing_case_data_is_")}
          checked={enableCases}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableCases: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableCases"
          managed={managedKeys.enableCases}
          ariaLabel={t("tok225.settings_toggle_cases_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_chat_connectors")}
          description={t("tok225.settings_connect_agents_to_slack_github_discord_microsoft_teams_and_telegram_conversati")}
          footnote={t("tok225.settings_turning_this_off_hides_chat_setup_channels_and_connected_task_controls_existin")}
          checked={enableChatConnectors}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableChatConnectors: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableChatConnectors"
          managed={managedKeys.enableChatConnectors}
          ariaLabel={t("tok225.settings_toggle_chat_connectors_experimental_setting")}
        />

        {SHOW_CONFERENCE_ROOM_EXPERIMENTAL_SETTING ? (
          <ExperimentalToggleCard
            title={t("tok225.settings_conference_room_chat")}
            description={t("tok225.settings_adds_a_conference_room_one_chat_where_you_and_your_whole_team_work_together_pl")}
            checked={enableConferenceRoomChat}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableConferenceRoomChat: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableConferenceRoomChat"
            managed={managedKeys.enableConferenceRoomChat}
            ariaLabel={t("tok225.settings_toggle_conference_room_chat_experimental_setting")}
          />
        ) : null}

        <ExperimentalToggleCard
          title={t("tok225.settings_decisions")}
          description={t("tok225.settings_show_the_decisions_item_in_the_main_sidebar_the_attention_home_that_surfaces_t")}
          checked={enableDecisions}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableDecisions: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableDecisions"
          managed={managedKeys.enableDecisions}
          ariaLabel={t("tok225.settings_toggle_decisions_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_enable_environments")}
          description={t("tok225.settings_show_environment_management_in_company_settings_and_allow_project_and_agent_en")}
          checked={enableEnvironments}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableEnvironments: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableEnvironments"
          managed={managedKeys.enableEnvironments}
          ariaLabel={t("tok225.settings_toggle_environments_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_enable_external_objects")}
          description={t("tok225.settings_detect_external_urls_in_issues_and_show_resolved_status_for_pull_requests_tick")}
          checked={enableExternalObjects}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExternalObjects: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExternalObjects"
          managed={managedKeys.enableExternalObjects}
          ariaLabel={t("tok225.settings_toggle_external_objects_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_enable_isolated_workspaces")}
          description={t("tok225.settings_show_execution_workspace_controls_in_project_configuration_and_allow_isolated_")}
          checked={enableIsolatedWorkspaces}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableIsolatedWorkspaces: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableIsolatedWorkspaces"
          managed={managedKeys.enableIsolatedWorkspaces}
          ariaLabel={t("tok225.settings_toggle_isolated_workspaces_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_experimental_file_viewer")}
          description={t("tok225.settings_show_task_detail_controls_for_browsing_and_previewing_workspace_files_relative")}
          checked={enableExperimentalFileViewer}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableExperimentalFileViewer: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableExperimentalFileViewer"
          managed={managedKeys.enableExperimentalFileViewer}
          ariaLabel={t("tok225.settings_toggle_experimental_file_viewer_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_first_task_propose_with_a_plan_document")}
          description={t("tok225.settings_when_the_user_s_first_request_is_a_single_task_the_chief_of_staff_writes_a_sho")}
          checked={enableFirstTaskPlanProposal}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableFirstTaskPlanProposal: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableFirstTaskPlanProposal"
          managed={managedKeys.enableFirstTaskPlanProposal}
          ariaLabel={t("tok225.settings_toggle_first_task_plan_proposal_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_mcp_aggregators")}
          description={t("tok225.settings_connect_zapier_arcade_composio_connect_and_executor_through_their_mcp_servers")}
          footnote={t("tok225.settings_turning_this_off_hides_setup_for_these_connectors_existing_mcp_connections_kee")}
          checked={experimentalQuery.data?.enableMcpAggregators === true}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableMcpAggregators: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableMcpAggregators"
          managed={managedKeys.enableMcpAggregators}
          ariaLabel={t("tok225.settings_toggle_mcp_aggregators_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_paperclip_runner")}
          description={t("tok225.settings_allow_new_codex_agents_to_select_the_experimental_rust_paperclip_runner_includ")}
          checked={enableNativeRunner}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableNativeRunner: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableNativeRunner"
          managed={managedKeys.enableNativeRunner}
          ariaLabel={t("tok225.settings_toggle_paperclip_runner_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_simplified_english_interactions")}
          description={t("tok225.settings_instruct_agents_to_write_user_interactions_plan_confirmations_questions_sugges")}
          checked={enableSimplifiedEnglishInteractions}
          onCheckedChange={(checked) =>
            toggleMutation.mutate({ enableSimplifiedEnglishInteractions: checked })
          }
          disabled={toggleMutation.isPending}
          settingKey="enableSimplifiedEnglishInteractions"
          managed={managedKeys.enableSimplifiedEnglishInteractions}
          ariaLabel={t("tok225.settings_toggle_simplified_english_interactions_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_status_cards")}
          description={t("tok225.settings_enable_the_experimental_shared_status_card_board_and_its_gated_api_existing_ca")}
          footnote={t("tok225.settings_enabling_status_cards_also_enables_summaries")}
          checked={enableStatusCards}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked
                ? { enableSummaries: true, enableStatusCards: true }
                : { enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || statusCardsBlockedByManagedSummaries}
          settingKey="enableStatusCards"
          managed={managedKeys.enableStatusCards}
          ariaLabel={t("tok225.settings_toggle_status_cards_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_streamlined_ui")}
          description={t("tok225.settings_use_the_simplified_main_sidebar_shared_tasks_and_inbox_presentation_focused_ta")}
          footnote={t("tok225.settings_turning_this_off_restores_the_legacy_shell_and_navigation_task_and_page_data_a")}
          checked={enableStreamlinedUi}
          onCheckedChange={(checked) => toggleMutation.mutate({ enableStreamlinedUi: checked })}
          disabled={toggleMutation.isPending}
          settingKey="enableStreamlinedUi"
          managed={managedKeys.enableStreamlinedUi}
          ariaLabel={t("tok225.settings_toggle_streamlined_ui_experimental_setting")}
        />

        <ExperimentalToggleCard
          title={t("tok225.settings_summaries")}
          description={t("tok225.settings_show_summarizer_generated_status_slots_on_project_and_workspace_pages_with_on_")}
          footnote={t("tok225.settings_status_cards_requires_summaries_disabling_summaries_also_disables_status_cards")}
          checked={enableSummaries}
          onCheckedChange={(checked) =>
            toggleMutation.mutate(
              checked || !enableStatusCards
                ? { enableSummaries: checked }
                : { enableSummaries: false, enableStatusCards: false },
            )
          }
          disabled={toggleMutation.isPending || summariesRequiredByManagedStatusCards}
          settingKey="enableSummaries"
          managed={managedKeys.enableSummaries}
          ariaLabel={t("tok225.settings_toggle_summaries_experimental_setting")}
        />

        {enableIsolatedWorkspaces && (
          <ExperimentalToggleCard
            title={t("tok225.settings_use_isolated_workspaces_by_default")}
            description={t("tok225.settings_treat_a_project_that_has_no_execution_workspace_policy_of_its_own_as_if_it_sel")}
            checked={enableIsolatedWorkspacesByDefault}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIsolatedWorkspacesByDefault: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIsolatedWorkspacesByDefault"
            managed={managedKeys.enableIsolatedWorkspacesByDefault}
            ariaLabel={t("tok225.settings_toggle_isolated_workspaces_by_default_experimental_setting")}
          />
        )}
      </section>

      {showDeveloperSection ? (
        <section className="space-y-3" aria-labelledby="developer-mode-heading">
          <div className="space-y-1">
            <h2 id="developer-mode-heading" className="text-sm font-semibold">
              {t("tok225.settings_paperclip_developer_mode")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("tok225.settings_internal_tools_for_developing_testing_and_debugging_paperclip")}
            </p>
          </div>

          <ExperimentalToggleCard
            title={t("tok225.settings_auto_restart_dev_server_when_idle")}
            description={t("tok225.settings_in_pnpm_dev_once_wait_for_all_queued_and_running_local_agent_runs_to_finish_th")}
            checked={autoRestartDevServerWhenIdle}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ autoRestartDevServerWhenIdle: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="autoRestartDevServerWhenIdle"
            managed={managedKeys.autoRestartDevServerWhenIdle}
            ariaLabel={t("tok225.settings_toggle_guarded_dev_server_auto_restart")}
          />

          <ExperimentalToggleCard
            title={t("tok225.settings_managed_environment_only")}
            description={t("tok225.settings_hide_the_local_environment_and_run_all_agents_in_the_platform_managed_environm")}
            checked={enableManagedSandboxOnly}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableManagedSandboxOnly: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableManagedSandboxOnly"
            managed={managedKeys.enableManagedSandboxOnly}
            ariaLabel={t("tok225.settings_toggle_managed_environment_only_experimental_setting")}
          />

          <ExperimentalToggleCard
            title={t("tok225.settings_paperclip_developer_mode")}
            description={t("tok225.settings_show_internal_paperclip_maintainer_tools_and_observability_links_including_hon")}
            checked={enablePaperclipDeveloperMode}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enablePaperclipDeveloperMode: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enablePaperclipDeveloperMode"
            managed={managedKeys.enablePaperclipDeveloperMode}
            ariaLabel={t("tok225.settings_toggle_paperclip_developer_mode_experimental_setting")}
          />

          {showWorktreeRunExecution ? (
            <Card className="block bg-transparent p-5">
              <div className="flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{t("tok225.settings_run_tasks_in_this_worktree")}</h3>
                      {worktreeRunExecutionManaged ? <ManagedByCloudBadge /> : null}
                    </div>
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      {t("tok225.settings_worktree_preview_explanation")}
                    </p>
                  </div>
                  <ToggleSwitch
                    checked={enableWorktreeRunExecution}
                    onCheckedChange={(checked) => {
                      if (worktreeRunExecutionManaged) return;
                      toggleMutation.mutate({ enableWorktreeRunExecution: checked });
                    }}
                    disabled={toggleMutation.isPending || worktreeRunExecutionManaged}
                    aria-label={t("tok225.settings_toggle_worktree_run_execution_setting")}
                  />
                </div>

                {worktreeRunExecutionState.kind === "armed" ? (
                  <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-foreground">
                    <Play className="h-4 w-4 shrink-0 text-emerald-600" />
                    <span>
                      {t("tok225.settings_running_tasks_created_after")}{" "}
                      <span className="font-medium">
                        {formatActivationTimestamp(worktreeRunExecutionState.activatedAt)}
                      </span>
                      {t("tok225.settings_period")}
                    </span>
                  </div>
                ) : null}

                {worktreeRunExecutionState.kind === "fail_closed" ? (
                  <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground">{t("tok225.settings_execution_suppressed")}</p>
                      <p className="text-muted-foreground">
                        {worktreeRunExecutionState.reason === "instance_mismatch"
                          ? t("tok225.settings_worktree_instance_mismatch")
                          : t("tok225.settings_worktree_missing_cutoff")}{" "}
                        {t("tok225.settings_worktree_rearm")}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </Card>
          ) : null}

          <ExperimentalToggleCard
            title={t("tok225.settings_server_info_debug_view")}
            description={t("tok225.settings_show_a_server_section_in_the_account_drawer_with_the_current_server_restart_ti")}
            checked={enableServerInfoDebugView}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableServerInfoDebugView: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableServerInfoDebugView"
            managed={managedKeys.enableServerInfoDebugView}
            ariaLabel={t("tok225.settings_toggle_server_info_debug_view_experimental_setting")}
          />

          <ExperimentalToggleCard
            title={t("tok225.settings_smoke_lab")}
            description={t("tok225.settings_add_a_smoke_lab_tab_under_apps_developer_and_an_integration_smoke_card_on_the_")}
            checked={enableSmokeLab}
            onCheckedChange={(checked) => toggleMutation.mutate({ enableSmokeLab: checked })}
            disabled={toggleMutation.isPending}
            settingKey="enableSmokeLab"
            managed={managedKeys.enableSmokeLab}
            ariaLabel={t("tok225.settings_toggle_smoke_lab_experimental_setting")}
          />

          <ExperimentalToggleCard
            title={t("tok225.settings_task_plan_decomposition")}
            description={t("tok225.settings_show_accepted_plan_decomposition_history_on_task_detail_pages_intended_for_deb")}
            checked={enableIssuePlanDecompositions}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableIssuePlanDecompositions: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableIssuePlanDecompositions"
            managed={managedKeys.enableIssuePlanDecompositions}
            ariaLabel={t("tok225.settings_toggle_task_plan_decomposition_panel_experimental_setting")}
          />
        </section>
      ) : null}

      {showLegacySection ? (
        <section className="space-y-3" aria-labelledby="legacy-heading">
          <div className="space-y-1">
            <h2 id="legacy-heading" className="text-sm font-semibold">
              {t("tok225.settings_legacy")}
            </h2>
            <p className="text-sm text-muted-foreground">{t("tok225.settings_these_features_are_going_to_be_removed")}</p>
          </div>

          <ExperimentalToggleCard
            title={t("tok225.settings_classic_task_interface")}
            description={t("tok225.settings_restores_the_previous_task_detail_page_the_page_level_header_with_inline_descr")}
            footnote={t("tok225.settings_switching_takes_effect_immediately_no_task_data_is_affected")}
            checked={enableClassicTaskInterface}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableClassicTaskInterface: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableClassicTaskInterface"
            managed={managedKeys.enableClassicTaskInterface}
            ariaLabel={t("tok225.settings_toggle_classic_task_interface_experimental_setting")}
          />

          <ExperimentalToggleCard
            title={t("tok225.settings_goals_sidebar_link")}
            description={t("tok225.settings_restore_the_goals_item_in_the_main_sidebar_while_the_goals_surface_is_being_ev")}
            checked={enableGoalsSidebarLink}
            onCheckedChange={(checked) =>
              toggleMutation.mutate({ enableGoalsSidebarLink: checked })
            }
            disabled={toggleMutation.isPending}
            settingKey="enableGoalsSidebarLink"
            managed={managedKeys.enableGoalsSidebarLink}
            ariaLabel={t("tok225.settings_toggle_goals_sidebar_link_experimental_setting")}
          />
        </section>
      ) : null}
    </div>
  );
}
