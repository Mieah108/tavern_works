import type { ImageWorkbenchConfig } from '../config';
import type { GenerateImageRequest, GenerateImageResult } from './types';

type NormalizedImageValue =
  | {
      mimeType: string;
      base64: string;
    }
  | {
      url: string;
    };

function parseJsonObject(raw: string): Record<string, unknown> {
  if (!raw.trim()) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function mergeDeep<T extends Record<string, unknown>>(base: T, patch: Record<string, unknown>): T {
  const next = { ...base } as Record<string, unknown>;

  Object.entries(patch).forEach(([key, value]) => {
    const current = next[key];
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
    ) {
      next[key] = mergeDeep(current as Record<string, unknown>, value as Record<string, unknown>);
    } else {
      next[key] = value;
    }
  });

  return next as T;
}

function normalizeUrl(baseUrl: string, route = ''): string {
  const base = String(baseUrl || '').trim().replace(/\/+$/, '');
  const next = String(route || '').trim();
  if (!next) {
    return base;
  }
  if (/^https?:\/\//i.test(next)) {
    return next;
  }
  return `${base}/${next.replace(/^\/+/, '')}`;
}

function getAuthHeaders(config: ImageWorkbenchConfig): Record<string, string> {
  if (config.authType === 'none' || !config.apiKey.trim()) {
    return {};
  }

  if (config.authType === 'bearer') {
    return {
      Authorization: `Bearer ${config.apiKey.trim()}`,
    };
  }

  return {
    [config.apiHeaderName.trim() || 'Authorization']: config.apiKey.trim(),
  };
}

function getRequestHeaders(config: ImageWorkbenchConfig): Record<string, string> {
  return {
    Accept: 'application/json, text/plain, */*',
    ...getAuthHeaders(config),
    ...Object.fromEntries(
      Object.entries(parseJsonObject(config.extraHeadersJson)).map(([key, value]) => [key, String(value)]),
    ),
  };
}

function buildSdPayload(request: GenerateImageRequest): Record<string, unknown> {
  const { config, finalPrompt, negativePrompt } = request;
  const basePayload: Record<string, unknown> = {
    prompt: finalPrompt,
    negative_prompt: negativePrompt,
    width: config.width,
    height: config.height,
    steps: config.steps,
    cfg_scale: config.cfgScale,
    seed: config.seed,
    batch_size: config.batchSize,
    n_iter: config.batchCount,
    sampler_name: config.sampler,
    scheduler: config.scheduler,
    denoising_strength: config.denoiseStrength,
    override_settings: {},
  };

  if (config.model) {
    (basePayload.override_settings as Record<string, unknown>).sd_model_checkpoint = config.model;
  }
  if (config.clipSkip > 1) {
    (basePayload.override_settings as Record<string, unknown>).CLIP_stop_at_last_layers = config.clipSkip;
  }
  if (config.enableHiresFix) {
    basePayload.enable_hr = true;
    basePayload.hr_scale = config.hiresScale;
    basePayload.hr_second_pass_steps = config.hiresSteps;
    basePayload.hr_upscaler = config.upscaler;
  }

  return mergeDeep(basePayload, parseJsonObject(config.extraPayloadJson));
}

function buildCustomPayload(request: GenerateImageRequest): Record<string, unknown> {
  const { config, finalPrompt, negativePrompt, slotId, messageId, contextHint, originalPrompt } = request;
  return mergeDeep(
    {
      slot_id: slotId,
      message_id: messageId,
      prompt: finalPrompt,
      original_prompt: originalPrompt,
      negative_prompt: negativePrompt,
      context_hint: contextHint,
      backend_type: config.backendType,
      model: config.model,
      sampler: config.sampler,
      scheduler: config.scheduler,
      clip_skip: config.clipSkip,
      width: config.width,
      height: config.height,
      steps: config.steps,
      cfg_scale: config.cfgScale,
      denoise_strength: config.denoiseStrength,
      seed: config.seed,
      batch_size: config.batchSize,
      batch_count: config.batchCount,
      enable_hires_fix: config.enableHiresFix,
      hires_scale: config.hiresScale,
      hires_steps: config.hiresSteps,
      upscaler: config.upscaler,
    },
    parseJsonObject(config.extraPayloadJson),
  );
}

function toPathSegments(fieldPath: string): string[] {
  return String(fieldPath || '')
    .replace(/\[(\d+)\]/g, '.$1')
    .split('.')
    .map(segment => segment.trim())
    .filter(Boolean);
}

function getByPath(object: unknown, fieldPath: string): unknown {
  let current = object;
  for (const segment of toPathSegments(fieldPath)) {
    if (!current || typeof current !== 'object') {
      return undefined;
    }
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}

function detectMimeFromBase64(base64: string): string {
  if (base64.startsWith('/9j/')) {
    return 'image/jpeg';
  }
  if (base64.startsWith('iVBOR')) {
    return 'image/png';
  }
  if (base64.startsWith('UklGR')) {
    return 'image/webp';
  }
  return 'image/png';
}

function extractDataUrl(value: string): NormalizedImageValue | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) {
    return null;
  }

  return {
    mimeType: match[1],
    base64: match[2],
  };
}

function normalizeImageValue(value: unknown): NormalizedImageValue | null {
  if (Array.isArray(value)) {
    return normalizeImageValue(value[0]);
  }

  if (typeof value === 'string') {
    const dataUrl = extractDataUrl(value);
    if (dataUrl) {
      return dataUrl;
    }

    if (/^https?:\/\//i.test(value)) {
      return { url: value };
    }

    return {
      mimeType: detectMimeFromBase64(value),
      base64: value,
    };
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.b64_json === 'string') {
      return {
        mimeType: 'image/png',
        base64: record.b64_json,
      };
    }
    if (typeof record.url === 'string') {
      return {
        url: record.url,
      };
    }
  }

  return null;
}

async function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('读取图片失败。'));
    reader.readAsDataURL(blob);
  });
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutSeconds: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), Math.max(5, timeoutSeconds) * 1000);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请检查后端连通性或增大超时设置。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function readJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function formatRequestError(status: number, payload: unknown, fallback: string): Error {
  if (typeof payload === 'string' && payload.trim()) {
    return new Error(`[${status}] ${payload.trim()}`);
  }

  if (payload && typeof payload === 'object') {
    const message =
      _.get(payload, 'detail.message') ??
      _.get(payload, 'detail') ??
      _.get(payload, 'message') ??
      _.get(payload, 'error.message') ??
      _.get(payload, 'error') ??
      _.get(payload, 'msg');

    if (typeof message === 'string' && message.trim()) {
      return new Error(`[${status}] ${message.trim()}`);
    }
  }

  return new Error(`[${status}] ${fallback}`);
}

function uint16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function uint32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 NovelAI 压缩包解压，请改用支持 DecompressionStream 的浏览器。');
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function extractZipImage(archive: ArrayBuffer): Promise<{ blob: Blob; mimeType: string }> {
  const bytes = new Uint8Array(archive);
  const view = new DataView(archive);
  const eocdSignature = 0x06054b50;
  const centralDirectorySignature = 0x02014b50;
  const localHeaderSignature = 0x04034b50;

  let eocdOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 0xffff - 22); offset -= 1) {
    if (view.getUint32(offset, true) === eocdSignature) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error('无法定位 NovelAI 压缩包目录。');
  }

  const entryCount = uint16(view, eocdOffset + 10);
  let cursor = uint32(view, eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== centralDirectorySignature) {
      throw new Error('NovelAI 压缩包目录已损坏。');
    }

    const compressionMethod = uint16(view, cursor + 10);
    const compressedSize = uint32(view, cursor + 20);
    const fileNameLength = uint16(view, cursor + 28);
    const extraLength = uint16(view, cursor + 30);
    const commentLength = uint16(view, cursor + 32);
    const localHeaderOffset = uint32(view, cursor + 42);
    const fileName = new TextDecoder().decode(bytes.slice(cursor + 46, cursor + 46 + fileNameLength));

    cursor += 46 + fileNameLength + extraLength + commentLength;

    if (!/\.(png|jpg|jpeg|webp)$/i.test(fileName.toLowerCase())) {
      continue;
    }

    if (localHeaderOffset + 30 > bytes.length || view.getUint32(localHeaderOffset, true) !== localHeaderSignature) {
      throw new Error('NovelAI 压缩包中的图片头部无效。');
    }

    const localNameLength = uint16(view, localHeaderOffset + 26);
    const localExtraLength = uint16(view, localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const dataEnd = dataStart + compressedSize;

    if (dataEnd > bytes.length) {
      throw new Error('NovelAI 压缩包中的图片数据不完整。');
    }

    const compressed = bytes.slice(dataStart, dataEnd);
    const mimeType = fileName.toLowerCase().endsWith('.jpg') || fileName.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : fileName.toLowerCase().endsWith('.webp')
        ? 'image/webp'
        : 'image/png';

    if (compressionMethod === 0) {
      return { blob: new Blob([compressed], { type: mimeType }), mimeType };
    }

    if (compressionMethod === 8) {
      const inflated = await inflateRaw(compressed);
      return { blob: new Blob([inflated], { type: mimeType }), mimeType };
    }

    throw new Error(`NovelAI 压缩包使用了暂不支持的压缩方式：${compressionMethod}`);
  }

  throw new Error('NovelAI 压缩包中没有找到图片文件。');
}

async function resolveImageData(
  normalized: NormalizedImageValue,
  config: ImageWorkbenchConfig,
): Promise<{ imageUrl: string; mimeType: string; byteLength: number }> {
  if ('base64' in normalized) {
    const imageUrl = `data:${normalized.mimeType};base64,${normalized.base64}`;
    const byteLength = Math.floor((normalized.base64.length * 3) / 4);
    return {
      imageUrl,
      mimeType: normalized.mimeType,
      byteLength,
    };
  }

  const remoteUrl = /^https?:\/\//i.test(normalized.url) ? normalized.url : normalizeUrl(config.apiBaseUrl, normalized.url);
  const response = await fetchWithTimeout(
    remoteUrl,
    {
      method: 'GET',
      headers: getRequestHeaders(config),
    },
    config.timeoutSeconds,
  );

  if (!response.ok) {
    throw formatRequestError(response.status, await readJsonResponse(response), '远程图片下载失败');
  }

  const blob = await response.blob();
  return {
    imageUrl: await blobToDataUrl(blob),
    mimeType: blob.type || 'image/png',
    byteLength: blob.size,
  };
}

async function generateViaSd(request: GenerateImageRequest): Promise<{ imageUrl: string; mimeType: string; byteLength: number }> {
  const targetUrl = normalizeUrl(request.config.apiBaseUrl, request.config.apiPath || '/sdapi/v1/txt2img');
  const response = await fetchWithTimeout(
    targetUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getRequestHeaders(request.config),
      },
      body: JSON.stringify(buildSdPayload(request)),
    },
    request.config.timeoutSeconds,
  );

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw formatRequestError(response.status, payload, '生图接口失败');
  }

  const image = normalizeImageValue(_.get(payload, 'images'));
  if (!image) {
    throw new Error('后端没有返回可用的图像数据。');
  }

  return resolveImageData(image, request.config);
}

async function generateViaNovelAi(
  request: GenerateImageRequest,
): Promise<{ imageUrl: string; mimeType: string; byteLength: number }> {
  const targetUrl = normalizeUrl(request.config.apiBaseUrl || 'https://image.novelai.net', request.config.apiPath || '/ai/generate-image');
  const response = await fetchWithTimeout(
    targetUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getRequestHeaders(request.config),
      },
      body: JSON.stringify({
        action: 'generate',
        input: request.finalPrompt,
        model: request.config.model || 'nai-diffusion-3',
        parameters: {
          params_version: 3,
          width: request.config.width,
          height: request.config.height,
          scale: request.config.cfgScale,
          steps: request.config.steps,
          sampler: request.config.sampler || 'k_dpmpp_2m',
          noise_schedule: request.config.scheduler || 'karras',
          negative_prompt: request.negativePrompt,
          seed: request.config.seed >= 0 ? request.config.seed : Math.floor(Math.random() * 999999999),
          n_samples: 1,
          ucPreset: 0,
          qualityToggle: false,
          sm: false,
          sm_dyn: false,
          uncond_scale: 1,
        },
      }),
    },
    request.config.timeoutSeconds,
  );

  if (!response.ok) {
    throw formatRequestError(response.status, await readJsonResponse(response), 'NovelAI 生图失败');
  }

  const archive = await response.arrayBuffer();
  const { blob, mimeType } = await extractZipImage(archive);
  return {
    imageUrl: await blobToDataUrl(blob),
    mimeType,
    byteLength: blob.size,
  };
}

async function generateViaCustom(
  request: GenerateImageRequest,
): Promise<{ imageUrl: string; mimeType: string; byteLength: number }> {
  const targetUrl = normalizeUrl(request.config.apiBaseUrl, request.config.apiPath || '/');
  const response = await fetchWithTimeout(
    targetUrl,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getRequestHeaders(request.config),
      },
      body: JSON.stringify(buildCustomPayload(request)),
    },
    request.config.timeoutSeconds,
  );

  const payload = await readJsonResponse(response);
  if (!response.ok) {
    throw formatRequestError(response.status, payload, '自定义生图接口失败');
  }

  const imageField = request.config.responseImageField || 'images';
  const image = normalizeImageValue(getByPath(payload, imageField));
  if (!image) {
    throw new Error(
      request.config.backendType === 'comfyui'
        ? '当前 ComfyUI 接口未返回桥接式图像字段，请改用桥接接口或调整响应图像字段路径。'
        : `响应中未找到图像字段：${imageField}`,
    );
  }

  return resolveImageData(image, request.config);
}

export async function generateImageDirectly(request: GenerateImageRequest): Promise<GenerateImageResult> {
  const startedAt = performance.now();
  let image;

  switch (request.config.backendType) {
    case 'sd-webui':
    case 'sd-forge':
      image = await generateViaSd(request);
      break;
    case 'novelai':
      image = await generateViaNovelAi(request);
      break;
    case 'custom':
    case 'comfyui':
      image = await generateViaCustom(request);
      break;
    default:
      throw new Error(`暂不支持的后端类型：${request.config.backendType}`);
  }

  return {
    cacheHit: false,
    imageUrl: image.imageUrl,
    mimeType: image.mimeType,
    byteLength: image.byteLength,
    durationMs: Math.round(performance.now() - startedAt),
    finalPrompt: request.finalPrompt,
    negativePrompt: request.negativePrompt,
  };
}
