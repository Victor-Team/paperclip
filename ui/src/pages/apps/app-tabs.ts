import { Inbox, ShieldCheck } from "lucide-react";

export const APP_TABS = [
  { key: "permissions", label: "Permissions", labelKey: "apptabs.general.permissions", icon: ShieldCheck },
  { key: "review", label: "Review", labelKey: "apptabs.general.review", icon: Inbox },
] as const;

export type AppTabKey = (typeof APP_TABS)[number]["key"];

export function appTabHref(connectionId: string, tab: AppTabKey): string {
  return `/apps/${connectionId}/${tab}`;
}

export function appApplicationTabHref(applicationId: string, tab: AppTabKey): string {
  return `/apps/app/${applicationId}/${tab}`;
}

export function isAppTabKey(value: string | undefined): value is AppTabKey {
  return APP_TABS.some((tab) => tab.key === value);
}

export function appTabLabel(
  tabKey: AppTabKey,
  translate?: (key: string) => string,
): string {
  const tab = APP_TABS.find((candidate) => candidate.key === tabKey) ?? APP_TABS[0];
  return translate ? translate(tab.labelKey) : tab.label;
}
