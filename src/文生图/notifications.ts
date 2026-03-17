type NotificationTone = 'success' | 'info' | 'warning' | 'error';

type ToastOptions = {
  title?: string;
  timeOut?: number;
  extendedTimeOut?: number;
  dedupeKey?: string;
  escapeHtml?: boolean;
};

type ToastrLike = {
  success(message?: string, title?: string, options?: Record<string, unknown>): unknown;
  info(message?: string, title?: string, options?: Record<string, unknown>): unknown;
  warning(message?: string, title?: string, options?: Record<string, unknown>): unknown;
  error(message?: string, title?: string, options?: Record<string, unknown>): unknown;
  clear(toast?: unknown): void;
};

const SCRIPT_ID = 'tti-image-workbench';
const STYLE_ID = `${SCRIPT_ID}-toast-style`;
const DEFAULT_TITLE = '文生图';
const dedupeMap = new Map<string, number>();
let stylesInjected = false;

function getTopWindow(): Window & { toastr?: ToastrLike } {
  return (window.parent && window.parent !== window ? window.parent : window) as Window & { toastr?: ToastrLike };
}

function getToastrRef(): ToastrLike | null {
  const topWindow = getTopWindow();
  return topWindow.toastr ?? (window as Window & { toastr?: ToastrLike }).toastr ?? null;
}

function ensureToastStylesInjected(): void {
  if (stylesInjected) {
    return;
  }

  try {
    const doc = getTopWindow().document;
    if (doc.getElementById(STYLE_ID)) {
      stylesInjected = true;
      return;
    }

    const style = doc.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      .tti-toast.toast {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "HarmonyOS Sans SC", "MiSans", Roboto, Helvetica, Arial, sans-serif;
        --tti-toast-accent: #72b6ff;
        background: linear-gradient(90deg, var(--tti-toast-accent) 0 4px, #0d1520 4px) !important;
        color: #f2f6ff !important;
        border: 1px solid rgba(255,255,255,0.16) !important;
        border-radius: 12px !important;
        box-shadow: 0 18px 60px rgba(0,0,0,0.55) !important;
        padding: 12px 14px 12px 50px !important;
        width: min(420px, calc(100vw - 24px)) !important;
        opacity: 1 !important;
        position: relative !important;
        overflow: hidden !important;
      }
      #toast-container .tti-toast.toast,
      #toast-container .tti-toast.toast.toast-success,
      #toast-container .tti-toast.toast.toast-info,
      #toast-container .tti-toast.toast.toast-warning,
      #toast-container .tti-toast.toast.toast-error {
        background: linear-gradient(90deg, var(--tti-toast-accent) 0 4px, #0d1520 4px) !important;
        background-color: #0d1520 !important;
        background-image: none !important;
        opacity: 1 !important;
      }
      .tti-toast.toast,
      .tti-toast.toast.toast-success,
      .tti-toast.toast.toast-info,
      .tti-toast.toast.toast-warning,
      .tti-toast.toast.toast-error {
        background-image: none !important;
      }
      .tti-toast.toast::before {
        content: "i";
        position: absolute;
        left: 12px;
        top: 12px;
        width: 28px;
        height: 28px;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 14px;
        color: #f2f6ff;
        background: #182235;
        border: 1px solid rgba(255,255,255,0.18);
        box-shadow: 0 8px 18px rgba(0,0,0,0.28);
      }
      .tti-toast.tti-toast--success { --tti-toast-accent: #4ad19f; }
      .tti-toast.tti-toast--info { --tti-toast-accent: #72b6ff; }
      .tti-toast.tti-toast--warning { --tti-toast-accent: #ffb85c; }
      .tti-toast.tti-toast--error { --tti-toast-accent: #ff6b6b; }
      .tti-toast.tti-toast--success::before { content: "✓"; }
      .tti-toast.tti-toast--info::before { content: "i"; }
      .tti-toast.tti-toast--warning::before { content: "!"; }
      .tti-toast.tti-toast--error::before { content: "×"; }
      .tti-toast.toast .toast-title {
        font-weight: 750 !important;
        letter-spacing: 0.2px;
        margin-bottom: 4px !important;
        opacity: 0.95;
      }
      .tti-toast.toast .toast-message {
        line-height: 1.45;
        color: rgba(242,246,255,0.86) !important;
      }
      .tti-toast.toast .toast-close-button {
        color: rgba(255,255,255,0.65) !important;
        opacity: 0.85 !important;
      }
      .tti-toast.toast .toast-progress {
        background: rgba(114,182,255,0.55) !important;
      }
    `;
    doc.head.appendChild(style);
  } catch {
    // Ignore style injection failures.
  } finally {
    stylesInjected = true;
  }
}

function normalizeToastOptions(type: NotificationTone, options: ToastOptions = {}): { title: string; toastrOptions: Record<string, unknown> } {
  const width = (() => {
    try {
      return getTopWindow().innerWidth;
    } catch {
      return window.innerWidth;
    }
  })();

  const defaultTimeOut =
    type === 'success' ? 2500 :
    type === 'info' ? 2600 :
    type === 'warning' ? 3600 :
    5200;

  return {
    title: options.title || DEFAULT_TITLE,
    toastrOptions: {
      escapeHtml: options.escapeHtml ?? false,
      closeButton: true,
      progressBar: true,
      newestOnTop: true,
      tapToDismiss: true,
      timeOut: options.timeOut ?? defaultTimeOut,
      extendedTimeOut: options.extendedTimeOut ?? 1000,
      toastClass: `toast tti-toast tti-toast--${type}`,
      positionClass: width <= 520 ? 'toast-top-center' : 'toast-top-right',
    },
  };
}

export function showWorkbenchToast(type: NotificationTone, message: string, options: ToastOptions = {}): unknown {
  const toastrRef = getToastrRef();
  if (!toastrRef) {
    return null;
  }

  if (options.dedupeKey) {
    const now = Date.now();
    const lastAt = dedupeMap.get(options.dedupeKey) ?? 0;
    if (now - lastAt < 1200) {
      return null;
    }
    dedupeMap.set(options.dedupeKey, now);
  }

  ensureToastStylesInjected();
  const { title, toastrOptions } = normalizeToastOptions(type, options);
  return toastrRef[type](message, title, toastrOptions);
}

export function clearWorkbenchToast(toast?: unknown): void {
  const toastrRef = getToastrRef();
  if (!toastrRef) {
    return;
  }
  toastrRef.clear(toast);
}
