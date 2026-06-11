/**
 * Cross-platform confirm/alert. Native uses Alert.alert. Web does NOT use window.alert /
 * window.confirm: those synchronously BLOCK the renderer — the app reads as hard-frozen
 * under test automation (the dialog is invisible to it) and to impatient users — and they
 * look nothing like the product. Web dialogs render through <DialogHost/> (mounted once in
 * the root layout) as a normal, non-blocking in-app modal.
 */
import { Alert, Platform } from 'react-native';

export interface DialogRequest {
  title: string;
  message: string;
  confirmLabel: string;
  /** true → Cancel + confirm buttons (confirm dialog); false → single OK (info alert). */
  cancelable: boolean;
  resolve: (ok: boolean) => void;
}

// Tiny module-level pub/sub: these helpers are called from plain functions, so they can't
// render — DialogHost subscribes and renders whatever is pending, one dialog at a time.
let current: DialogRequest | null = null;
const queue: DialogRequest[] = [];
let notify: ((d: DialogRequest | null) => void) | null = null;

function show(req: DialogRequest) {
  if (current) {
    queue.push(req);
    return;
  }
  current = req;
  notify?.(req);
}

/** DialogHost wiring: subscribe to dialog requests. Returns an unsubscribe. */
export function onDialog(cb: (d: DialogRequest | null) => void): () => void {
  notify = cb;
  cb(current);
  return () => {
    if (notify === cb) notify = null;
  };
}

/** DialogHost wiring: resolve the visible dialog and advance the queue. */
export function settleDialog(ok: boolean) {
  const d = current;
  current = queue.shift() ?? null;
  notify?.(current);
  d?.resolve(ok);
}

/** Two-button confirm. Resolves true when the user accepts. */
export function confirmAsync(title: string, message: string, confirmLabel = 'OK'): Promise<boolean> {
  if (Platform.OS === 'web') {
    return new Promise((resolve) => show({ title, message, confirmLabel, cancelable: true, resolve }));
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, onPress: () => resolve(true) },
    ]);
  });
}

/** One-button informational alert. */
export function alertInfo(title: string, message: string): void {
  if (Platform.OS === 'web') {
    show({ title, message, confirmLabel: 'OK', cancelable: false, resolve: () => {} });
    return;
  }
  Alert.alert(title, message);
}
