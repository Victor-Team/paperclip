import { useState } from "react";
import { Apple, Monitor, Terminal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

type Platform = "mac" | "windows" | "linux";

const platformIcons: Record<Platform, typeof Apple> = {
  mac: Apple,
  windows: Monitor,
  linux: Terminal,
};

function detectPlatform(): Platform {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("mac")) return "mac";
  if (ua.includes("win")) return "windows";
  return "linux";
}

interface PathInstructionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PathInstructionsModal({
  open,
  onOpenChange,
}: PathInstructionsModalProps) {
  const { t } = useTranslation();
  const [platform, setPlatform] = useState<Platform>(detectPlatform);

  const platforms: { id: Platform; label: string; icon: typeof Apple }[] = [
    { id: "mac", label: t("pathinstructionsmodal.general.macos"), icon: platformIcons.mac },
    { id: "windows", label: t("pathinstructionsmodal.general.windows"), icon: platformIcons.windows },
    { id: "linux", label: t("pathinstructionsmodal.general.linux"), icon: platformIcons.linux },
  ];

  const instructions: Record<Platform, { steps: string[]; tip?: string }> = {
    mac: {
      steps: [
        t("pathinstructionsmodal.general.macStepOpenFinder"),
        t("pathinstructionsmodal.general.macStepRightClick"),
        t("pathinstructionsmodal.general.macStepHoldOption"),
        t("pathinstructionsmodal.general.macStepClickCopy"),
      ],
      tip: t("pathinstructionsmodal.general.macTip"),
    },
    windows: {
      steps: [
        t("pathinstructionsmodal.general.windowsStepOpenExplorer"),
        t("pathinstructionsmodal.general.windowsStepClickAddressBar"),
        t("pathinstructionsmodal.general.windowsStepCopyPath"),
      ],
      tip: t("pathinstructionsmodal.general.windowsTip"),
    },
    linux: {
      steps: [
        t("pathinstructionsmodal.general.linuxStepOpenTerminal"),
        t("pathinstructionsmodal.general.linuxStepRunPwd"),
        t("pathinstructionsmodal.general.linuxStepCopyOutput"),
      ],
      tip: t("pathinstructionsmodal.general.linuxTip"),
    },
  };

  const current = instructions[platform];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{t("pathinstructionsmodal.general.howToGetA")}</DialogTitle>
          <DialogDescription>
            {t("pathinstructionsmodal.general.pasteTheAbsolutePath")}{" "}
            <code className="text-xs bg-muted px-1 py-0.5 rounded">/Users/you/project</code>
            {t("pathinstructionsmodal.general.intoTheInput")}
          </DialogDescription>
        </DialogHeader>

        {/* Platform tabs */}
        <div className="flex gap-1 rounded-md border border-border p-0.5">
          {platforms.map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "flex flex-1 items-center justify-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
                platform === p.id
                  ? "bg-accent text-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
              )}
              onClick={() => setPlatform(p.id)}
            >
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        {/* Steps */}
        <ol className="space-y-2 text-sm">
          {current.steps.map((step, i) => (
            <li key={i} className="flex gap-2">
              <span className="text-muted-foreground font-mono text-xs mt-0.5 shrink-0">
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {current.tip && (
          <p className="text-xs text-muted-foreground border-l-2 border-border pl-3">
            {current.tip}
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Small "Choose" button that opens the PathInstructionsModal.
 * Drop-in replacement for the old showDirectoryPicker buttons.
 */
export function ChoosePathButton({ className }: { className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cn(
          "inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent/50 transition-colors shrink-0",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        {t("pathinstructionsmodal.general.choose")}
      </button>
      <PathInstructionsModal open={open} onOpenChange={setOpen} />
    </>
  );
}
