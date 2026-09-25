import { Activity, LayoutGrid, KeyRound, Wrench, Boxes } from "lucide-react";

/**
 * Gateway detail tabs (PAP-11200). Terminology is locked by the approved
 * PAP-11178 design of record: Overview · Apps & tools · Tokens · Activity ·
 * Advanced. Raw protocol / JSON / transport details live under Advanced.
 */
export const GATEWAY_TABS = [
  { key: "overview", labelKey: "gatewaydetail.general.overview", icon: LayoutGrid },
  { key: "apps", labelKey: "gatewaydetail.general.appstools", icon: Boxes },
  { key: "tokens", labelKey: "gatewaydetail.general.tokens", icon: KeyRound },
  { key: "activity", labelKey: "gatewaydetail.general.activity", icon: Activity },
  { key: "advanced", labelKey: "gatewaydetail.general.advanced", icon: Wrench },
] as const;

export type GatewayTabKey = (typeof GATEWAY_TABS)[number]["key"];

export function gatewayTabHref(gatewayId: string, tab: GatewayTabKey): string {
  return `/apps/gateways/${gatewayId}/${tab}`;
}

export function isGatewayTabKey(value: string | undefined): value is GatewayTabKey {
  return GATEWAY_TABS.some((tab) => tab.key === value);
}

export function gatewayTabLabel(tabKey: GatewayTabKey, translate: (key: string) => string): string {
  return translate(GATEWAY_TABS.find((tab) => tab.key === tabKey)?.labelKey ?? "gatewaydetail.general.overview");
}
