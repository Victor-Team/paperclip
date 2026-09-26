import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV,
  applyHostServiceManagerIsolation,
  isolateProcessEnvFromHostServiceManager,
  shouldIsolateFromHostServiceManager,
} from "./host-service-manager-env.js";
import { runChildProcess } from "./server-utils.js";

const HOST_XDG = "/run/user/4242";
const HOST_DBUS = "unix:path=/run/user/4242/bus";
const COMPANY_ID = "company-57";
const SAVED_KEYS = [
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "PAPERCLIP_HOME",
  "PAPERCLIP_INSTANCE_ID",
  "PAPERCLIP_SERVICE_MANAGED",
  "INVOCATION_ID",
  HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV,
] as const;

let home: string;
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = Object.fromEntries(SAVED_KEYS.map((key) => [key, process.env[key]]));
  for (const key of SAVED_KEYS) delete process.env[key];
  home = fs.mkdtempSync(path.join(os.tmpdir(), "pc57-"));
  process.env.PAPERCLIP_HOME = home;
});

afterEach(() => {
  for (const key of SAVED_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  fs.rmSync(home, { recursive: true, force: true });
});

const instanceRunDir = () => path.join(home, "instances", "default", "run");
const companyRunDir = () => path.join(home, "instances", "default", "companies", COMPANY_ID, "run");
const modeOf = (dir: string) => fs.statSync(dir).mode & 0o777;

describe("process-level isolation (server startup)", () => {
  it("replaces the host runtime dir and bus with a private 0700 instance dir and a disabled bus", () => {
    const env: NodeJS.ProcessEnv = { PAPERCLIP_HOME: home, XDG_RUNTIME_DIR: HOST_XDG, DBUS_SESSION_BUS_ADDRESS: HOST_DBUS };
    expect(isolateProcessEnvFromHostServiceManager(env, "linux")).toBe(true);
    expect(env.XDG_RUNTIME_DIR).toBe(instanceRunDir());
    expect(env.DBUS_SESSION_BUS_ADDRESS).toBe("disabled:");
    expect(modeOf(instanceRunDir())).toBe(0o700);
  });

  it("activates on the service marker alone", () => {
    const env: NodeJS.ProcessEnv = { PAPERCLIP_HOME: home, PAPERCLIP_SERVICE_MANAGED: "1" };
    expect(isolateProcessEnvFromHostServiceManager(env, "linux")).toBe(true);
    expect(env.XDG_RUNTIME_DIR).toBe(instanceRunDir());
    expect(env.DBUS_SESSION_BUS_ADDRESS).toBe("disabled:");
  });

  it("tightens an existing, too-open runtime directory to 0700", () => {
    fs.mkdirSync(instanceRunDir(), { recursive: true, mode: 0o755 });
    fs.chmodSync(instanceRunDir(), 0o755);
    const env: NodeJS.ProcessEnv = { PAPERCLIP_HOME: home, XDG_RUNTIME_DIR: HOST_XDG };
    isolateProcessEnvFromHostServiceManager(env, "linux");
    expect(modeOf(instanceRunDir())).toBe(0o700);
  });

  it("leaves the environment untouched when the switch is off", () => {
    for (const value of ["0", "false", "no", "OFF"]) {
      const env: NodeJS.ProcessEnv = {
        PAPERCLIP_HOME: home,
        XDG_RUNTIME_DIR: HOST_XDG,
        DBUS_SESSION_BUS_ADDRESS: HOST_DBUS,
        [HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV]: value,
      };
      expect(isolateProcessEnvFromHostServiceManager(env, "linux")).toBe(false);
      expect(env.XDG_RUNTIME_DIR).toBe(HOST_XDG);
      expect(env.DBUS_SESSION_BUS_ADDRESS).toBe(HOST_DBUS);
    }
    expect(fs.existsSync(instanceRunDir())).toBe(false);
  });

  it("does nothing without any service-manager marker, or off Linux", () => {
    const bare: NodeJS.ProcessEnv = { PAPERCLIP_HOME: home };
    expect(isolateProcessEnvFromHostServiceManager(bare, "linux")).toBe(false);
    expect(bare.XDG_RUNTIME_DIR).toBeUndefined();
    const mac: NodeJS.ProcessEnv = { PAPERCLIP_HOME: home, XDG_RUNTIME_DIR: HOST_XDG };
    expect(isolateProcessEnvFromHostServiceManager(mac, "darwin")).toBe(false);
    expect(mac.XDG_RUNTIME_DIR).toBe(HOST_XDG);
    expect(shouldIsolateFromHostServiceManager({ INVOCATION_ID: "abc" }, "linux")).toBe(true);
  });
});

describe("per-spawn isolation", () => {
  const inherited = (): NodeJS.ProcessEnv => ({
    PAPERCLIP_HOME: home,
    XDG_RUNTIME_DIR: HOST_XDG,
    DBUS_SESSION_BUS_ADDRESS: HOST_DBUS,
  });

  it("replaces inherited values with the company's private runtime dir and a disabled bus", () => {
    const child: Record<string, string | undefined> = { XDG_RUNTIME_DIR: HOST_XDG, DBUS_SESSION_BUS_ADDRESS: HOST_DBUS };
    applyHostServiceManagerIsolation(child, { companyId: COMPANY_ID, inheritedEnv: inherited(), platform: "linux" });
    expect(child.XDG_RUNTIME_DIR).toBe(companyRunDir());
    expect(child.DBUS_SESSION_BUS_ADDRESS).toBe("disabled:");
    expect(modeOf(companyRunDir())).toBe(0o700);
  });

  it("fills in the isolated values when the child env does not carry them", () => {
    const child: Record<string, string | undefined> = {};
    applyHostServiceManagerIsolation(child, { companyId: COMPANY_ID, inheritedEnv: inherited(), platform: "linux" });
    expect(child.XDG_RUNTIME_DIR).toBe(companyRunDir());
    expect(child.DBUS_SESSION_BUS_ADDRESS).toBe("disabled:");
  });

  it("keeps values the agent configured explicitly", () => {
    const child: Record<string, string | undefined> = {
      XDG_RUNTIME_DIR: "/srv/agent-run",
      DBUS_SESSION_BUS_ADDRESS: "unix:path=/srv/agent-bus",
    };
    applyHostServiceManagerIsolation(child, { companyId: COMPANY_ID, inheritedEnv: inherited(), platform: "linux" });
    expect(child.XDG_RUNTIME_DIR).toBe("/srv/agent-run");
    expect(child.DBUS_SESSION_BUS_ADDRESS).toBe("unix:path=/srv/agent-bus");
  });

  it("falls back to the instance runtime dir without a usable company id", () => {
    for (const companyId of [undefined, "../escape"]) {
      const child: Record<string, string | undefined> = {};
      applyHostServiceManagerIsolation(child, { companyId, inheritedEnv: inherited(), platform: "linux" });
      expect(child.XDG_RUNTIME_DIR).toBe(instanceRunDir());
    }
    expect(fs.existsSync(path.join(home, "instances", "default", "companies"))).toBe(false);
  });

  it("changes nothing when the switch is off", () => {
    const child: Record<string, string | undefined> = { XDG_RUNTIME_DIR: HOST_XDG, DBUS_SESSION_BUS_ADDRESS: HOST_DBUS };
    applyHostServiceManagerIsolation(child, {
      companyId: COMPANY_ID,
      inheritedEnv: { ...inherited(), [HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV]: "off" },
      platform: "linux",
    });
    expect(child.XDG_RUNTIME_DIR).toBe(HOST_XDG);
    expect(child.DBUS_SESSION_BUS_ADDRESS).toBe(HOST_DBUS);
  });
});

async function runAndReadEnv(env: Record<string, string>) {
  const script = "process.stdout.write(JSON.stringify({x:process.env.XDG_RUNTIME_DIR??null,d:process.env.DBUS_SESSION_BUS_ADDRESS??null}))";
  const result = await runChildProcess("pc57-env", process.execPath, ["-e", script], {
    cwd: home,
    env,
    timeoutSec: 30,
    graceSec: 1,
    onLog: async () => {},
  });
  expect(result.exitCode).toBe(0);
  return JSON.parse(result.stdout) as { x: string | null; d: string | null };
}

describe("runChildProcess (the local spawn every CLI adapter goes through)", () => {
  it("spawns the child with the company runtime dir and a disabled bus instead of the host's", async () => {
    process.env.XDG_RUNTIME_DIR = HOST_XDG;
    process.env.DBUS_SESSION_BUS_ADDRESS = HOST_DBUS;
    const seen = await runAndReadEnv({ PAPERCLIP_COMPANY_ID: COMPANY_ID });
    expect(seen).toEqual({ x: companyRunDir(), d: "disabled:" });
  });

  it("isolates even when the adapter spread process.env into its own env", async () => {
    process.env.XDG_RUNTIME_DIR = HOST_XDG;
    process.env.DBUS_SESSION_BUS_ADDRESS = HOST_DBUS;
    const seen = await runAndReadEnv({ PAPERCLIP_COMPANY_ID: COMPANY_ID, XDG_RUNTIME_DIR: HOST_XDG, DBUS_SESSION_BUS_ADDRESS: HOST_DBUS });
    expect(seen).toEqual({ x: companyRunDir(), d: "disabled:" });
  });

  it("passes explicitly configured agent values through", async () => {
    process.env.XDG_RUNTIME_DIR = HOST_XDG;
    process.env.DBUS_SESSION_BUS_ADDRESS = HOST_DBUS;
    const seen = await runAndReadEnv({
      PAPERCLIP_COMPANY_ID: COMPANY_ID,
      XDG_RUNTIME_DIR: "/srv/agent-run",
      DBUS_SESSION_BUS_ADDRESS: "unix:path=/srv/agent-bus",
    });
    expect(seen).toEqual({ x: "/srv/agent-run", d: "unix:path=/srv/agent-bus" });
  });

  it("hands the host values through unchanged when the switch is off", async () => {
    process.env.XDG_RUNTIME_DIR = HOST_XDG;
    process.env.DBUS_SESSION_BUS_ADDRESS = HOST_DBUS;
    process.env[HOST_SERVICE_MANAGER_ISOLATION_OFF_SWITCH_ENV] = "0";
    const seen = await runAndReadEnv({ PAPERCLIP_COMPANY_ID: COMPANY_ID });
    expect(seen).toEqual({ x: HOST_XDG, d: HOST_DBUS });
  });
});

function findOnPath(command: string): string | null {
  for (const dir of (process.env.PATH ?? "").split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

const systemctlPath = process.platform === "linux" ? findOnPath("systemctl") : null;

describe("real systemctl probe", () => {
  // The only conditional skip in this file: the probe needs a systemctl binary.
  // Safety: the probe is a read-only `is-active` on a unit that does not exist,
  // and the "host" bus it could reach is a fake one this test owns, never the
  // real user service manager.
  it.skipIf(systemctlPath === null)(
    "cannot reach the (fake) host user service manager [skipped only when systemctl is not on PATH]",
    async () => {
      const hostRun = fs.mkdtempSync(path.join(os.tmpdir(), "pc57h-"));
      const connections: string[] = [];
      const servers: net.Server[] = [];
      try {
        fs.mkdirSync(path.join(hostRun, "systemd"), { mode: 0o700 });
        for (const socketPath of [path.join(hostRun, "systemd", "private"), path.join(hostRun, "bus")]) {
          const server = net.createServer((socket) => {
            connections.push(socketPath);
            socket.destroy();
          });
          await new Promise<void>((resolve) => server.listen(socketPath, resolve));
          servers.push(server);
        }
        process.env.XDG_RUNTIME_DIR = hostRun;
        process.env.DBUS_SESSION_BUS_ADDRESS = `unix:path=${path.join(hostRun, "bus")}`;

        const result = await runChildProcess(
          "pc57-systemctl",
          systemctlPath!,
          ["--user", "is-active", "paperclip-nonexistent-probe.service"],
          {
            cwd: home,
            env: { PAPERCLIP_COMPANY_ID: COMPANY_ID },
            timeoutSec: 30,
            graceSec: 1,
            onLog: async () => {},
          },
        );
        expect(`${result.stdout}${result.stderr}`).toContain("Failed to connect to bus");
        expect(connections).toEqual([]);
      } finally {
        await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
        fs.rmSync(hostRun, { recursive: true, force: true });
      }
    },
  );
});
