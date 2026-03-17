import type { ParsedImagePromptMessage, ImagePromptSlot } from './types';

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

function normalizePrompt(input: string): string {
  return input.replace(/\r\n/g, '\n').trim();
}

function buildPlaceholderToken(messageId: number, index: number): string {
  return `TTIIMAGEWORKBENCHSLOT${messageId}X${index}TOKEN`;
}

function summarizePrompt(input: string): string {
  const compact = input.replace(/\s+/g, ' ').trim();
  if (compact.length <= 56) {
    return compact;
  }
  return `${compact.slice(0, 56)}…`;
}

function buildSlotId(messageId: number, source: 'body' | 'reasoning-only', index: number): string {
  return `tti:${messageId}:${source}:${index}`;
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

  bodyTemplate = bodyTemplate.replace(IMAGE_PROMPT_REGEX, (_full, rawPrompt: string) => {
    const prompt = normalizePrompt(rawPrompt);
    if (!prompt) {
      return '';
    }

    const slotId = buildSlotId(message.message_id, 'body', bodyMatchIndex);
    const placeholderToken = buildPlaceholderToken(message.message_id, bodyMatchIndex);
    bodySlots.push({
      slotId,
      source: 'body',
      index: bodyMatchIndex,
      prompt,
      summary: summarizePrompt(prompt),
      placeholderToken,
    });
    bodyMatchIndex += 1;
    return placeholderToken;
  });

  const reasoningText = extractReasoningText(message, reasoningFallback);
  const reasoningMatches = Array.from(reasoningText.matchAll(IMAGE_PROMPT_REGEX));
  const bodyPromptSet = new Set(bodySlots.map(slot => slot.prompt));
  const reasoningOnlySlots: ImagePromptSlot[] = [];

  reasoningMatches.forEach((match, index) => {
    const prompt = normalizePrompt(match[1] ?? '');
    if (!prompt || bodyPromptSet.has(prompt)) {
      return;
    }

    reasoningOnlySlots.push({
      slotId: buildSlotId(message.message_id, 'reasoning-only', index),
      source: 'reasoning-only',
      index,
      prompt,
      summary: summarizePrompt(prompt),
    });
  });

  const allSlots = [...bodySlots, ...reasoningOnlySlots];
  return {
    bodyTemplate,
    bodySlots,
    reasoningOnlySlots,
    allSlots,
    slotById: new Map(allSlots.map(slot => [slot.slotId, slot])),
  };
}
