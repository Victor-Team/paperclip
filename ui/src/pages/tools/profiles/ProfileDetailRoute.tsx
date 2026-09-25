import { useEffect } from "react";
import { useParams } from "@/lib/router";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useCompany } from "@/context/CompanyContext";
import { advancedTabHref } from "../tool-tabs";
import { ToolsAdminGate } from "./ToolsAdminGate";
import { ProfileDetail } from "./ProfileDetail";
import { useTranslation } from "@/i18n";

export function ProfileDetailRoute() {
  const { t } = useTranslation();
  const { selectedCompany, selectedCompanyId } = useCompany();
  const { setBreadcrumbs } = useBreadcrumbs();
  const params = useParams<{ profileId?: string }>();

  useEffect(() => {
    setBreadcrumbs([
      { label: selectedCompany?.name ?? t("profiledetailroute.general.company"), href: "/dashboard" },
      { label: t("profiledetailroute.general.apps"), href: "/apps" },
      { label: t("profiledetailroute.general.accessProfiles"), href: advancedTabHref("profiles") },
      { label: t("profiledetailroute.general.profileDetail") },
    ]);
    return () => setBreadcrumbs([]);
  }, [setBreadcrumbs, selectedCompany?.name, t]);

  if (!selectedCompanyId || !params.profileId) {
    return <div className="p-6 text-sm text-muted-foreground">{t("profiledetailroute.general.selectanorganizationandprofile")}</div>;
  }

  return (
    <ToolsAdminGate>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 p-4 sm:p-6">
        <ProfileDetail companyId={selectedCompanyId} profileId={params.profileId} />
      </div>
    </ToolsAdminGate>
  );
}
