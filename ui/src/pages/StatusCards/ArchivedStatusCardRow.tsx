import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import { statusCardsApi } from "@/api/statusCards";
import { Button } from "@/components/ui/button";
import { queryKeys } from "@/lib/queryKeys";

import { formatCents, formatTokens, rollupUpdates, statusCardDateTime } from "./format";
import type { StatusCardView } from "./types";
import { useTranslation } from "@/i18n";

function shortDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale, { month: "short", day: "numeric" });
}

export function ArchivedStatusCardRow({
  card,
  onView,
  onRestore,
  restorePending,
}: {
  card: StatusCardView;
  onView: () => void;
  onRestore: () => void;
  restorePending?: boolean;
}) {
  const { t, i18n } = useTranslation();
  // Lifetime cost is a rollup of the card's full update ledger (live P1 data).
  const updatesQuery = useQuery({
    queryKey: queryKeys.statusCards.updates(card.id),
    queryFn: () => statusCardsApi.updates(card.id),
  });
  const rollup = updatesQuery.data ? rollupUpdates(updatesQuery.data) : null;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/30 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">{card.title ?? t("archivedstatuscardrow.general.untitledcard")}</p>
        <p className="mt-0.5 text-xs text-muted-foreground" title={card.archivedAt ? statusCardDateTime(card.archivedAt, i18n.language) : undefined}>
          {t("archivedstatuscardrow.general.archived")} {shortDate(card.archivedAt, i18n.language)} {t("archivedstatuscardrow.general.lastsummary")} {shortDate(card.lastGeneratedAt, i18n.language)}
          {rollup ? t("archivedstatuscardrow.general.lifetime", { tokens: formatTokens(rollup.totalTokens, i18n.language), cost: formatCents(rollup.totalCostCents) }) : ""}
        </p>
      </div>
      {/* View is the more common intent on an archived row (reading the last
          summary); Restore is safe but secondary — it brings the card back
          stale and never auto-runs. */}
      <div className="flex shrink-0 gap-2">
        <Button size="sm" onClick={onView}>
          {t("archivedstatuscardrow.general.view")}</Button>
        <Button variant="outline" size="sm" onClick={onRestore} disabled={restorePending}>
          {restorePending ? <Loader2 className="animate-spin" /> : null}
          {t("archivedstatuscardrow.general.restore")}</Button>
      </div>
    </div>
  );
}
