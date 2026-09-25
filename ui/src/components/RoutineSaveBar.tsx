import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { RoutineHistoryDirtyFieldDescriptor } from "./RoutineHistoryTab";
import { useTranslation } from "@/i18n";

/**
 * Per-section sticky save bar (§1.4–§1.5). Hidden when clean; reveals on dirty.
 * On a 409 it swaps to the conflict-recovery surface ("Reload latest" /
 * "Overwrite anyway"). Wires ⌘/Ctrl+S → save and Esc → discard-with-confirm.
 */
export function RoutineSaveBar({
  dirtyFields,
  isSaving,
  saveConflict,
  onSave,
  onDiscard,
  onReload,
  disabled,
}: {
  dirtyFields: RoutineHistoryDirtyFieldDescriptor[];
  isSaving: boolean;
  saveConflict: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onReload: () => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const dirtyCount = dirtyFields.length;
  const isDirty = dirtyCount > 0;
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);

  useEffect(() => {
    if (!isDirty && !saveConflict) return;
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (!isSaving && !disabled) onSave();
      } else if (event.key === "Escape" && isDirty) {
        event.preventDefault();
        setConfirmDiscardOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isDirty, saveConflict, isSaving, disabled, onSave]);

  if (!isDirty && !saveConflict) return null;

  return (
    <>
      <div
        className={cn(
          "sticky bottom-0 z-10 -mx-8 mt-6 flex h-14 items-center justify-between border-t px-8 backdrop-blur",
          "motion-safe:transition-colors motion-safe:duration-200",
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2",
          saveConflict
            ? "border-amber-500/30 bg-amber-500/5"
            : "border-border bg-background/95",
        )}
      >
        {saveConflict ? (
          <div className="flex items-center gap-2 text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            <span>{t("routinesavebar.general.routinechangedelsewherereloadtomerge")}</span>
          </div>
        ) : (
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 text-sm text-foreground hover:text-foreground"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                <span className="font-medium">
                  {dirtyCount} {t("routinesavebar.general.unsaved")} {dirtyCount === 1 ? t("routinesavebar.general.change") : t("routinesavebar.general.changes")}
                </span>
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-64">
              <p className="mb-2 text-xs font-medium text-muted-foreground">
                {t("routinesavebar.general.pendingchanges")}</p>
              <ul className="space-y-1 text-sm">
                {dirtyFields.map((field) => (
                  <li key={field.key} className="flex items-center gap-2">
                    <span className="h-1 w-1 rounded-full bg-amber-500" />
                    <span className="capitalize">{field.label}</span>
                  </li>
                ))}
              </ul>
            </PopoverContent>
          </Popover>
        )}

        <div className="flex items-center gap-2">
          {saveConflict ? (
            <>
              <Button variant="outline" size="sm" onClick={onReload}>
                {t("routinesavebar.general.reloadlatest")}</Button>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isSaving || disabled}
                      onClick={onSave}
                    >
                      {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                      {t("routinesavebar.general.overwriteanyway")}</Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t("routinesavebar.general.replacesthenewerrevisionwithyourlocal")}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                disabled={isSaving || disabled}
                onClick={() => setConfirmDiscardOpen(true)}
              >
                {t("routinesavebar.general.discard")}</Button>
              <Button
                size="sm"
                disabled={isSaving || disabled}
                onClick={onSave}
              >
                {isSaving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                {t("routinesavebar.general.savechanges")}<kbd className="ml-2 hidden rounded bg-foreground/10 px-1 text-(length:--text-nano) font-medium sm:inline">
                  {t("routinesavebar.general.s")}</kbd>
              </Button>
            </>
          )}
        </div>
      </div>

      <Dialog open={confirmDiscardOpen} onOpenChange={setConfirmDiscardOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("routinesavebar.general.discardchanges")}</DialogTitle>
            <DialogDescription>
              {t("routinesavebar.general.thiswillrevert")} {dirtyCount} {t("routinesavebar.general.unsaved1")}{" "}
              {dirtyCount === 1 ? t("routinesavebar.general.change2") : t("routinesavebar.general.changes3")} {t("routinesavebar.general.inthissection")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmDiscardOpen(false)}>
              {t("routinesavebar.general.keepediting")}</Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDiscard();
                setConfirmDiscardOpen(false);
              }}
            >
              {t("routinesavebar.general.discardchanges4")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Read-only strip for non-owners on editable sections (§1.6). */
export function RoutineReadOnlyStrip() {
  const { t } = useTranslation();
  return (
    <div className="-mx-8 mt-6 border-t border-border bg-muted/20 px-8 py-3 text-xs text-muted-foreground">
      {t("routinesavebar.general.readonlyyoudontownthis")}</div>
  );
}
