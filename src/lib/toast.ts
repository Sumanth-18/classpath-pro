/**
 * Centralized toast wrapper for the whole app.
 *
 * - Standardizes look: success = green, error = red, bottom-right, 3s auto-dismiss.
 * - Drop-in compatible with the previous `react-hot-toast` API:
 *     toast("message")
 *     toast.success("...")
 *     toast.error("...")
 *
 * Powered by `sonner` under the hood. The global <Toaster /> in App.tsx
 * supplies position + duration + theme.
 */
import { toast as sonner } from "sonner";

type Toast = ((msg: string, opts?: Record<string, unknown>) => string | number) & {
  success: (msg: string, opts?: Record<string, unknown>) => string | number;
  error: (msg: string, opts?: Record<string, unknown>) => string | number;
  info: (msg: string, opts?: Record<string, unknown>) => string | number;
  warning: (msg: string, opts?: Record<string, unknown>) => string | number;
  loading: (msg: string, opts?: Record<string, unknown>) => string | number;
  dismiss: (id?: string | number) => void;
  promise: typeof sonner.promise;
};

const fn = ((msg: string, opts?: Record<string, unknown>) => sonner(msg, opts)) as Toast;
fn.success = (msg, opts) => sonner.success(msg, opts);
fn.error = (msg, opts) => sonner.error(msg, opts);
fn.info = (msg, opts) => sonner.info(msg, opts);
fn.warning = (msg, opts) => sonner.warning(msg, opts);
fn.loading = (msg, opts) => sonner.loading(msg, opts);
fn.dismiss = (id) => sonner.dismiss(id);
fn.promise = sonner.promise.bind(sonner);

export const toast = fn;
export default fn;
