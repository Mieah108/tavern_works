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

const NOVELAI_DEFAULT_SAMPLER = 'k_dpmpp_2m';
const NOVELAI_DEFAULT_NOISE_SCHEDULE = 'karras';
const NOVELAI_V4_DEFAULT_SAMPLER = 'k_euler_ancestral';
const NOVELAI_V4_DEFAULT_NOISE_SCHEDULE = 'karras';

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

function normalizeNovelAiSampler(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) {
    return NOVELAI_DEFAULT_SAMPLER;
  }

  if (/^k_[a-z0-9_]+$/.test(value)) {
    return value;
  }

  const map: Record<string, string> = {
    'dpm++ 2m karras': 'k_dpmpp_2m',
    'dpm++ 2m': 'k_dpmpp_2m',
    'dpmpp 2m karras': 'k_dpmpp_2m',
    'dpmpp 2m': 'k_dpmpp_2m',
    'euler a': 'k_euler_ancestral',
    euler: 'k_euler',
    ddim: 'ddim',
  };

  if (map[value]) {
    return map[value];
  }

  const compact = value.replace(/[^a-z0-9]+/g, ' ').trim();
  if (/\bdpm\b/.test(compact) && /\b2m\b/.test(compact)) {
    return 'k_dpmpp_2m';
  }
  if (/\beuler\b/.test(compact) && /\bancestral\b|\ba\b/.test(compact)) {
    return 'k_euler_ancestral';
  }
  if (compact === 'euler') {
    return 'k_euler';
  }
  if (compact === 'ddim') {
    return 'ddim';
  }

  return NOVELAI_DEFAULT_SAMPLER;
}

function normalizeNovelAiNoiseSchedule(raw: string): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) {
    return NOVELAI_DEFAULT_NOISE_SCHEDULE;
  }

  if (value.includes('native')) {
    return 'native';
  }
  if (value.includes('poly')) {
    return 'polyexponential';
  }
  if (value.includes('exponential')) {
    return 'exponential';
  }
  if (value.includes('karras')) {
    return 'karras';
  }

  return NOVELAI_DEFAULT_NOISE_SCHEDULE;
}

function isNovelAiV4Model(model: string): boolean {
  return /^nai-diffusion-4(?:-|$)/i.test(String(model || '').trim());
}

function getNovelAiDefaultSampler(model: string): string {
  return isNovelAiV4Model(model) ? NOVELAI_V4_DEFAULT_SAMPLER : NOVELAI_DEFAULT_SAMPLER;
}

function getNovelAiDefaultNoiseSchedule(model: string): string {
  return isNovelAiV4Model(model) ? NOVELAI_V4_DEFAULT_NOISE_SCHEDULE : NOVELAI_DEFAULT_NOISE_SCHEDULE;
}

function shouldPreferNovelAiModelDefaultSampler(raw: string, model: string): boolean {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) {
    return true;
  }

  if (!isNovelAiV4Model(model)) {
    return false;
  }

  return [
    'dpm++ 2m karras',
    'dpm++ 2m',
    'dpmpp 2m karras',
    'dpmpp 2m',
    'k_dpmpp_2m',
  ].includes(value);
}

function getNovelAiEffectiveSampler(raw: string, model: string): string {
  if (shouldPreferNovelAiModelDefaultSampler(raw, model)) {
    return getNovelAiDefaultSampler(model);
  }

  return normalizeNovelAiSampler(raw);
}

function getNovelAiEffectiveNoiseSchedule(raw: string, model: string): string {
  const value = String(raw || '').trim();
  if (!value) {
    return getNovelAiDefaultNoiseSchedule(model);
  }

  return normalizeNovelAiNoiseSchedule(raw);
}

function normalizeNovelAiSeed(seed: number): number {
  return seed >= 0 ? seed : Math.floor(Math.random() * 999999999);
}

function buildNovelAiV4Prompt(prompt: string): Record<string, unknown> {
  return {
    caption: {
      base_caption: prompt,
      char_captions: [],
    },
    use_coords: false,
    use_order: true,
  };
}

function buildNovelAiV4NegativePrompt(negativePrompt: string): Record<string, unknown> {
  return {
    legacy_uc: false,
    caption: {
      base_caption: negativePrompt,
      char_captions: [],
    },
  };
}

function buildNovelAiRequestBody(
  request: GenerateImageRequest,
  overrides: Partial<{
    model: string;
    sampler: string;
    noiseSchedule: string;
    includeNoiseSchedule: boolean;
  }> = {},
): Record<string, unknown> {
  const model = overrides.model || request.config.model || 'nai-diffusion-3';
  const sampler =
    overrides.sampler ||
    getNovelAiEffectiveSampler(request.config.sampler, model) ||
    getNovelAiDefaultSampler(model);
  const normalizedSampler = sampler || getNovelAiDefaultSampler(model);
  const normalizedNoiseSchedule =
    overrides.noiseSchedule ||
    getNovelAiEffectiveNoiseSchedule(request.config.scheduler, model) ||
    getNovelAiDefaultNoiseSchedule(model);
  const includeNoiseSchedule = overrides.includeNoiseSchedule ?? normalizedSampler !== 'ddim';

  const parameters: Record<string, unknown> = {
    cfg_rescale: 0,
    controlnet_strength: 1,
    dynamic_thresholding: true,
    skip_cfg_above_sigma: null,
    legacy: false,
    legacy_uc: false,
    legacy_v3_extend: false,
    params_version: 3,
    width: request.config.width,
    height: request.config.height,
    scale: request.config.cfgScale,
    steps: request.config.steps,
    sampler: normalizedSampler,
    seed: normalizeNovelAiSeed(request.config.seed),
    n_samples: 1,
    ucPreset: 0,
    qualityToggle: false,
    negative_prompt: request.negativePrompt,
    sm: false,
    sm_dyn: false,
    autoSmea: false,
  };

  if (includeNoiseSchedule) {
    parameters.noise_schedule = normalizedNoiseSchedule;
  }

  if (isNovelAiV4Model(model)) {
    parameters.use_coords = false;
    parameters.prefer_brownian = true;
    parameters.deliberate_euler_ancestral_bug = false;
    parameters.v4_prompt = buildNovelAiV4Prompt(request.finalPrompt);
    parameters.v4_negative_prompt = buildNovelAiV4NegativePrompt(request.negativePrompt);
  }

  return mergeDeep(
    {
      action: 'generate',
      input: request.finalPrompt,
      model,
      parameters,
    },
    parseJsonObject(request.config.extraPayloadJson),
  );
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
    const message: unknown =
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

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

async function inflateRaw(bytes: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 NovelAI 压缩包解压，请改用支持 DecompressionStream 的浏览器。');
  }

  const stream = new Blob([toArrayBuffer(bytes)]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
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
      return { blob: new Blob([toArrayBuffer(compressed)], { type: mimeType }), mimeType };
    }

    if (compressionMethod === 8) {
      const inflated = await inflateRaw(compressed);
      return { blob: new Blob([toArrayBuffer(inflated)], { type: mimeType }), mimeType };
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
  const model = request.config.model || 'nai-diffusion-3';
  const baseSampler = getNovelAiEffectiveSampler(request.config.sampler, model) || getNovelAiDefaultSampler(model);
  const baseNoiseSchedule = getNovelAiEffectiveNoiseSchedule(request.config.scheduler, model) || getNovelAiDefaultNoiseSchedule(model);
  const variants: Array<{
    label: string;
    sampler: string;
    noiseSchedule: string;
    includeNoiseSchedule: boolean;
  }> = [
    {
      label: 'current',
      sampler: baseSampler,
      noiseSchedule: baseNoiseSchedule,
      includeNoiseSchedule: baseSampler !== 'ddim',
    },
  ];

  if (isNovelAiV4Model(model) && (baseSampler !== NOVELAI_V4_DEFAULT_SAMPLER || baseNoiseSchedule !== NOVELAI_V4_DEFAULT_NOISE_SCHEDULE)) {
    variants.push({
      label: 'v4-safe-defaults',
      sampler: NOVELAI_V4_DEFAULT_SAMPLER,
      noiseSchedule: NOVELAI_V4_DEFAULT_NOISE_SCHEDULE,
      includeNoiseSchedule: true,
    });
  }

  if (baseSampler !== 'ddim') {
    variants.push({
      label: 'without-noise-schedule',
      sampler: variants[variants.length - 1].sampler,
      noiseSchedule: variants[variants.length - 1].noiseSchedule,
      includeNoiseSchedule: false,
    });
  }

  let lastError: Error | null = null;
  for (const variant of variants) {
    const response = await fetchWithTimeout(
      targetUrl,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getRequestHeaders(request.config),
          Accept: 'application/zip, application/octet-stream, application/json, text/plain, */*',
        },
        body: JSON.stringify(
          buildNovelAiRequestBody(request, {
            model,
            sampler: variant.sampler,
            noiseSchedule: variant.noiseSchedule,
            includeNoiseSchedule: variant.includeNoiseSchedule,
          }),
        ),
      },
      request.config.timeoutSeconds,
    );

    if (response.ok) {
      const archive = await response.arrayBuffer();
      const { blob, mimeType } = await extractZipImage(archive);
      return {
        imageUrl: await blobToDataUrl(blob),
        mimeType,
        byteLength: blob.size,
      };
    }

    const payload = await readJsonResponse(response);
    const error = formatRequestError(response.status, payload, 'NovelAI 生图失败');
    lastError = error;

    if (response.status < 500) {
      throw error;
    }
  }

  const samplerSummary = variants.map(variant => variant.sampler).join(' -> ');
  const scheduleSummary = variants
    .map(variant => (variant.includeNoiseSchedule ? variant.noiseSchedule : '(none)'))
    .join(' -> ');
  throw new Error(
    `${lastError?.message ?? '[500] NovelAI 生图失败'}。已尝试兼容参数回退：model=${model}，sampler=${samplerSummary}，noise_schedule=${scheduleSummary}。`,
  );
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
