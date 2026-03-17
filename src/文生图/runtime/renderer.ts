import type { ImagePromptSlot, ImageSlotRenderState, ParsedImagePromptMessage } from './types';
import { normalizePromptText } from './slot-id';

type RenderHandlers = {
  onToggle: (slotId: string) => void;
  onTogglePrompt: (slotId: string) => void;
  onGenerate: (slotId: string) => void;
  onImageError: (slotId: string) => void;
};

const EVENT_NAMESPACE = '.ttiImageSlot';
const BODY_SLOT_ATTR = 'data-tti-body-slot';
const SUMMARY_HOST_ATTR = 'data-tti-summary-host';
const ORIGINAL_MATCH_ATTR = 'data-tti-original-match';
const IMAGE_PROMPT_REGEX = /image###([\s\S]+?)###/g;

function escapeHtml(input: string): string {
  return input
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function getSlotStatusTone(state: ImageSlotRenderState): 'ok' | 'warn' | 'error' {
  if (state.status === 'success') {
    return 'ok';
  }
  if (state.status === 'error') {
    return 'error';
  }
  return 'warn';
}

function getSlotStatusText(state: ImageSlotRenderState): string {
  if (state.status === 'success') {
    return state.cacheHit ? '已显示缓存插图' : '插图已生成';
  }
  if (state.status === 'generating') {
    return '正在生成插图';
  }
  if (state.status === 'error') {
    return state.error || '生成失败';
  }
  return '等待生成';
}

function getSlotLabel(slot: ImagePromptSlot): string {
  if (slot.source === 'reasoning-only') {
    return '隐藏插图提示';
  }
  if (slot.source === 'persisted-only') {
    return '已恢复插图';
  }
  return '插图入口';
}

function buildCardHtml(slot: ImagePromptSlot, state: ImageSlotRenderState, extraAttributes = ''): string {
  const actionLabel =
    state.status === 'generating' ? '生成中...' : state.imageUrl || state.status === 'success' ? '重新生成' : '生成插图';

  const metaText =
    state.status === 'success' && state.updatedAt
      ? slot.source === 'persisted-only'
        ? `已从聊天记录恢复，最近更新：${new Date(state.updatedAt).toLocaleString()}`
        : `最近更新：${new Date(state.updatedAt).toLocaleString()}`
      : slot.source === 'reasoning-only'
        ? '该提示词只出现在思维链中，已折叠汇总到正文末尾。'
        : slot.source === 'persisted-only'
          ? slot.persistedSource === 'reasoning-only'
            ? '原始提示词来自思维链，当前根据聊天文件中的已保存插图恢复显示。'
            : '原始插图入口已不可定位，当前根据聊天文件中的已保存插图恢复显示。'
        : '点击生成后会在当前位置插入插图。';

  return `
    <span class="tti-image-inline-slot ${state.status !== 'idle' ? `is-${state.status}` : ''} ${state.expanded ? 'is-expanded' : ''}" data-slot-id="${escapeHtml(slot.slotId)}" ${extraAttributes}>
      <span class="tti-image-inline-slot__header">
        <span class="tti-image-inline-slot__pill">
          <i class="fa-solid fa-image" aria-hidden="true"></i>
          <span>${getSlotLabel(slot)}</span>
        </span>
        <span class="tti-image-inline-slot__status ${getSlotStatusTone(state)}">${escapeHtml(getSlotStatusText(state))}</span>
        <button type="button" class="tti-image-inline-slot__action" data-action="generate" data-slot-id="${escapeHtml(slot.slotId)}" ${state.status === 'generating' ? 'disabled' : ''}>
          ${actionLabel}
        </button>
        <button type="button" class="tti-image-inline-slot__toggle" data-action="toggle-prompt" data-slot-id="${escapeHtml(slot.slotId)}">
          <span class="tti-image-inline-slot__toggle-label">${state.showPrompt ? '隐藏 tags' : '显示 tags'}</span>
        </button>
        <button type="button" class="tti-image-inline-slot__toggle" data-action="toggle" data-slot-id="${escapeHtml(slot.slotId)}">
          <span class="tti-image-inline-slot__toggle-label">${state.expanded ? '收起' : '展开'}</span>
          <span class="tti-image-inline-slot__toggle-caret" aria-hidden="true">${state.expanded ? '▾' : '▸'}</span>
        </button>
      </span>
      <span class="tti-image-inline-slot__body">
        ${state.showPrompt ? `<span class="tti-image-inline-slot__prompt">${escapeHtml(slot.prompt)}</span>` : ''}
        <span class="tti-image-inline-slot__meta">${escapeHtml(metaText)}</span>
        ${
          state.imageUrl
            ? `<img class="tti-image-inline-slot__image" data-slot-id="${escapeHtml(slot.slotId)}" src="${escapeHtml(state.imageUrl)}" alt="生成插图" loading="lazy" />`
            : ''
        }
      </span>
    </span>
  `;
}

function buildSummaryHtml(parsed: ParsedImagePromptMessage, states: Map<string, ImageSlotRenderState>): string {
  const summarySlots = [...parsed.reasoningOnlySlots, ...parsed.persistedOnlySlots];
  const summaryHtml = summarySlots
    .map(slot => buildCardHtml(slot, states.get(slot.slotId) ?? defaultSlotState()))
    .join('');
  const title =
    parsed.reasoningOnlySlots.length > 0 && parsed.persistedOnlySlots.length > 0
      ? '隐藏/已恢复插图'
      : parsed.persistedOnlySlots.length > 0
        ? '聊天文件中恢复的插图'
        : '隐藏插图提示';

  return `
    <div class="tti-image-inline-summary" ${SUMMARY_HOST_ATTR}="true">
      <div class="tti-image-inline-summary__title">
        <i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
        <span>${title}</span>
      </div>
      ${summaryHtml}
    </div>
  `;
}

function createElementFromHtml(documentRef: Document, html: string): HTMLElement {
  const template = documentRef.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild as HTMLElement;
}

function findSlotElements($display: JQuery<HTMLDivElement>): JQuery<HTMLElement> {
  return $display.find('.tti-image-inline-slot');
}

function findBodySlotElement($display: JQuery<HTMLDivElement>, slotId: string): JQuery<HTMLElement> {
  return findSlotElements($display).filter((_index, element) => {
    return element.getAttribute('data-slot-id') === slotId && element.getAttribute(BODY_SLOT_ATTR) === 'true';
  }) as JQuery<HTMLElement>;
}

function replaceNodeWithText(element: Element, value: string): void {
  const documentRef = element.ownerDocument;
  element.replaceWith(documentRef.createTextNode(value));
}

type TextSegment = {
  node: Text;
  start: number;
  end: number;
};

function collectEligibleTextNodes(root: HTMLElement): Text[] {
  const documentRef = root.ownerDocument;
  const walker = documentRef.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parentElement = node.parentElement;
        if (!parentElement) {
          return NodeFilter.FILTER_REJECT;
        }
        if (parentElement.closest('.tti-image-inline-slot, .tti-image-inline-summary')) {
          return NodeFilter.FILTER_REJECT;
        }
        return node.nodeValue ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      },
    },
  );

  const nodes: Text[] = [];
  let current: Node | null = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }
  return nodes;
}

function buildTextSegments(root: HTMLElement): { text: string; segments: TextSegment[] } {
  const textNodes = collectEligibleTextNodes(root);
  const segments: TextSegment[] = [];
  let cursor = 0;

  textNodes.forEach(node => {
    const value = node.nodeValue ?? '';
    segments.push({
      node,
      start: cursor,
      end: cursor + value.length,
    });
    cursor += value.length;
  });

  return {
    text: textNodes.map(node => node.nodeValue ?? '').join(''),
    segments,
  };
}

function resolveRangeStart(segments: TextSegment[], index: number): { node: Text; offset: number } | null {
  for (const segment of segments) {
    if (index >= segment.start && index < segment.end) {
      return {
        node: segment.node,
        offset: index - segment.start,
      };
    }
  }

  const last = segments[segments.length - 1];
  if (last && index === last.end) {
    return {
      node: last.node,
      offset: last.node.nodeValue?.length ?? 0,
    };
  }

  return null;
}

function resolveRangeEnd(segments: TextSegment[], index: number): { node: Text; offset: number } | null {
  for (const segment of segments) {
    if (index > segment.start && index <= segment.end) {
      return {
        node: segment.node,
        offset: index - segment.start,
      };
    }
  }

  const first = segments[0];
  if (first && index === first.start) {
    return {
      node: first.node,
      offset: 0,
    };
  }

  return null;
}

function replaceMissingBodySlots(
  $display: JQuery<HTMLDivElement>,
  missingSlots: Array<{ slot: ImagePromptSlot; state: ImageSlotRenderState }>,
): void {
  const root = $display.get(0);
  if (!root || missingSlots.length === 0) {
    return;
  }

  const { text, segments } = buildTextSegments(root);
  if (!text || segments.length === 0) {
    return;
  }

  const matches: Array<{ slot: ImagePromptSlot; state: ImageSlotRenderState; start: number; end: number; rawMatch: string }> = [];
  let slotCursor = 0;
  let regexMatch: RegExpExecArray | null;

  IMAGE_PROMPT_REGEX.lastIndex = 0;
  while ((regexMatch = IMAGE_PROMPT_REGEX.exec(text)) && slotCursor < missingSlots.length) {
    const prompt = normalizePromptText(regexMatch[1] ?? '');
    let assigned = missingSlots[slotCursor];
    if (normalizePromptText(assigned.slot.prompt) !== prompt) {
      const nextIndex = missingSlots.findIndex(
        (item, index) => index >= slotCursor && normalizePromptText(item.slot.prompt) === prompt,
      );
      if (nextIndex >= 0) {
        assigned = missingSlots[nextIndex];
        missingSlots.splice(nextIndex, 1);
        missingSlots.splice(slotCursor, 0, assigned);
      }
    }

    matches.push({
      slot: assigned.slot,
      state: assigned.state,
      start: regexMatch.index,
      end: regexMatch.index + regexMatch[0].length,
      rawMatch: regexMatch[0],
    });
    slotCursor += 1;
  }

  matches.reverse().forEach(match => {
    const start = resolveRangeStart(segments, match.start);
    const end = resolveRangeEnd(segments, match.end);
    if (!start || !end) {
      return;
    }

    const range = root.ownerDocument.createRange();
    range.setStart(start.node, start.offset);
    range.setEnd(end.node, end.offset);
    range.deleteContents();
    range.insertNode(
      createElementFromHtml(
        root.ownerDocument,
        buildCardHtml(
          match.slot,
          match.state,
          `${BODY_SLOT_ATTR}="true" ${ORIGINAL_MATCH_ATTR}="${escapeHtml(match.rawMatch)}"`,
        ),
      ),
    );
    range.detach();
  });
}

function upsertBodySlots(
  $display: JQuery<HTMLDivElement>,
  parsed: ParsedImagePromptMessage,
  states: Map<string, ImageSlotRenderState>,
): void {
  const missingSlots: Array<{ slot: ImagePromptSlot; state: ImageSlotRenderState }> = [];

  parsed.bodySlots.forEach(slot => {
    const state = states.get(slot.slotId) ?? defaultSlotState();
    const $existing = findBodySlotElement($display, slot.slotId);
    if ($existing.length > 0) {
      $existing.replaceWith(
        createElementFromHtml(
          $display.get(0)?.ownerDocument ?? document,
          buildCardHtml(
            slot,
            state,
            `${BODY_SLOT_ATTR}="true" ${ORIGINAL_MATCH_ATTR}="${escapeHtml(slot.rawMatch ?? '')}"`,
          ),
        ),
      );
      return;
    }
    missingSlots.push({ slot, state });
  });

  replaceMissingBodySlots($display, missingSlots);
}

function removeStaleBodySlots($display: JQuery<HTMLDivElement>, activeSlotIds: Set<string>): void {
  findSlotElements($display)
    .filter((_index, element) => element.getAttribute(BODY_SLOT_ATTR) === 'true')
    .each((_index, element) => {
      const slotId = element.getAttribute('data-slot-id') ?? '';
      if (activeSlotIds.has(slotId)) {
        return;
      }
      replaceNodeWithText(element, element.getAttribute(ORIGINAL_MATCH_ATTR) ?? '');
    });
}

function upsertReasoningSummary(
  $display: JQuery<HTMLDivElement>,
  parsed: ParsedImagePromptMessage,
  states: Map<string, ImageSlotRenderState>,
): void {
  const $existing = $display.find(`[${SUMMARY_HOST_ATTR}="true"]`);
  if (parsed.reasoningOnlySlots.length === 0 && parsed.persistedOnlySlots.length === 0) {
    $existing.remove();
    return;
  }

  const summaryElement = createElementFromHtml(
    $display.get(0)?.ownerDocument ?? document,
    buildSummaryHtml(parsed, states),
  );
  if ($existing.length > 0) {
    $existing.replaceWith(summaryElement);
    return;
  }

  $display.append(summaryElement);
}

function attachHandlers($display: JQuery<HTMLDivElement>, handlers: RenderHandlers): void {
  $display.off(EVENT_NAMESPACE);
  $display.on(`click${EVENT_NAMESPACE}`, '[data-action="toggle"]', event => {
    event.preventDefault();
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      handlers.onToggle(slotId);
    }
  });

  $display.on(`click${EVENT_NAMESPACE}`, '[data-action="generate"]', event => {
    event.preventDefault();
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      void handlers.onGenerate(slotId);
    }
  });

  $display.on(`click${EVENT_NAMESPACE}`, '[data-action="toggle-prompt"]', event => {
    event.preventDefault();
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      handlers.onTogglePrompt(slotId);
    }
  });

  $display.find('.tti-image-inline-slot__image').off(EVENT_NAMESPACE).on(`error${EVENT_NAMESPACE}`, event => {
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      handlers.onImageError(slotId);
    }
  });
}

export function renderImageSlotsIntoMessage(
  _messageId: number,
  $display: JQuery<HTMLDivElement>,
  parsed: ParsedImagePromptMessage,
  states: Map<string, ImageSlotRenderState>,
  handlers: RenderHandlers,
): void {
  removeStaleBodySlots($display, new Set(parsed.bodySlots.map(slot => slot.slotId)));
  upsertBodySlots($display, parsed, states);
  upsertReasoningSummary($display, parsed, states);

  const hasAnyAugmentation =
    parsed.bodySlots.length > 0 || parsed.reasoningOnlySlots.length > 0 || parsed.persistedOnlySlots.length > 0;
  if (hasAnyAugmentation) {
    $display.attr('data-tti-image-augmented', 'true');
  } else {
    $display.removeAttr('data-tti-image-augmented');
  }
  attachHandlers($display, handlers);
}

export function restoreOriginalMessageHtml(
  _messageId: number,
  $display: JQuery<HTMLDivElement>,
  _sourceText: string,
): void {
  findSlotElements($display)
    .filter((_index, element) => element.getAttribute(BODY_SLOT_ATTR) === 'true')
    .each((_index, element) => {
      replaceNodeWithText(element, element.getAttribute(ORIGINAL_MATCH_ATTR) ?? '');
    });

  $display.find(`[${SUMMARY_HOST_ATTR}="true"]`).remove();
  $display.off(EVENT_NAMESPACE);
  $display.removeAttr('data-tti-image-augmented');
}

export function defaultSlotState(): ImageSlotRenderState {
  return {
    status: 'idle',
    expanded: false,
    showPrompt: true,
    imageUrl: '',
    error: '',
    cacheHit: false,
    updatedAt: null,
  };
}
