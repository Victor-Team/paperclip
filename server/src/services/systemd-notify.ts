import { execFile } from "node:child_process";

// systemd hands NOTIFY_SOCKET to this service, and every child inherits it by
// default. The unit runs with NotifyAccess=all (our notifications come from a
// `systemd-notify` child), so any descendant can speak for the service. An
// agent that starts and stops an isolated Paperclip instance for verification
// makes that instance send STOPPING=1 on shutdown; systemd then treats the
// real server as stopping, sends no signal, and SIGKILLs the whole unit when
// the stop timeout expires. Keep the socket for our own notifications only.
const notifySocket = process.env.NOTIFY_SOCKET?.trim() || null;
delete process.env.NOTIFY_SOCKET;

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
