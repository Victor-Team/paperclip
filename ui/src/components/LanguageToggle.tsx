import { Languages } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useLocale } from "../context/LocaleContext";

type LanguageToggleVariant = "icon" | "menu-action" | "compact-menu-action";

interface LanguageToggleProps {
  className?: string;
  /**
   * Same three shapes as `ThemeToggle`: `icon` for headers and the signed-out
   * `/auth` chrome, `menu-action` for the explanatory production account menu,
   * `compact-menu-action` for the compact account menu.
   */
  variant?: LanguageToggleVariant;
  /** Called after the language changed, so a popover menu can close itself. */
  onAfterChange?: () => void;
}

const SELECT_CLASS_NAME =
  "min-w-0 rounded border border-border bg-transparent px-1.5 py-0.5 text-xs text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring";

/**
 * Canonical language picker. Every surface renders through this component and
 * lists `selectableLocales`, so adding a language is a one-line change there.
 */
export function LanguageToggle({ className, variant = "icon", onAfterChange }: LanguageToggleProps) {
  const { t } = useTranslation();
  const { locale, setLocale, locales } = useLocale();
  const label = t("common.language.label");

  function handleChange(next: string) {
    setLocale(next);
    onAfterChange?.();
  }

  const select = (extraClassName?: string) => (
    <select
      className={cn(SELECT_CLASS_NAME, extraClassName)}
      value={locale}
      onChange={(event) => handleChange(event.target.value)}
      aria-label={label}
      title={label}
    >
      {locales.map((option) => (
        <option key={option.code} value={option.code}>
          {option.label}
        </option>
      ))}
    </select>
  );

  if (variant === "compact-menu-action") {
    return (
      <label
        className={cn(
          "flex h-(--profile-popover-row-height) w-full items-center gap-(--profile-popover-row-gap) rounded-lg px-2.5 text-left text-(length:--text-compact) font-medium leading-(--profile-popover-label-line-height) text-foreground transition-colors hover:bg-accent",
          className,
        )}
      >
        <span className="flex size-5 shrink-0 items-center justify-center text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {select("max-w-[8rem] shrink-0")}
      </label>
    );
  }

  if (variant === "menu-action") {
    return (
      <label
        className={cn(
          "flex w-full items-start gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent/60",
          className,
        )}
      >
        <span className="mt-0.5 rounded-lg border border-border bg-background/70 p-2 text-muted-foreground">
          <Languages className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{t("common.language.description")}</span>
          {select("mt-2 w-full")}
        </span>
      </label>
    );
  }

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-muted-foreground", className)}>
      <Languages className="size-4 shrink-0" aria-hidden="true" />
      {select()}
    </span>
  );
}
