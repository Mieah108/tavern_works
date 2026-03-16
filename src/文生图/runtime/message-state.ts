import type { MessageImageSlotState, MessageImageStore } from './types';

const EXTRA_KEY = 'tti_image_workbench';
const STORE_VERSION = 1;

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
        prompt: entry.prompt,
        updatedAt: entry.updatedAt,
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

export function getMessageSlotState(message: ChatMessage | null, slotId: string): MessageImageSlotState | null {
  const store = getMessageImageStore(message);
  return store.slots[slotId] ?? null;
}

export async function saveMessageSlotState(messageId: number, slotId: string, value: MessageImageSlotState): Promise<void> {
  const message = getChatMessage(messageId);
  if (!message) {
    throw new Error(`找不到第 ${messageId} 楼消息。`);
  }

  const extra = cloneExtra(message);
  const store = normalizeStore(extra[EXTRA_KEY]);
  store.slots[slotId] = value;
  extra[EXTRA_KEY] = store;

  await setChatMessages(
    [
      {
        message_id: messageId,
        extra,
      },
    ],
    { refresh: 'affected' },
  );
}

export async function clearMessageSlotState(messageId: number, slotId: string): Promise<void> {
  const message = getChatMessage(messageId);
  if (!message) {
    return;
  }

  const extra = cloneExtra(message);
  const store = normalizeStore(extra[EXTRA_KEY]);
  if (!store.slots[slotId]) {
    return;
  }

  delete store.slots[slotId];
  extra[EXTRA_KEY] = store;

  await setChatMessages(
    [
      {
        message_id: messageId,
        extra,
      },
    ],
    { refresh: 'affected' },
  );
}
