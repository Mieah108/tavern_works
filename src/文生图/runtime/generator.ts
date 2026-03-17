import { loadImageWorkbenchConfig, type ImageWorkbenchConfig } from '../config';
import { showWorkbenchToast } from '../notifications';
import { generateImageDirectly } from './service';
import type { GenerateImageResult, ImagePromptSlot } from './types';

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function containsCjk(text: string): boolean {
  return /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(text);
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function stripPromptMarkers(text: string): string {
  return text.replace(/image###([\s\S]+?)###/g, '$1').replace(/\s+/g, ' ').trim();
}

function buildContextHint(messageId: number): string {
  const start = Math.max(0, messageId - 2);
  const messages = getChatMessages(`${start}-${messageId}`).filter(item => !item.is_hidden);
  return messages
    .map(item => {
      const roleLabel = item.role === 'user' ? '用户' : item.role === 'assistant' ? '助手' : '系统';
      return `${roleLabel}：${stripPromptMarkers(item.message).slice(0, 120)}`;
    })
    .join(' | ')
    .slice(0, 420);
}

function appendPromptParts(parts: string[]): string {
  return parts
    .map(part => collapseWhitespace(part))
    .filter(Boolean)
    .join(', ');
}

function buildFinalPrompt(slotPrompt: string, config: ImageWorkbenchConfig, messageId: number): {
  finalPrompt: string;
  negativePrompt: string;
  contextHint: string;
} {
  const promptParts = [config.promptPrefix, slotPrompt, config.promptSuffix];

  if (config.autoInjectCharacterName && typeof SillyTavern !== 'undefined' && SillyTavern.name2) {
    promptParts.push(`character focus: ${SillyTavern.name2}`);
  }

  const contextHint = config.appendSceneContext ? buildContextHint(messageId) : '';
  if (contextHint) {
    promptParts.push(`scene context: ${contextHint}`);
  }

  if (config.enableTranslationHint && containsCjk(slotPrompt)) {
    promptParts.push('best interpreted as a natural English image prompt');
  }

  return {
    finalPrompt: appendPromptParts(promptParts),
    negativePrompt: collapseWhitespace(config.negativePrompt),
    contextHint,
  };
}

function getTotalAttempts(config: ImageWorkbenchConfig): number {
  return Math.max(1, Math.min(config.retryCount, 3));
}

export async function generateImageForSlot(
  messageId: number,
  slot: ImagePromptSlot,
  forceRegenerate: boolean,
): Promise<GenerateImageResult> {
  const { config } = loadImageWorkbenchConfig();
  if (!config.runtimeEnabled) {
    throw new Error('文生图运行期功能已在配置中关闭。');
  }

  const { finalPrompt, negativePrompt, contextHint } = buildFinalPrompt(slot.prompt, config, messageId);
  const totalAttempts = getTotalAttempts(config);
  const startAt = performance.now();
  showWorkbenchToast('info', `第 ${messageId} 楼插图开始生成。`, {
    title: '文生图运行期',
    dedupeKey: `tti-generate-start-${messageId}-${slot.slotId}`,
    timeOut: 2200,
  });

  let lastError: unknown = null;

  for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
    try {
      const result = await generateImageDirectly({
        messageId,
        slotId: slot.slotId,
        originalPrompt: slot.prompt,
        finalPrompt,
        negativePrompt,
        contextHint,
        forceRegenerate,
        config,
      });

      const durationMs = Math.round(performance.now() - startAt);
      showWorkbenchToast('success', `生成完成，用时 ${(durationMs / 1000).toFixed(1)} 秒。`, {
        title: '文生图运行期',
        dedupeKey: `tti-generate-success-${messageId}-${slot.slotId}`,
      });

      return {
        ...result,
        finalPrompt,
        negativePrompt,
      };
    } catch (error) {
      lastError = error;
      if (attempt < totalAttempts) {
        const message = error instanceof Error ? error.message : '未知错误';
        showWorkbenchToast('warning', `第 ${attempt} 次尝试失败：${message}，准备重试。`, {
          title: '文生图运行期',
          dedupeKey: `tti-generate-retry-${messageId}-${slot.slotId}-${attempt}`,
          timeOut: 4200,
        });
        await delay(config.retryIntervalMs);
      }
    }
  }

  const message = lastError instanceof Error ? lastError.message : '生图失败。';
  showWorkbenchToast('error', message, {
    title: '文生图运行期',
    dedupeKey: `tti-generate-error-${messageId}-${slot.slotId}`,
    timeOut: 5600,
  });
  throw new Error(message);
}
