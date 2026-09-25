import { useTranslation } from "@/i18n";
import { SetupWizardNavigation, SetupWizardSidebar } from "../SetupWizard";

export { SetupWizardSidebar as ChatSetupSidebar };

export function ChatSetupNavigation(props: {
  labels?: string[]; step: number; availableStep: number; disabled?: boolean; onSelect: (step: number) => void;
}) {
  const { t } = useTranslation();
  return <SetupWizardNavigation
    {...props}
    labels={props.labels ?? [
      t("setupwizard.general.chooseagent"),
      t("setupwizard.general.connectprovider"),
      t("setupwizard.general.tryit"),
    ]}
    ariaLabel={t("setupwizard.general.connectionsetupprogress")}
  />;
}
