import type { ImagePromptSlotSource, MessageImageRecoverySlotSource } from './types';

const SLOT_KEY_PREFIX = 'tti-key';
const LEGACY_SLOT_ID_REGEX = /^tti:(\d+):(body|reasoning-only):(\d+)$/;
const SLOT_KEY_REGEX = /^tti-key:(body|reasoning-only):([0-9]+):([a-z0-9]+)$/;

function toLiveSource(source: ImagePromptSlotSource | MessageImageRecoverySlotSource): MessageImageRecoverySlotSource {
  return source === 'reasoning-only' ? 'reasoning-only' : 'body';
}

function hashPrompt(input: string): string {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function normalizePromptText(input: string): string {
  return input.replace(/\r\n/g, '\n').trim();
}

export function summarizePromptText(input: string): string {
  const compact = input.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }
  return `${compact.slice(0, 56)}...`;
}

export function buildLegacySlotId(messageId: number, source: MessageImageRecoverySlotSource, index: number): string {
  return `tti:${messageId}:${source}:${index}`;
}

export function buildStableSlotKey(
  source: ImagePromptSlotSource | MessageImageRecoverySlotSource,
  prompt: string,
  occurrence: number,
): string {
  const normalizedPrompt = normalizePromptText(prompt);
  return `${SLOT_KEY_PREFIX}:${toLiveSource(source)}:${occurrence}:${hashPrompt(normalizedPrompt)}`;
}

export function parseLegacySlotId(slotId: string): { messageId: number; source: MessageImageRecoverySlotSource; index: number } | null {
  const match = slotId.match(LEGACY_SLOT_ID_REGEX);
  if (!match) {
    return null;
  }

  return {
    messageId: Number(match[1]),
    source: match[2] === 'reasoning-only' ? 'reasoning-only' : 'body',
    index: Number(match[3]),
  };
}

export function parseStableSlotKey(slotKey: string): { source: MessageImageRecoverySlotSource; occurrence: number } | null {
  const match = slotKey.match(SLOT_KEY_REGEX);
  if (!match) {
    return null;
  }

  return {
    source: match[1] === 'reasoning-only' ? 'reasoning-only' : 'body',
    occurrence: Number(match[2]),
  };
}
