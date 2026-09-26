import { InlineBanner } from "@/components/InlineBanner";
import { webhookUrlWarningReason } from "@/lib/webhook-url-warning";
import { useTranslation } from "@/i18n";

export function WebhookUrlWarning({ url }: { url: string }) {
  const { t } = useTranslation();
  const reason = webhookUrlWarningReason(url);
  if (!reason) return null;
  return <InlineBanner tone="warning" title={t(`webhookUrlWarning.${reason}.title`)}>
    <div className="space-y-2">
      <p>{t(`webhookUrlWarning.${reason}.message`)}</p>
      <p>{t("webhookUrlWarning.continue")}</p>
      <a className="underline underline-offset-4" href="https://docs.paperclip.ing/reference/deploy/https/" target="_blank" rel="noopener noreferrer">{t("webhookUrlWarning.learn")}</a>
    </div>
  </InlineBanner>;
}
