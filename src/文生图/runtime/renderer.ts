import type { ImagePromptSlot, ImageSlotRenderState, ParsedImagePromptMessage } from './types';

type RenderHandlers = {
  onToggle: (slotId: string) => void;
  onGenerate: (slotId: string) => void;
  onImageError: (slotId: string) => void;
};

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

function buildCardHtml(slot: ImagePromptSlot, state: ImageSlotRenderState): string {
  const actionLabel =
    state.status === 'generating' ? '生成中...' : state.imageUrl || state.status === 'success' ? '重新生成' : '生成插图';

  const metaText =
    state.status === 'success' && state.updatedAt
      ? `最近更新：${new Date(state.updatedAt).toLocaleString()}`
      : slot.source === 'reasoning-only'
        ? '该提示词只出现在思维链中，已折叠汇总到正文末尾。'
        : '点击生成后会在当前位置插入插图。';

  return `
    <span class="tti-image-inline-slot ${state.status !== 'idle' ? `is-${state.status}` : ''} ${state.expanded ? 'is-expanded' : ''}" data-slot-id="${escapeHtml(slot.slotId)}">
      <span class="tti-image-inline-slot__header">
        <span class="tti-image-inline-slot__pill">
          <i class="fa-solid fa-image" aria-hidden="true"></i>
          <span>${slot.source === 'reasoning-only' ? '隐藏插图提示' : '插图入口'}</span>
        </span>
        <button type="button" class="tti-image-inline-slot__toggle" data-action="toggle" data-slot-id="${escapeHtml(slot.slotId)}">
          ${state.expanded ? '收起' : '展开'}
        </button>
        <span class="tti-image-inline-slot__status ${getSlotStatusTone(state)}">${escapeHtml(getSlotStatusText(state))}</span>
        <button type="button" class="tti-image-inline-slot__action" data-action="generate" data-slot-id="${escapeHtml(slot.slotId)}" ${state.status === 'generating' ? 'disabled' : ''}>
          ${actionLabel}
        </button>
      </span>
      <span class="tti-image-inline-slot__body">
        <span class="tti-image-inline-slot__prompt">${escapeHtml(slot.prompt)}</span>
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

function attachHandlers($display: JQuery<HTMLDivElement>, handlers: RenderHandlers): void {
  $display.find('[data-action="toggle"]').on('click', event => {
    event.preventDefault();
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      handlers.onToggle(slotId);
    }
  });

  $display.find('[data-action="generate"]').on('click', event => {
    event.preventDefault();
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      void handlers.onGenerate(slotId);
    }
  });

  $display.find('.tti-image-inline-slot__image').on('error', event => {
    const slotId = String((event.currentTarget as HTMLElement).getAttribute('data-slot-id') ?? '');
    if (slotId) {
      handlers.onImageError(slotId);
    }
  });
}

export function renderImageSlotsIntoMessage(
  messageId: number,
  $display: JQuery<HTMLDivElement>,
  parsed: ParsedImagePromptMessage,
  states: Map<string, ImageSlotRenderState>,
  handlers: RenderHandlers,
): void {
  let html = formatAsDisplayedMessage(parsed.bodyTemplate, { message_id: messageId });

  parsed.bodySlots.forEach(slot => {
    const slotHtml = buildCardHtml(slot, states.get(slot.slotId) ?? defaultSlotState());
    html = html.split(slot.placeholderToken ?? '').join(slotHtml);
  });

  if (parsed.reasoningOnlySlots.length > 0) {
    const summaryHtml = parsed.reasoningOnlySlots
      .map(slot => buildCardHtml(slot, states.get(slot.slotId) ?? defaultSlotState()))
      .join('');
    html += `
      <div class="tti-image-inline-summary">
        <div class="tti-image-inline-summary__title">
          <i class="fa-solid fa-eye-slash" aria-hidden="true"></i>
          <span>隐藏插图提示</span>
        </div>
        ${summaryHtml}
      </div>
    `;
  }

  $display.attr('data-tti-image-augmented', 'true');
  $display.html(html);
  attachHandlers($display, handlers);
}

export function restoreOriginalMessageHtml(messageId: number, $display: JQuery<HTMLDivElement>, sourceText: string): void {
  if ($display.attr('data-tti-image-augmented') !== 'true') {
    return;
  }

  $display.removeAttr('data-tti-image-augmented');
  $display.html(formatAsDisplayedMessage(sourceText, { message_id: messageId }));
}

export function defaultSlotState(): ImageSlotRenderState {
  return {
    status: 'idle',
    expanded: false,
    imageUrl: '',
    error: '',
    cacheHit: false,
    updatedAt: null,
  };
}
