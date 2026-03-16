import { loadImageWorkbenchConfig } from '../config';
import { clearMessageSlotState, getMessageSlotState, getMessageImageStore, saveMessageSlotState } from './message-state';
import { parseImagePromptMessage } from './parser';
import { renderImageSlotsIntoMessage, restoreOriginalMessageHtml, defaultSlotState } from './renderer';
import { injectImageWorkbenchRuntimeStyles } from './styles';
import { generateImageForSlot } from './generator';
import type { ImageSlotRenderState, ParsedImagePromptMessage } from './types';

const RUNTIME_GUARD_KEY = '__tti_image_workbench_runtime__';

function getTopWindow(): Window & { [RUNTIME_GUARD_KEY]?: ImageWorkbenchRuntime } {
  return (window.parent && window.parent !== window ? window.parent : window) as Window & {
    [RUNTIME_GUARD_KEY]?: ImageWorkbenchRuntime;
  };
}

function getTopDocument(): Document {
  return getTopWindow().document;
}

function getJQueryRef(): JQueryStatic {
  const topWindow = getTopWindow() as Window & { jQuery?: JQueryStatic };
  const localWindow = window as Window & { jQuery?: JQueryStatic };
  return (topWindow.jQuery ?? localWindow.jQuery ?? $) as JQueryStatic;
}

function isAssistantMessage(message: ChatMessage | null): boolean {
  return Boolean(message && message.role === 'assistant' && !message.is_hidden);
}

class ImageWorkbenchRuntime {
  private readonly reasoningCache = new Map<number, string>();
  private readonly parsedCache = new Map<number, ParsedImagePromptMessage>();
  private readonly slotStates = new Map<number, Map<string, ImageSlotRenderState>>();
  private readonly renderTimers = new Map<number, number>();
  private readonly stopHandlers: Array<() => void> = [];
  private started = false;

  public init(): void {
    if (this.started) {
      return;
    }

    this.started = true;
    injectImageWorkbenchRuntimeStyles();
    this.stopHandlers.push(eventOn(tavern_events.GENERATION_ENDED, messageId => this.scheduleRender(messageId)).stop);
    this.stopHandlers.push(
      eventOn(tavern_events.CHARACTER_MESSAGE_RENDERED, messageId => this.scheduleRender(messageId)).stop,
    );
    this.stopHandlers.push(eventOn(tavern_events.MESSAGE_UPDATED, messageId => this.scheduleRender(messageId)).stop);
    this.stopHandlers.push(
      eventOn(tavern_events.MESSAGE_REASONING_EDITED, messageId => this.scheduleRender(messageId)).stop,
    );
    this.stopHandlers.push(
      eventOn(tavern_events.MESSAGE_REASONING_DELETED, messageId => this.scheduleRender(messageId)).stop,
    );
    this.stopHandlers.push(
      eventOn(tavern_events.STREAM_REASONING_DONE, (reasoning, _duration, messageId) => {
        if (reasoning.trim()) {
          this.reasoningCache.set(messageId, reasoning);
        }
        this.scheduleRender(messageId);
      }).stop,
    );
    this.stopHandlers.push(
      eventOn(tavern_events.MORE_MESSAGES_LOADED, () => {
        window.setTimeout(() => this.renderVisibleAssistantMessages(), 120);
      }).stop,
    );
    this.stopHandlers.push(
      eventOn(tavern_events.CHAT_CHANGED, () => {
        this.reasoningCache.clear();
        this.parsedCache.clear();
        this.slotStates.clear();
        window.setTimeout(() => this.renderVisibleAssistantMessages(), 120);
      }).stop,
    );

    this.renderVisibleAssistantMessages();
  }

  public destroy(): void {
    this.stopHandlers.splice(0).forEach(stop => stop());
    this.renderTimers.forEach(timer => window.clearTimeout(timer));
    this.renderTimers.clear();
    this.started = false;
  }

  private ensureSlotStateMap(messageId: number): Map<string, ImageSlotRenderState> {
    const existing = this.slotStates.get(messageId);
    if (existing) {
      return existing;
    }
    const created = new Map<string, ImageSlotRenderState>();
    this.slotStates.set(messageId, created);
    return created;
  }

  private syncStatesFromMessage(message: ChatMessage, parsed: ParsedImagePromptMessage): Map<string, ImageSlotRenderState> {
    const states = this.ensureSlotStateMap(message.message_id);
    const existingStore = getMessageImageStore(message);
    const validSlotIds = new Set(parsed.allSlots.map(slot => slot.slotId));

    Array.from(states.keys()).forEach(slotId => {
      if (!validSlotIds.has(slotId)) {
        states.delete(slotId);
      }
    });

    parsed.allSlots.forEach(slot => {
      const current = states.get(slot.slotId) ?? defaultSlotState();
      const persisted = existingStore.slots[slot.slotId];

      if (current.status !== 'generating') {
        if (persisted?.imageUrl) {
          current.status = 'success';
          current.imageUrl = persisted.imageUrl;
          current.updatedAt = persisted.updatedAt;
          current.error = '';
        } else if (current.status === 'success' && !current.imageUrl) {
          current.status = 'idle';
        }
      }

      states.set(slot.slotId, current);
    });

    return states;
  }

  private getAssistantMessage(messageId: number): ChatMessage | null {
    const message = getChatMessages(messageId)[0] ?? null;
    return isAssistantMessage(message) ? message : null;
  }

  private scheduleRender(messageId: number): void {
    if (!Number.isFinite(messageId) || messageId < 0) {
      return;
    }

    const timer = this.renderTimers.get(messageId);
    if (timer) {
      window.clearTimeout(timer);
    }

    const nextTimer = window.setTimeout(() => {
      this.renderTimers.delete(messageId);
      void this.renderMessage(messageId);
    }, 60);

    this.renderTimers.set(messageId, nextTimer);
  }

  private async handleGenerate(messageId: number, slotId: string): Promise<void> {
    const message = this.getAssistantMessage(messageId);
    if (!message) {
      return;
    }

    const parsed = this.parsedCache.get(messageId) ?? parseImagePromptMessage(message, this.reasoningCache.get(messageId) ?? '');
    this.parsedCache.set(messageId, parsed);

    const slot = parsed.slotById.get(slotId);
    if (!slot) {
      return;
    }

    const stateMap = this.ensureSlotStateMap(messageId);
    const state = stateMap.get(slotId) ?? defaultSlotState();
    const previousBinding = getMessageSlotState(message, slotId);

    state.status = 'generating';
    state.expanded = true;
    state.error = '';
    stateMap.set(slotId, state);
    await this.renderMessage(messageId);

    try {
      const result = await generateImageForSlot(messageId, slot, Boolean(previousBinding?.imageUrl));
      await saveMessageSlotState(messageId, slotId, {
        imageUrl: result.imageUrl,
        prompt: result.finalPrompt,
        updatedAt: Date.now(),
        mimeType: result.mimeType,
        byteLength: result.byteLength,
        storage: 'embedded',
      });

      state.status = 'success';
      state.imageUrl = result.imageUrl;
      state.cacheHit = result.cacheHit;
      state.updatedAt = Date.now();
      state.error = '';
    } catch (error) {
      state.status = 'error';
      state.error = error instanceof Error ? error.message : '生成失败。';
      state.imageUrl = '';
    }

    stateMap.set(slotId, state);
    await this.renderMessage(messageId);
  }

  private async handleImageMissing(messageId: number, slotId: string): Promise<void> {
    await clearMessageSlotState(messageId, slotId);
    const state = this.ensureSlotStateMap(messageId).get(slotId) ?? defaultSlotState();
    state.status = 'error';
    state.error = '缓存图片已失效，请重新生成。';
    state.imageUrl = '';
    state.expanded = true;
    this.ensureSlotStateMap(messageId).set(slotId, state);
    await this.renderMessage(messageId);
  }

  private toggleSlot(messageId: number, slotId: string): void {
    const stateMap = this.ensureSlotStateMap(messageId);
    const state = stateMap.get(slotId) ?? defaultSlotState();
    state.expanded = !state.expanded;
    stateMap.set(slotId, state);
    void this.renderMessage(messageId);
  }

  private renderVisibleAssistantMessages(): void {
    const jq = getJQueryRef();
    jq('#chat', getTopDocument())
      .children(".mes[is_user='false'][is_system='false']")
      .each((_index, element) => {
        const messageId = Number(jq(element).attr('mesid'));
        if (Number.isFinite(messageId)) {
          this.scheduleRender(messageId);
        }
      });
  }

  private async renderMessage(messageId: number): Promise<void> {
    const { config } = loadImageWorkbenchConfig();
    const message = this.getAssistantMessage(messageId);
    const $display = retrieveDisplayedMessage(messageId);

    if (!message || !$display.length) {
      return;
    }

    if (!config.runtimeEnabled) {
      restoreOriginalMessageHtml(messageId, $display, message.message);
      return;
    }

    const parsed = parseImagePromptMessage(message, this.reasoningCache.get(messageId) ?? '');
    this.parsedCache.set(messageId, parsed);

    if (parsed.allSlots.length === 0) {
      restoreOriginalMessageHtml(messageId, $display, message.message);
      return;
    }

    const states = this.syncStatesFromMessage(message, parsed);
    renderImageSlotsIntoMessage(messageId, $display, parsed, states, {
      onToggle: slotId => this.toggleSlot(messageId, slotId),
      onGenerate: slotId => this.handleGenerate(messageId, slotId),
      onImageError: slotId => {
        void this.handleImageMissing(messageId, slotId);
      },
    });
  }
}

export function initImageWorkbenchRuntime(): void {
  const topWindow = getTopWindow();
  if (!topWindow[RUNTIME_GUARD_KEY]) {
    topWindow[RUNTIME_GUARD_KEY] = new ImageWorkbenchRuntime();
  }
  topWindow[RUNTIME_GUARD_KEY]?.init();
}

export function destroyImageWorkbenchRuntime(): void {
  const topWindow = getTopWindow();
  topWindow[RUNTIME_GUARD_KEY]?.destroy();
}
