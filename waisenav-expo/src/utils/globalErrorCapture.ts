/**
 * Every TestFlight build has crashed at launch with an identical native
 * signature: RN's own ExceptionsManager.reportException -> RCTFatal. That
 * mechanism fires for ANY uncaught JS exception anywhere in the app
 * (module-scope code, effects, native callbacks) — it's RN's default
 * global error handler, and it never surfaces the actual JS message in
 * Apple's crash reports (confirmed across 7 different code
 * configurations that all crashed identically). This installs OUR OWN
 * global handler first, so we see the real error on screen instead of a
 * native abort with no message.
 */
type Listener = (message: string, isFatal: boolean) => void;

let listener: Listener | null = null;
// Buffered so an error firing before any React component has mounted
// (still possible even with this installed first, if some imported
// module throws at its own top-level/module-scope) isn't lost — App's
// initial render reads this synchronously instead of only via effect.
let lastMessage: string | null = null;

export function setGlobalErrorListener(fn: Listener | null) {
  listener = fn;
}

export function getBufferedError() {
  return lastMessage;
}

export function installGlobalErrorCapture() {
  const g = global as any;
  if (!g.ErrorUtils) return;

  const originalHandler = g.ErrorUtils.getGlobalHandler?.();

  g.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
    const message = `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}\n\n${error?.stack ?? ''}`;
    lastMessage = message;
    // eslint-disable-next-line no-console
    console.error('[GlobalErrorCapture]', message);
    if (listener) {
      listener(message, !!isFatal);
    } else if (originalHandler) {
      // No screen subscribed yet (shouldn't happen, App mounts this
      // immediately) — fall back to default behavior rather than
      // swallowing the error silently.
      originalHandler(error, isFatal);
    }
  });
}
