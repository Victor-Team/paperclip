import { execFile } from "node:child_process";
import { isolateProcessEnvFromHostServiceManager } from "@paperclipai/adapter-utils/host-service-manager-env";

// systemd hands NOTIFY_SOCKET to this service, and every child inherits it by
// default. The unit runs with NotifyAccess=all (our notifications come from a
// `systemd-notify` child), so any descendant can speak for the service. An
// agent that starts and stops an isolated Paperclip instance for verification
// makes that instance send STOPPING=1 on shutdown; systemd then treats the
// real server as stopping, sends no signal, and SIGKILLs the whole unit when
// the stop timeout expires. Keep the socket for our own notifications only.
const notifySocket = process.env.NOTIFY_SOCKET?.trim() || null;
delete process.env.NOTIFY_SOCKET;
// The same inheritance lets any descendant run `systemctl --user stop` on the
// real service through XDG_RUNTIME_DIR / DBUS_SESSION_BUS_ADDRESS (an agent's
// CLI test suite did exactly that). Replace both for every descendant,
// including external adapter plugins that bundle their own adapter-utils.
isolateProcessEnvFromHostServiceManager(process.env);

export async function systemdNotify(args: string[]): Promise<boolean> {
  if (!notifySocket) return false;
  return await new Promise<boolean>((resolve) => {
    execFile(
      "systemd-notify",
      args,
      { windowsHide: true, env: { ...process.env, NOTIFY_SOCKET: notifySocket } },
      (error) => resolve(!error),
    );
  });
}
