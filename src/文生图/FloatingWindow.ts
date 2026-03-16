import { createApp, type App } from 'vue';

export interface FloatingWindowOptions {
  id: string;
  title: string;
  width?: number;
  height?: number;
  onClose?: () => void;
}

export class FloatingWindowManager {
  private static instance: FloatingWindowManager;
  private windows: Map<string, JQuery<HTMLElement>> = new Map();
  private baseZIndex: number = 10000;
  private stylesInjected: boolean = false;

  private constructor() {}

  public static getInstance(): FloatingWindowManager {
    if (!FloatingWindowManager.instance) {
      FloatingWindowManager.instance = new FloatingWindowManager();
    }
    return FloatingWindowManager.instance;
  }

  private injectStyles() {
    if (this.stylesInjected) return;
    const styleId = 'floating-window-styles';
    if ($(`#${styleId}`).length === 0) {
      $('<style>').attr('id', styleId).text(`
        .fw-window {
          position: fixed;
          background: var(--SmartThemeBodyColor, #1a1a2e);
          border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
          border-radius: 8px;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: inherit;
          color: var(--SmartThemeTextColor, #e0e0e0);
          z-index: 10000;
          min-width: 300px;
          min-height: 200px;
        }
        .fw-header {
          background: var(--SmartThemeBlurTintColor, #2a2a40);
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
          user-select: none;
          border-bottom: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
        }
        .fw-title {
          font-weight: bold;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .fw-close-btn {
          cursor: pointer;
          color: #aaa;
          transition: color 0.2s;
        }
        .fw-close-btn:hover {
          color: #fff;
        }
        .fw-content {
          flex: 1;
          overflow: auto;
          position: relative;
        }
        .fw-resize-handle {
          position: absolute;
          right: 0;
          bottom: 0;
          width: 15px;
          height: 15px;
          cursor: se-resize;
          z-index: 10;
        }
      `).appendTo('head');
    }
    this.stylesInjected = true;
  }

  public createWindow(options: FloatingWindowOptions, mountVueComponent: any): App | null {
    this.injectStyles();
    
    if (this.windows.has(options.id)) {
      this.bringToFront(options.id);
      return null;
    }

    const width = options.width || 600;
    const height = options.height || 500;
    
    // Calculate center properly
    const winWidth = $(window).width() || 1024;
    const winHeight = $(window).height() || 768;
    const left = Math.max(0, (winWidth - width) / 2);
    const top = Math.max(0, (winHeight - height) / 2);

    const $window = $('<div>').addClass('fw-window').attr('id', options.id).css({
      width: width + 'px',
      height: height + 'px',
      left: left + 'px',
      top: top + 'px',
      zIndex: this.baseZIndex++
    });

    const $header = $('<div>').addClass('fw-header');
    const $title = $('<div>').addClass('fw-title').html(`<i class="fa-solid fa-image"></i> ${options.title}`);
    const $closeBtn = $('<div>').addClass('fw-close-btn').html('<i class="fa-solid fa-times"></i>');
    
    $header.append($title, $closeBtn);
    
    const $content = $('<div>').addClass('fw-content').attr('id', `${options.id}-content`);
    const $resizeHandle = $('<div>').addClass('fw-resize-handle');

    $window.append($header, $content, $resizeHandle);
    $('body').append($window);

    // Save instance
    this.windows.set(options.id, $window);

    // Make Draggable
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let initialLeft = 0, initialTop = 0;

    $header.on('mousedown', (e) => {
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = parseFloat($window.css('left')) || 0;
      initialTop = parseFloat($window.css('top')) || 0;
      this.bringToFront(options.id);
      e.preventDefault();
    });

    $(document).on('mousemove.fw-drag-' + options.id, (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      $window.css({ left: initialLeft + dx, top: initialTop + dy });
    });

    $(document).on('mouseup.fw-drag-' + options.id, () => {
      isDragging = false;
    });

    // Make Resizable
    let isResizing = false;
    let resizeStartX = 0, resizeStartY = 0;
    let initialWidth = 0, initialHeight = 0;

    $resizeHandle.on('mousedown', (e) => {
      isResizing = true;
      resizeStartX = e.clientX;
      resizeStartY = e.clientY;
      initialWidth = $window.width() || width;
      initialHeight = $window.height() || height;
      this.bringToFront(options.id);
      e.stopPropagation();
      e.preventDefault(); // prevent text selection
    });

    $(document).on('mousemove.fw-resize-' + options.id, (e) => {
      if (!isResizing) return;
      const dx = e.clientX - resizeStartX;
      const dy = e.clientY - resizeStartY;
      const newWidth = Math.max(300, initialWidth + dx);
      const newHeight = Math.max(200, initialHeight + dy);
      $window.css({ width: newWidth, height: newHeight });
    });

    $(document).on('mouseup.fw-resize-' + options.id, () => {
      isResizing = false;
    });

    // Focus on click
    $window.on('mousedown', () => {
      this.bringToFront(options.id);
    });

    // Close Handler
    const closeWindow = () => {
      vueApp.unmount();
      $window.remove();
      this.windows.delete(options.id);
      $(document).off('.fw-drag-' + options.id);
      $(document).off('.fw-resize-' + options.id);
      if (options.onClose) options.onClose();
    };

    $closeBtn.on('click', closeWindow);

    // Mount Vue
    const vueApp = createApp(mountVueComponent);
    vueApp.mount($content[0]);

    return vueApp;
  }

  public bringToFront(id: string) {
    const $window = this.windows.get(id);
    if ($window) {
      $window.css('z-index', this.baseZIndex++);
    }
  }

  public closeWindow(id: string) {
    const $window = this.windows.get(id);
    if ($window) {
      $window.find('.fw-close-btn').trigger('click');
    }
  }
}
