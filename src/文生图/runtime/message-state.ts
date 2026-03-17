import type { MessageImageSlotState, MessageImageStore } from './types';
import type { MessageImageRecoverySlotSource } from './types';
import { normalizePromptText, parseLegacySlotId } from './slot-id';

const EXTRA_KEY = 'tti_image_workbench';
const STORE_VERSION = 2;

type SlotMatcher = {
  slotKey?: string;
  legacySlotId?: string;
};

type PersistOption = {
  refresh?: 'none' | 'affected' | 'all';
};

type ResolvedMessageSlotState = {
  storageKey: string;
  state: MessageImageSlotState;
};

function inferSource(storageKey: string, entry: Record<string, unknown>): MessageImageRecoverySlotSource | undefined {
  if (entry.source === 'reasoning-only') {
    return 'reasoning-only';
  }
  if (entry.source === 'body') {
    return 'body';
  }

  const legacySlotId = typeof entry.legacySlotId === 'string' ? entry.legacySlotId : storageKey;
  return parseLegacySlotId(legacySlotId)?.source;
}

function normalizeStore(input: unknown): MessageImageStore {
  if (!input || typeof input !== 'object') {
    return {
      version: STORE_VERSION,
      slots: {},
    };
  }

  const raw = input as Record<string, unknown>;
  const rawSlots = raw.slots;
  const slots: Record<string, MessageImageSlotState> = {};

  if (rawSlots && typeof rawSlots === 'object') {
    for (const [slotId, value] of Object.entries(rawSlots as Record<string, unknown>)) {
      if (!value || typeof value !== 'object') {
        continue;
      }

      const entry = value as Record<string, unknown>;
      if (
        typeof entry.imageUrl !== 'string' ||
        typeof entry.prompt !== 'string' ||
        typeof entry.updatedAt !== 'number'
      ) {
        continue;
      }

      slots[slotId] = {
        imageUrl: entry.imageUrl,
        prompt: normalizePromptText(entry.prompt),
        updatedAt: entry.updatedAt,
        slotKey: typeof entry.slotKey === 'string' ? entry.slotKey : undefined,
        legacySlotId: typeof entry.legacySlotId === 'string' ? entry.legacySlotId : undefined,
        source: inferSource(slotId, entry),
        originalPrompt: typeof entry.originalPrompt === 'string' ? normalizePromptText(entry.originalPrompt) : undefined,
        mimeType: typeof entry.mimeType === 'string' ? entry.mimeType : undefined,
        byteLength: typeof entry.byteLength === 'number' ? entry.byteLength : undefined,
        storage: entry.storage === 'embedded' ? 'embedded' : undefined,
      };
    }
  }

  return {
    version: typeof raw.version === 'number' ? raw.version : STORE_VERSION,
    slots,
  };
}

function getChatMessage(messageId: number): ChatMessage | null {
  return getChatMessages(messageId)[0] ?? null;
}

function cloneExtra(message: ChatMessage): Record<string, unknown> {
  if (!message.extra || typeof message.extra !== 'object') {
    return {};
  }
  return _.cloneDeep(message.extra as Record<string, unknown>);
}

export function getMessageImageStore(message: ChatMessage | null): MessageImageStore {
  return normalizeStore(message?.extra?.[EXTRA_KEY]);
}

export function resolveMessageSlotState(store: MessageImageStore, matcher: SlotMatcher): ResolvedMessageSlotState | null {
  if (matcher.slotKey && store.slots[matcher.slotKey]) {
    return {
      storageKey: matcher.slotKey,
      state: store.slots[matcher.slotKey],
    };
  }

  const entries = Object.entries(store.slots);
  if (matcher.slotKey) {
    const slotKeyMatch = entries.find(([, state]) => state.slotKey === matcher.slotKey);
    if (slotKeyMatch) {
      return {
        storageKey: slotKeyMatch[0],
        state: slotKeyMatch[1],
      };
    }
  }

  if (matcher.legacySlotId) {
    if (store.slots[matcher.legacySlotId]) {
      return {
        storageKey: matcher.legacySlotId,
        state: store.slots[matcher.legacySlotId],
      };
    }

    const legacyMatch = entries.find(([, state]) => state.legacySlotId === matcher.legacySlotId);
    if (legacyMatch) {
      return {
        storageKey: legacyMatch[0],
        state: legacyMatch[1],
      };
    }
  }

  return null;
}

export function getMessageSlotState(message: ChatMessage | null, matcher: SlotMatcher): MessageImageSlotState | null {
  const store = getMessageImageStore(message);
  return resolveMessageSlotState(store, matcher)?.state ?? null;
}

export async function saveMessageSlotState(
  messageId: number,
  value: MessageImageSlotState,
  option: PersistOption = {},
): Promise<void> {
  const message = getChatMessage(messageId);
  if (!message) {
    throw new Error(`找不到第 ${messageId} 楼消息。`);
  }

  const extra = cloneExtra(message);
  const store = normalizeStore(extra[EXTRA_KEY]);
  const slotKey = value.slotKey;
  const storageKey = slotKey || value.legacySlotId;
  if (!storageKey) {
    throw new Error('保存插图状态时缺少槽位标识。');
  }

  const normalizedValue: MessageImageSlotState = {
    ...value,
    prompt: normalizePromptText(value.prompt),
    originalPrompt: typeof value.originalPrompt === 'string' ? normalizePromptText(value.originalPrompt) : undefined,
  };

  const existingBinding = resolveMessageSlotState(store, {
    slotKey: value.slotKey,
    legacySlotId: value.legacySlotId,
  });
  if (existingBinding && existingBinding.storageKey !== storageKey) {
    delete store.slots[existingBinding.storageKey];
  }

  if (value.legacySlotId && value.legacySlotId !== storageKey) {
    delete store.slots[value.legacySlotId];
  }

  store.slots[storageKey] = normalizedValue;
  extra[EXTRA_KEY] = store;

  await setChatMessages(
    [
      {
        message_id: messageId,
        extra,
      },
    ],
    { refresh: option.refresh ?? 'affected' },
  );
}

export async function clearMessageSlotState(
  messageId: number,
  matcher: SlotMatcher,
  option: PersistOption = {},
): Promise<void> {
  const message = getChatMessage(messageId);
  if (!message) {
    return;
  }

  const extra = cloneExtra(message);
  const store = normalizeStore(extra[EXTRA_KEY]);
  const keysToDelete = new Set<string>();
  const directMatch = resolveMessageSlotState(store, matcher);
  if (directMatch) {
    keysToDelete.add(directMatch.storageKey);
  }

  Object.entries(store.slots).forEach(([storageKey, state]) => {
    if ((matcher.slotKey && state.slotKey === matcher.slotKey) || (matcher.legacySlotId && state.legacySlotId === matcher.legacySlotId)) {
      keysToDelete.add(storageKey);
    }
  });

  if (keysToDelete.size === 0) {
    return;
  }

  keysToDelete.forEach(storageKey => {
    delete store.slots[storageKey];
  });
  extra[EXTRA_KEY] = store;

  await setChatMessages(
    [
      {
        message_id: messageId,
        extra,
      },
    ],
    { refresh: option.refresh ?? 'affected' },
  );
}
