import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const execFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile }));

const ENV_KEYS = [
  "NOTIFY_SOCKET",
  "XDG_RUNTIME_DIR",
  "DBUS_SESSION_BUS_ADDRESS",
  "PAPERCLIP_HOME",
  "PAPERCLIP_INSTANCE_ID",
  "PAPERCLIP_SERVICE_MANAGED",
  "INVOCATION_ID",
  "PAPERCLIP_HOST_SERVICE_MANAGER_ISOLATION",
] as const;

describe("systemdNotify", () => {
  let saved: Record<string, string | undefined> = {};
  let home = "";

  beforeEach(() => {
    saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
    for (const key of ENV_KEYS) delete process.env[key];
    // Importing the module isolates process.env; keep its runtime dir out of
    // the real ~/.paperclip.
    home = fs.mkdtempSync(path.join(os.tmpdir(), "pc57-notify-"));
    process.env.PAPERCLIP_HOME = home;
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    fs.rmSync(home, { recursive: true, force: true });
    execFile.mockReset();
    vi.resetModules();
  });

  it("replaces the user service manager's runtime dir and bus for every descendant", async () => {
    process.env.XDG_RUNTIME_DIR = "/run/user/4242";
    process.env.DBUS_SESSION_BUS_ADDRESS = "unix:path=/run/user/4242/bus";
    await import("./systemd-notify.js");
    const runDir = path.join(home, "instances", "default", "run");
    expect(process.env.XDG_RUNTIME_DIR).toBe(runDir);
    expect(process.env.DBUS_SESSION_BUS_ADDRESS).toBe("disabled:");
    expect(fs.statSync(runDir).mode & 0o777).toBe(0o700);
  });

  it("leaves the runtime dir and bus alone when the operator switched isolation off", async () => {
    process.env.XDG_RUNTIME_DIR = "/run/user/4242";
    process.env.DBUS_SESSION_BUS_ADDRESS = "unix:path=/run/user/4242/bus";
    process.env.PAPERCLIP_HOST_SERVICE_MANAGER_ISOLATION = "0";
    await import("./systemd-notify.js");
    expect(process.env.XDG_RUNTIME_DIR).toBe("/run/user/4242");
    expect(process.env.DBUS_SESSION_BUS_ADDRESS).toBe("unix:path=/run/user/4242/bus");
  });

  it("keeps the notify socket out of the environment children inherit", async () => {
    process.env.NOTIFY_SOCKET = "/run/user/1000/systemd/notify";
    await import("./systemd-notify.js");
    expect(process.env.NOTIFY_SOCKET).toBeUndefined();
  });

  it("still hands the socket to its own systemd-notify call", async () => {
    process.env.NOTIFY_SOCKET = "/run/user/1000/systemd/notify";
    const { systemdNotify } = await import("./systemd-notify.js");
    execFile.mockImplementation((_file, _args, _options, callback) => callback(null));
    await expect(systemdNotify(["--ready"])).resolves.toBe(true);
    expect(execFile).toHaveBeenCalledTimes(1);
    const [file, args, options] = execFile.mock.calls[0]!;
    expect(file).toBe("systemd-notify");
    expect(args).toEqual(["--ready"]);
    expect(options.env.NOTIFY_SOCKET).toBe("/run/user/1000/systemd/notify");
  });

  it("does nothing outside systemd", async () => {
    const { systemdNotify } = await import("./systemd-notify.js");
    await expect(systemdNotify(["--stopping"])).resolves.toBe(false);
    expect(execFile).not.toHaveBeenCalled();
  });
});
