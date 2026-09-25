import { afterEach, describe, expect, it, vi } from "vitest";

const execFile = vi.hoisted(() => vi.fn());
vi.mock("node:child_process", () => ({ execFile }));

describe("systemdNotify", () => {
  afterEach(() => {
    delete process.env.NOTIFY_SOCKET;
    execFile.mockReset();
    vi.resetModules();
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
