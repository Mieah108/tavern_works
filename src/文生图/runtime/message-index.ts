import type { MessageImageRecoveryEntry, MessageImageRecoveryStore } from './types';
import { normalizePromptText, summarizePromptText } from './slot-id';

const VARIABLE_KEY = 'tti_image_workbench';
const STORE_VERSION = 1;

type SlotMatcher = {
  slotKey?: string;
  legacySlotId?: string;
};

function normalizeEntry(input: unknown): MessageImageRecoveryEntry | null {
  if (!input || typeof input !== 'object') {
    return null;
  }

  const raw = input as Record<string, unknown>;
  if (
    typeof raw.slotKey !== 'string' ||
    (raw.source !== 'body' && raw.source !== 'reasoning-only') ||
    typeof raw.originalPrompt !== 'string' ||
    typeof raw.finalPrompt !== 'string' ||
    typeof raw.updatedAt !== 'number'
  ) {
    return null;
  }

  const originalPrompt = normalizePromptText(raw.originalPrompt);
  const finalPrompt = normalizePromptText(raw.finalPrompt);
  return {
    slotKey: raw.slotKey,
    legacySlotId: typeof raw.legacySlotId === 'string' ? raw.legacySlotId : undefined,
    source: raw.source,
    originalPrompt,
    finalPrompt,
    summary:
      typeof raw.summary === 'string' && raw.summary.trim()
        ? raw.summary.trim()
        : summarizePromptText(originalPrompt || finalPrompt),
    updatedAt: raw.updatedAt,
    storage: raw.storage === 'embedded' ? 'embedded' : undefined,
  };
}

function normalizeStore(input: unknown): MessageImageRecoveryStore {
  const emptyStore: MessageImageRecoveryStore = {
    version: STORE_VERSION,
    slots: {},
    recentResults: [],
  };

  if (!input || typeof input !== 'object') {
    return emptyStore;
  }

  const raw = input as Record<string, unknown>;
  const normalizedSlots: Record<string, MessageImageRecoveryEntry> = {};
  if (raw.slots && typeof raw.slots === 'object') {
    Object.values(raw.slots as Record<string, unknown>).forEach(value => {
      const entry = normalizeEntry(value);
      if (!entry) {
        return;
      }
      normalizedSlots[entry.slotKey] = entry;
    });
  }

  const normalizedRecentResults = Array.isArray(raw.recentResults)
    ? raw.recentResults.map(normalizeEntry).filter((entry): entry is MessageImageRecoveryEntry => Boolean(entry))
    : [];

  return {
    version: typeof raw.version === 'number' ? raw.version : STORE_VERSION,
    slots: normalizedSlots,
    recentResults: normalizedRecentResults,
  };
}

function getMessageVariables(messageId: number): Record<string, unknown> {
  try {
    return _.cloneDeep(getVariables({ type: 'message', message_id: messageId }) ?? {});
  } catch {
    return {};
  }
}

export function getMessageImageRecoveryStore(messageId: number): MessageImageRecoveryStore {
  const variables = getMessageVariables(messageId);
  return normalizeStore(variables[VARIABLE_KEY]);
}

export function saveMessageImageRecoveryEntry(
  messageId: number,
  entry: MessageImageRecoveryEntry,
  keepLastResultCount: number,
): void {
  const variables = getMessageVariables(messageId);
  const store = normalizeStore(variables[VARIABLE_KEY]);
  store.slots[entry.slotKey] = entry;

  const nextRecentResults = [entry]
    .concat(store.recentResults.filter(item => item.slotKey !== entry.slotKey))
    .slice(0, Math.max(1, keepLastResultCount));
  store.recentResults = nextRecentResults;
  variables[VARIABLE_KEY] = store;
  replaceVariables(variables, { type: 'message', message_id: messageId });
}

export function clearMessageImageRecoveryEntry(messageId: number, matcher: SlotMatcher): void {
  const variables = getMessageVariables(messageId);
  const store = normalizeStore(variables[VARIABLE_KEY]);
  const keysToDelete = Object.entries(store.slots)
    .filter(([slotKey, entry]) => {
      if (matcher.slotKey && slotKey === matcher.slotKey) {
        return true;
      }
      if (matcher.slotKey && entry.slotKey === matcher.slotKey) {
        return true;
      }
      return Boolean(matcher.legacySlotId && entry.legacySlotId === matcher.legacySlotId);
    })
    .map(([slotKey]) => slotKey);

  if (keysToDelete.length === 0) {
    return;
  }

  keysToDelete.forEach(slotKey => {
    delete store.slots[slotKey];
  });
  store.recentResults = store.recentResults.filter(entry => !keysToDelete.includes(entry.slotKey));
  variables[VARIABLE_KEY] = store;
  replaceVariables(variables, { type: 'message', message_id: messageId });
}
