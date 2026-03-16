import $ from 'jquery';
import { createApp, type App as VueApp, type Component } from 'vue';
import { createScriptIdDiv, teleportStyle } from '@util/script';

export interface FloatingWindowOptions {
  id: string;
  title: string;
  iconClass?: string;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  maximizable?: boolean;
  startMaximized?: boolean;
  rememberState?: boolean;
  onClose?: () => void;
}

type WindowState = {
  left: number;
  top: number;
  width: number;
  height: number;
  isMaximized: boolean;
};

type ResizeMode = 'e' | 's' | 'se';

type WindowRecord = {
  $overlay: JQuery<HTMLElement>;
  $window: JQuery<HTMLElement>;
  $mountHost: JQuery<HTMLDivElement>;
  app: VueApp;
  destroyTeleportedStyle?: () => void;
};

const WINDOW_STATE_KEY = 'ST_TTI_FLOATING_WINDOW_STATE_V4';
const WINDOW_STYLE_ID = 'tti-floating-window-style-v4';

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function safeNumber(input: unknown, fallback: number): number {
  const parsed = Number(input);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export class FloatingWindowManager {
  private static instance: FloatingWindowManager;

  private readonly topWindow: Window;
  private readonly targetDoc: Document;
  private readonly jq: JQueryStatic;
  private readonly windows = new Map<string, WindowRecord>();

  private stylesInjected = false;
  private zIndex = 13000;

  private constructor() {
    this.topWindow = window.parent && window.parent !== window ? window.parent : window;
    this.targetDoc = this.topWindow.document;
    this.jq =
      ((this.topWindow as unknown as { jQuery?: JQueryStatic }).jQuery ??
        (window as unknown as { jQuery?: JQueryStatic }).jQuery ??
        $) as JQueryStatic;
  }

  public static getInstance(): FloatingWindowManager {
    if (!FloatingWindowManager.instance) {
      FloatingWindowManager.instance = new FloatingWindowManager();
    }
    return FloatingWindowManager.instance;
  }

  public createWindow(options: FloatingWindowOptions, mountVueComponent: Component): VueApp {
    this.injectStyles();

    const existing = this.windows.get(options.id);
    if (existing) {
      this.bringToFront(options.id);
      return existing.app;
    }

    const width = safeNumber(options.width, 1220);
    const height = safeNumber(options.height, 860);
    const minWidth = safeNumber(options.minWidth, 900);
    const minHeight = safeNumber(options.minHeight, 620);
    const resizable = options.resizable !== false;
    const maximizable = options.maximizable !== false;
    const rememberState = options.rememberState !== false;
    const savedState = rememberState ? this.getWindowState(options.id) : null;
    const sizeBounds = this.getSizeBounds(minWidth, minHeight);

    const initialWidth = clamp(savedState?.width ?? width, sizeBounds.minWidth, sizeBounds.maxWidth);
    const initialHeight = clamp(savedState?.height ?? height, sizeBounds.minHeight, sizeBounds.maxHeight);
    const initialLeft = clamp(
      savedState?.left ?? (this.topWindow.innerWidth - initialWidth) / 2,
      0,
      Math.max(0, this.topWindow.innerWidth - initialWidth),
    );
    const initialTop = clamp(
      savedState?.top ?? (this.topWindow.innerHeight - initialHeight) / 2,
      0,
      Math.max(0, this.topWindow.innerHeight - initialHeight),
    );

    const iconClass = options.iconClass ?? 'fa-solid fa-wand-magic-sparkles';
    const ns = `.ttiFloatingWindow_${options.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    const $overlay = this.jq(
      `<div class="tti-floating-window-overlay" data-tti-window-id="${options.id}"></div>`,
    );
    const $window = this.jq(
      `<section class="tti-floating-window" id="${options.id}" data-tti-window-id="${options.id}">
        <header class="tti-floating-window__header">
          <div class="tti-floating-window__title">
            <i class="${iconClass}" aria-hidden="true"></i>
            <span></span>
          </div>
          <div class="tti-floating-window__controls">
            <button type="button" class="tti-floating-window__btn tti-floating-window__btn-max" title="最大化 / 还原">
              <i class="fa-solid fa-expand" aria-hidden="true"></i>
            </button>
            <button type="button" class="tti-floating-window__btn tti-floating-window__btn-close" title="关闭">
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        </header>
        <div class="tti-floating-window__content"></div>
        <div class="tti-floating-window__resize-handle e" data-mode="e"></div>
        <div class="tti-floating-window__resize-handle s" data-mode="s"></div>
        <div class="tti-floating-window__resize-handle se" data-mode="se"></div>
      </section>`,
    );

    $window.find('.tti-floating-window__title span').text(options.title);
    $window.css({
      left: `${initialLeft}px`,
      top: `${initialTop}px`,
      width: `${initialWidth}px`,
      height: `${initialHeight}px`,
    });

    const $mountHost = createScriptIdDiv().addClass('tti-floating-window__mount-host');
    $window.find('.tti-floating-window__content').append($mountHost);

    const app = createApp(mountVueComponent);
    this.windows.set(options.id, {
      $overlay,
      $window,
      $mountHost,
      app,
    });

    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragWindowStartLeft = 0;
    let dragWindowStartTop = 0;

    let activeResizeMode: ResizeMode | null = null;
    let resizeStartX = 0;
    let resizeStartY = 0;
    let resizeStartWidth = 0;
    let resizeStartHeight = 0;
    let resizeStartLeft = 0;
    let resizeStartTop = 0;

    let isMaximized = false;
    let restoreState: WindowState = {
      left: initialLeft,
      top: initialTop,
      width: initialWidth,
      height: initialHeight,
      isMaximized: false,
    };

    const getRect = (): WindowState => ({
      left: safeNumber($window.css('left').replace('px', ''), initialLeft),
      top: safeNumber($window.css('top').replace('px', ''), initialTop),
      width: safeNumber($window.outerWidth(), initialWidth),
      height: safeNumber($window.outerHeight(), initialHeight),
      isMaximized,
    });

    const setMaximizeIcon = (maximized: boolean): void => {
      const $icon = $window.find('.tti-floating-window__btn-max i');
      $icon.removeClass('fa-expand fa-compress').addClass(maximized ? 'fa-compress' : 'fa-expand');
    };

    const saveWindowState = (): void => {
      if (!rememberState) return;
      const rect = getRect();
      this.setWindowState(
        options.id,
        isMaximized ? { ...restoreState, isMaximized: true } : { ...rect, isMaximized: false },
      );
    };

    const applyMaximizedSize = (): void => {
      const gutter = this.getMaximizedGutter();
      $window.css({
        left: `${gutter}px`,
        top: `${gutter}px`,
        width: `${Math.max(320, this.topWindow.innerWidth - gutter * 2)}px`,
        height: `${Math.max(240, this.topWindow.innerHeight - gutter * 2)}px`,
      });
    };

    const maximize = (): void => {
      if (!maximizable || isMaximized) return;
      restoreState = { ...getRect(), isMaximized: false };
      isMaximized = true;
      $window.addClass('is-maximized');
      applyMaximizedSize();
      setMaximizeIcon(true);
      saveWindowState();
    };

    const restore = (): void => {
      if (!isMaximized) return;
      const bounds = this.getSizeBounds(minWidth, minHeight);
      const nextWidth = clamp(restoreState.width, bounds.minWidth, bounds.maxWidth);
      const nextHeight = clamp(restoreState.height, bounds.minHeight, bounds.maxHeight);

      isMaximized = false;
      $window.removeClass('is-maximized');
      $window.css({
        width: `${nextWidth}px`,
        height: `${nextHeight}px`,
        left: `${clamp(restoreState.left, 0, Math.max(0, this.topWindow.innerWidth - nextWidth))}px`,
        top: `${clamp(restoreState.top, 0, Math.max(0, this.topWindow.innerHeight - nextHeight))}px`,
      });
      setMaximizeIcon(false);
      saveWindowState();
    };

    const closeWindow = (): void => {
      saveWindowState();
      this.jq(this.targetDoc).off(ns);
      this.jq(this.topWindow).off(ns);
      $overlay.off(ns);
      $window.off(ns);

      const record = this.windows.get(options.id);
      if (record) {
        record.app.unmount();
        record.destroyTeleportedStyle?.();
      }

      this.jq(this.targetDoc.body).removeClass('tti-floating-window--busy');
      $overlay.remove();
      $window.remove();
      this.windows.delete(options.id);
      options.onClose?.();
    };

    $overlay.on(`mousedown${ns}`, () => this.bringToFront(options.id));
    $window.on(`mousedown${ns}`, () => this.bringToFront(options.id));

    const $header = $window.find('.tti-floating-window__header');
    const $resizeHandles = $window.find('.tti-floating-window__resize-handle');
    const $maxButton = $window.find('.tti-floating-window__btn-max');
    const $closeButton = $window.find('.tti-floating-window__btn-close');

    $header.on(`mousedown${ns}`, event => {
      const $target = this.jq(event.target as Element);
      if ($target.closest('.tti-floating-window__controls').length > 0) return;
      if (isMaximized) return;

      isDragging = true;
      dragStartX = safeNumber(event.clientX, 0);
      dragStartY = safeNumber(event.clientY, 0);
      dragWindowStartLeft = safeNumber($window.css('left').replace('px', ''), 0);
      dragWindowStartTop = safeNumber($window.css('top').replace('px', ''), 0);

      this.jq(this.targetDoc.body).addClass('tti-floating-window--busy');
      this.bringToFront(options.id);
      event.preventDefault();
    });

    this.jq(this.targetDoc).on(`mousemove${ns}`, event => {
      if (isDragging) {
        const dx = safeNumber(event.clientX, dragStartX) - dragStartX;
        const dy = safeNumber(event.clientY, dragStartY) - dragStartY;
        const rect = getRect();

        $window.css({
          left: `${clamp(dragWindowStartLeft + dx, 0, Math.max(0, this.topWindow.innerWidth - rect.width))}px`,
          top: `${clamp(dragWindowStartTop + dy, 0, Math.max(0, this.topWindow.innerHeight - rect.height))}px`,
        });
      }

      if (activeResizeMode !== null) {
        const dx = safeNumber(event.clientX, resizeStartX) - resizeStartX;
        const dy = safeNumber(event.clientY, resizeStartY) - resizeStartY;
        const bounds = this.getSizeBounds(minWidth, minHeight);

        let nextWidth = resizeStartWidth;
        let nextHeight = resizeStartHeight;

        if (activeResizeMode === 'e' || activeResizeMode === 'se') {
          nextWidth = clamp(resizeStartWidth + dx, bounds.minWidth, this.topWindow.innerWidth - resizeStartLeft);
        }

        if (activeResizeMode === 's' || activeResizeMode === 'se') {
          nextHeight = clamp(
            resizeStartHeight + dy,
            bounds.minHeight,
            this.topWindow.innerHeight - resizeStartTop,
          );
        }

        $window.css({
          width: `${nextWidth}px`,
          height: `${nextHeight}px`,
        });
      }
    });

    this.jq(this.targetDoc).on(`mouseup${ns}`, () => {
      if (!isDragging && activeResizeMode === null) return;
      isDragging = false;
      activeResizeMode = null;
      this.jq(this.targetDoc.body).removeClass('tti-floating-window--busy');
      saveWindowState();
    });

    if (resizable) {
      $resizeHandles.on(`mousedown${ns}`, event => {
        if (isMaximized) return;

        activeResizeMode = this.jq(event.currentTarget).data('mode') as ResizeMode;
        resizeStartX = safeNumber(event.clientX, 0);
        resizeStartY = safeNumber(event.clientY, 0);
        resizeStartWidth = safeNumber($window.outerWidth(), initialWidth);
        resizeStartHeight = safeNumber($window.outerHeight(), initialHeight);
        resizeStartLeft = safeNumber($window.css('left').replace('px', ''), initialLeft);
        resizeStartTop = safeNumber($window.css('top').replace('px', ''), initialTop);

        this.jq(this.targetDoc.body).addClass('tti-floating-window--busy');
        this.bringToFront(options.id);
        event.preventDefault();
        event.stopPropagation();
      });
    } else {
      $resizeHandles.remove();
    }

    if (maximizable) {
      $maxButton.on(`click${ns}`, () => {
        if (isMaximized) {
          restore();
        } else {
          maximize();
        }
      });
    } else {
      $maxButton.remove();
    }

    $closeButton.on(`click${ns}`, closeWindow);

    this.jq(this.topWindow).on(`resize${ns}`, () => {
      if (isMaximized) {
        applyMaximizedSize();
        return;
      }

      const bounds = this.getSizeBounds(minWidth, minHeight);
      const rect = getRect();
      const nextWidth = clamp(rect.width, bounds.minWidth, bounds.maxWidth);
      const nextHeight = clamp(rect.height, bounds.minHeight, bounds.maxHeight);

      $window.css({
        width: `${nextWidth}px`,
        height: `${nextHeight}px`,
        left: `${clamp(rect.left, 0, Math.max(0, this.topWindow.innerWidth - nextWidth))}px`,
        top: `${clamp(rect.top, 0, Math.max(0, this.topWindow.innerHeight - nextHeight))}px`,
      });
      saveWindowState();
    });

    this.jq(this.targetDoc.body).append($overlay, $window);
    const teleported = teleportStyle(this.jq(this.targetDoc.head));
    const record = this.windows.get(options.id);
    if (record) {
      record.destroyTeleportedStyle = teleported.destroy;
    }

    app.mount($mountHost[0]);
    this.bringToFront(options.id);

    if (savedState?.isMaximized || options.startMaximized) {
      maximize();
    }

    return app;
  }

  public bringToFront(id: string): void {
    const record = this.windows.get(id);
    if (!record) return;

    const overlayZIndex = this.zIndex++;
    const windowZIndex = this.zIndex++;
    record.$overlay.css('z-index', overlayZIndex);
    record.$window.css('z-index', windowZIndex);
  }

  public closeWindow(id: string): void {
    this.windows.get(id)?.$window.find('.tti-floating-window__btn-close').trigger('click');
  }

  public destroyAll(): void {
    [...this.windows.keys()].forEach(id => this.closeWindow(id));
  }

  private getSizeBounds(minWidth: number, minHeight: number): {
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
  } {
    const maxWidth = Math.max(320, this.topWindow.innerWidth - 20);
    const maxHeight = Math.max(240, this.topWindow.innerHeight - 20);

    return {
      minWidth: Math.min(minWidth, maxWidth),
      maxWidth,
      minHeight: Math.min(minHeight, maxHeight),
      maxHeight,
    };
  }

  private getMaximizedGutter(): number {
    if (this.topWindow.innerWidth <= 768) return 0;
    if (this.topWindow.innerWidth <= 1100) return 5;
    return 10;
  }

  private getWindowState(windowId: string): WindowState | null {
    try {
      const raw = this.topWindow.localStorage.getItem(WINDOW_STATE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw) as Record<string, WindowState>;
      const state = parsed[windowId];
      if (!state) return null;

      return {
        left: safeNumber(state.left, 80),
        top: safeNumber(state.top, 80),
        width: safeNumber(state.width, 1220),
        height: safeNumber(state.height, 860),
        isMaximized: Boolean(state.isMaximized),
      };
    } catch {
      return null;
    }
  }

  private setWindowState(windowId: string, state: WindowState): void {
    try {
      const raw = this.topWindow.localStorage.getItem(WINDOW_STATE_KEY);
      const parsed = raw ? (JSON.parse(raw) as Record<string, WindowState>) : {};
      parsed[windowId] = state;
      this.topWindow.localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(parsed));
    } catch {
      // Ignore storage errors.
    }
  }

  private injectStyles(): void {
    if (this.stylesInjected) return;

    if (this.jq(`#${WINDOW_STYLE_ID}`, this.targetDoc).length > 0) {
      this.stylesInjected = true;
      return;
    }

    const css = `
      .tti-floating-window-overlay {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        backdrop-filter: blur(4px);
        -webkit-backdrop-filter: blur(4px);
        animation: ttiFloatingOverlayFadeIn 0.22s ease-out;
      }

      @keyframes ttiFloatingOverlayFadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
      }

      .tti-floating-window {
        position: fixed;
        display: flex;
        flex-direction: column;
        min-width: 400px;
        min-height: 320px;
        overflow: hidden;
        border-radius: 16px;
        border: 1px solid rgba(255, 255, 255, 0.15);
        background:
          radial-gradient(1200px 600px at 10% -10%, rgba(123, 183, 255, 0.12), transparent 60%),
          radial-gradient(900px 500px at 100% 0%, rgba(155, 123, 255, 0.1), transparent 55%),
          linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent 22%),
          #0b0f15;
        box-shadow: 0 25px 80px rgba(0, 0, 0, 0.65), 0 0 1px rgba(255, 255, 255, 0.1);
        color: rgba(255, 255, 255, 0.94);
        animation: ttiFloatingWindowSlideIn 0.25s ease-out;
        color-scheme: dark;
        font-family:
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "HarmonyOS Sans SC",
          "MiSans",
          Roboto,
          Helvetica,
          Arial,
          sans-serif;
      }

      @keyframes ttiFloatingWindowSlideIn {
        from {
          opacity: 0;
          transform: scale(0.965) translateY(-18px);
        }
        to {
          opacity: 1;
          transform: scale(1) translateY(0);
        }
      }

      .tti-floating-window.is-maximized {
        border-radius: 12px;
      }

      .tti-floating-window__header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: rgba(255, 255, 255, 0.04);
        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        cursor: move;
        user-select: none;
        flex-shrink: 0;
      }

      .tti-floating-window__title {
        display: flex;
        align-items: center;
        gap: 10px;
        flex: 1;
        min-width: 0;
        overflow: hidden;
        font-size: 14px;
        font-weight: 700;
        color: rgba(255, 255, 255, 0.96);
      }

      .tti-floating-window__title i {
        color: rgba(123, 183, 255, 0.88);
        flex-shrink: 0;
      }

      .tti-floating-window__title span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .tti-floating-window__controls {
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .tti-floating-window__btn {
        width: 34px;
        height: 34px;
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.05);
        color: rgba(255, 255, 255, 0.88);
        cursor: pointer;
        transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
      }

      .tti-floating-window__btn:hover {
        transform: translateY(-1px);
        border-color: rgba(123, 183, 255, 0.42);
        background: rgba(123, 183, 255, 0.12);
      }

      .tti-floating-window__btn-close:hover {
        border-color: rgba(255, 110, 110, 0.48);
        background: rgba(255, 110, 110, 0.14);
      }

      .tti-floating-window__content {
        position: relative;
        flex: 1 1 auto;
        min-height: 0;
        background: rgba(7, 10, 15, 0.55);
        overflow: hidden;
      }

      .tti-floating-window__mount-host {
        width: 100%;
        height: 100%;
      }

      .tti-floating-window__resize-handle {
        position: absolute;
        z-index: 2;
      }

      .tti-floating-window__resize-handle.e {
        top: 0;
        right: 0;
        width: 10px;
        height: 100%;
        cursor: ew-resize;
      }

      .tti-floating-window__resize-handle.s {
        bottom: 0;
        left: 0;
        width: 100%;
        height: 10px;
        cursor: ns-resize;
      }

      .tti-floating-window__resize-handle.se {
        right: 0;
        bottom: 0;
        width: 18px;
        height: 18px;
        cursor: nwse-resize;
      }

      .tti-floating-window--busy,
      .tti-floating-window--busy * {
        cursor: grabbing !important;
        user-select: none !important;
      }

      @media screen and (max-width: 1100px) {
        .tti-floating-window {
          min-width: 320px;
        }

        .tti-floating-window.is-maximized {
          border-radius: 8px;
        }

        .tti-floating-window__header {
          padding: 10px 12px;
        }

        .tti-floating-window__controls {
          gap: 6px;
          margin-right: 0;
        }

        .tti-floating-window__btn {
          width: 32px;
          height: 32px;
        }
      }

      @media screen and (max-width: 768px) {
        .tti-floating-window {
          min-width: 100vw !important;
          min-height: 100vh !important;
          min-height: 100dvh !important;
          border-radius: 0;
          border: none;
        }

        .tti-floating-window__header {
          padding: 8px 10px;
          min-height: 44px;
        }

        .tti-floating-window__title {
          font-size: 13px;
        }

        .tti-floating-window__btn {
          width: 36px;
          height: 36px;
          font-size: 16px;
        }
      }
    `;

    this.jq(`<style id="${WINDOW_STYLE_ID}"></style>`).text(css).appendTo(this.targetDoc.head);
    this.stylesInjected = true;
  }
}

