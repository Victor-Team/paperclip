import fs from "node:fs";
import path from "node:path";
import { resolvePaperclipInstanceRootForAdapter } from "./server-utils.js";

// When Paperclip runs as a systemd user service, the service manager hands the
// server XDG_RUNTIME_DIR and DBUS_SESSION_BUS_ADDRESS, and every child inherits
// them. With those two variables any agent child can run `systemctl --user
// stop paperclipai.service` (for example a CLI test suite that installs and
// stops "its" service) and take down the real server; an explicit stop is not
// covered by Restart=always. Children get a private, empty runtime directory
// and a disabled session bus instead. NOTIFY_SOCKET is handled separately in
// the server's systemd-notify service.
//
// Off switch for the rare deployment whose agents must reach the host user
// service manager: set it to 0, false, no, or off.
export const HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV = "PAPERCLIP_HOST_SERVICE_MANAGER_ISOLATION";
export const ISOLATED_DBUS_SESSION_BUS_ADDRESS = "disabled:";

const FALSY_ENV_RE = /^(0|false|no|off)$/i;
const COMPANY_ID_SEGMENT_RE = /^[a-zA-Z0-9_-]+$/;
const ISOLATED_KEYS = ["XDG_RUNTIME_DIR", "DBUS_SESSION_BUS_ADDRESS"] as const;

function present(value: string | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

export function isHostServiceManagerIsolationEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env[HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV];
  if (typeof raw !== "string") return true;
  return !FALSY_ENV_RE.test(raw.trim());
}

/**
 * True when children of this process must be kept away from the host user
 * service manager: Linux, switch on, and either a supervisor marker
 * (PAPERCLIP_SERVICE_MANAGED=1, systemd's INVOCATION_ID) or one of the two
 * bus-locating variables is present.
 */
export function shouldIsolateFromHostServiceManager(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (platform !== "linux") return false;
  if (!isHostServiceManagerIsolationEnabled(env)) return false;
  return (
    env.PAPERCLIP_SERVICE_MANAGED === "1" ||
    present(env.INVOCATION_ID) ||
    present(env.XDG_RUNTIME_DIR) ||
    present(env.DBUS_SESSION_BUS_ADDRESS)
  );
}

function ensurePrivateDir(dir: string): boolean {
  try {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    fs.chmodSync(dir, 0o700);
    return true;
  } catch {
    return false;
  }
}

/**
 * `<instance>/companies/<companyId>/run` when a valid company id is given and
 * the directory can be prepared, else `<instance>/run`. The directory is
 * created with mode 0700. The path is returned even when it cannot be created:
 * a missing runtime directory still keeps `systemctl --user` off the host bus,
 * so a failed mkdir must never fall back to the host value.
 */
export function resolveIsolatedRuntimeDir(
  companyId: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const instanceRoot = resolvePaperclipInstanceRootForAdapter({ env });
  const trimmed = companyId?.trim() ?? "";
  if (trimmed && COMPANY_ID_SEGMENT_RE.test(trimmed)) {
    const companyDir = path.resolve(instanceRoot, "companies", trimmed, "run");
    if (ensurePrivateDir(companyDir)) return companyDir;
  }
  const instanceDir = path.resolve(instanceRoot, "run");
  ensurePrivateDir(instanceDir);
  return instanceDir;
}

/**
 * Process-level guard, run once at server startup: replaces the two variables
 * in `env` (normally `process.env`) with the instance-level private runtime
 * directory and a disabled bus, so every descendant of the server -- including
 * external adapter plugins that bundle their own adapter-utils -- inherits the
 * isolated values. Returns true when it changed anything.
 */
export function isolateProcessEnvFromHostServiceManager(
  env: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): boolean {
  if (!shouldIsolateFromHostServiceManager(env, platform)) return false;
  env.XDG_RUNTIME_DIR = resolveIsolatedRuntimeDir(null, env);
  env.DBUS_SESSION_BUS_ADDRESS = ISOLATED_DBUS_SESSION_BUS_ADDRESS;
  return true;
}

/**
 * Per-spawn guard for a child environment built on top of `inheritedEnv`.
 * A variable that is missing from `childEnv` or still equals the inherited
 * value is treated as inherited and replaced (XDG_RUNTIME_DIR with the
 * company's private runtime directory, the bus with `disabled:`). A value that
 * differs from the inherited one came from agent configuration and is kept.
 * Mutates and returns `childEnv`.
 */
export function applyHostServiceManagerIsolation<T extends Record<string, string | undefined>>(
  childEnv: T,
  options: {
    companyId?: string | null;
    inheritedEnv?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
  } = {},
): T {
  const inheritedEnv = options.inheritedEnv ?? process.env;
  const platform = options.platform ?? process.platform;
  if (platform !== "linux" || !isHostServiceManagerIsolationEnabled(inheritedEnv)) return childEnv;
  const active =
    shouldIsolateFromHostServiceManager(inheritedEnv, platform) ||
    ISOLATED_KEYS.some((key) => present(childEnv[key]));
  if (!active) return childEnv;
  const isInherited = (key: (typeof ISOLATED_KEYS)[number]) =>
    !present(childEnv[key]) || childEnv[key] === inheritedEnv[key];
  const env = childEnv as Record<string, string | undefined>;
  if (isInherited("XDG_RUNTIME_DIR")) {
    env.XDG_RUNTIME_DIR = resolveIsolatedRuntimeDir(options.companyId, inheritedEnv);
  }
  if (isInherited("DBUS_SESSION_BUS_ADDRESS")) {
    env.DBUS_SESSION_BUS_ADDRESS = ISOLATED_DBUS_SESSION_BUS_ADDRESS;
  }
  return childEnv;
}
