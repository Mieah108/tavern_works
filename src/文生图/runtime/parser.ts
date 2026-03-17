import type { ParsedImagePromptMessage, ImagePromptSlot } from './types';
import { buildLegacySlotId, buildStableSlotKey, normalizePromptText, summarizePromptText } from './slot-id';

const IMAGE_PROMPT_REGEX = /image###([\s\S]+?)###/g;
const REASONING_PATHS = [
  ['extra', 'reasoning'],
  ['extra', 'displayed_reasoning'],
  ['extra', 'reasoning_content'],
  ['extra', 'reasoningText'],
  ['extra', 'thoughts'],
  ['extra', 'cot'],
  ['data', 'reasoning'],
  ['data', 'thoughts'],
] as const;

function readNestedString(source: unknown, path: readonly string[]): string {
  let current: unknown = source;
  for (const segment of path) {
    if (!current || typeof current !== 'object') {
      return '';
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return typeof current === 'string' ? current : '';
}

function buildPlaceholderToken(messageId: number, index: number): string {
  return `TTIIMAGEWORKBENCHSLOT${messageId}X${index}TOKEN`;
}

function extractReasoningText(message: ChatMessage, fallback: string): string {
  for (const path of REASONING_PATHS) {
    const value = readNestedString(message, path);
    if (value.trim()) {
      return value;
    }
  }
  return fallback;
}

export function parseImagePromptMessage(message: ChatMessage, reasoningFallback = ''): ParsedImagePromptMessage {
  const bodySlots: ImagePromptSlot[] = [];
  let bodyTemplate = message.message;
  let bodyMatchIndex = 0;
  const bodyPromptCounts = new Map<string, number>();

  bodyTemplate = bodyTemplate.replace(IMAGE_PROMPT_REGEX, (_full, rawPrompt: string) => {
    const prompt = normalizePromptText(rawPrompt);
    if (!prompt) {
      return '';
    }

    const nextOccurrence = (bodyPromptCounts.get(prompt) ?? 0) + 1;
    bodyPromptCounts.set(prompt, nextOccurrence);
    const slotKey = buildStableSlotKey('body', prompt, nextOccurrence);
    const legacySlotId = buildLegacySlotId(message.message_id, 'body', bodyMatchIndex);
    const placeholderToken = buildPlaceholderToken(message.message_id, bodyMatchIndex);
    bodySlots.push({
      slotId: slotKey,
      slotKey,
      legacySlotId,
      source: 'body',
      index: bodyMatchIndex,
      prompt,
      summary: summarizePromptText(prompt),
      rawMatch: `image###${rawPrompt}###`,
      placeholderToken,
    });
    bodyMatchIndex += 1;
    return placeholderToken;
  });

  const reasoningText = extractReasoningText(message, reasoningFallback);
  const reasoningMatches = Array.from(reasoningText.matchAll(IMAGE_PROMPT_REGEX));
  const bodyPromptSet = new Set(bodySlots.map(slot => slot.prompt));
  const reasoningOnlySlots: ImagePromptSlot[] = [];
  const reasoningPromptCounts = new Map<string, number>();

  reasoningMatches.forEach((match, index) => {
    const prompt = normalizePromptText(match[1] ?? '');
    if (!prompt || bodyPromptSet.has(prompt)) {
      return;
    }

    const nextOccurrence = (reasoningPromptCounts.get(prompt) ?? 0) + 1;
    reasoningPromptCounts.set(prompt, nextOccurrence);
    const slotKey = buildStableSlotKey('reasoning-only', prompt, nextOccurrence);
    reasoningOnlySlots.push({
      slotId: slotKey,
      slotKey,
      legacySlotId: buildLegacySlotId(message.message_id, 'reasoning-only', index),
      source: 'reasoning-only',
      index,
      prompt,
      summary: summarizePromptText(prompt),
      rawMatch: match[0] ?? undefined,
    });
  });

  const allSlots = [...bodySlots, ...reasoningOnlySlots];
  return {
    bodyTemplate,
    bodySlots,
    reasoningOnlySlots,
    persistedOnlySlots: [],
    allSlots,
    slotById: new Map(allSlots.map(slot => [slot.slotId, slot])),
  };
}
