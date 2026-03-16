import { z } from 'zod';

export type ConfigSectionKey = 'api' | 'generation' | 'prompt' | 'cache' | 'advanced';

export type BackendType = 'sd-webui' | 'sd-forge' | 'comfyui' | 'novelai' | 'custom';
export type AuthType = 'none' | 'bearer' | 'custom';
export type StylePresetKey =
  | 'none'
  | 'anime-cinematic'
  | 'realistic-photo'
  | 'ink-illustration'
  | 'fantasy-concept'
  | 'portrait-editorial';

type PartialConfig = Partial<ImageWorkbenchConfig>;

const CONFIG_VARIABLE_KEY = '__tti_image_workbench_config_v3__';
const LOCAL_STORAGE_KEY = 'ST_TTI_IMAGE_WORKBENCH_CONFIG_V3';
const PRESET_STORE_VARIABLE_KEY = '__tti_image_workbench_preset_store_v1__';
const PRESET_STORE_LOCAL_STORAGE_KEY = 'ST_TTI_IMAGE_WORKBENCH_PRESET_STORE_V1';

function clamp(value: number, min: number, max: number): number {
  return _.clamp(value, min, max);
}

function round(value: number, digits = 2): number {
  return Number(value.toFixed(digits));
}

function stringField(defaultValue: string) {
  return z
    .string()
    .default(defaultValue)
    .catch(defaultValue)
    .transform(value => value.replace(/\r\n/g, '\n'));
}

function integerField(defaultValue: number, min: number, max: number) {
  return z
    .coerce.number()
    .int()
    .default(defaultValue)
    .catch(defaultValue)
    .transform(value => Math.round(clamp(value, min, max)));
}

function floatField(defaultValue: number, min: number, max: number, digits = 2) {
  return z
    .coerce.number()
    .default(defaultValue)
    .catch(defaultValue)
    .transform(value => round(clamp(value, min, max), digits));
}

function booleanField(defaultValue: boolean) {
  return z.boolean().default(defaultValue).catch(defaultValue);
}

function dimensionField(defaultValue: number) {
  return z
    .coerce.number()
    .default(defaultValue)
    .catch(defaultValue)
    .transform(value => {
      const normalized = Math.round(value / 64) * 64;
      return Math.round(clamp(normalized, 256, 2048));
    });
}

export const backendOptions: Array<{
  value: BackendType;
  label: string;
  icon: string;
  description: string;
}> = [
  {
    value: 'sd-webui',
    label: 'Stable Diffusion WebUI',
    icon: 'fa-solid fa-bolt',
    description: 'AUTOMATIC1111 标准 txt2img 接口',
  },
  {
    value: 'sd-forge',
    label: 'Forge / ReForge',
    icon: 'fa-solid fa-fire-flame-curved',
    description: '兼容 SD WebUI，但更偏工程化工作流',
  },
  {
    value: 'comfyui',
    label: 'ComfyUI',
    icon: 'fa-solid fa-diagram-project',
    description: '适合工作流化节点与自定义扩展',
  },
  {
    value: 'novelai',
    label: 'NovelAI',
    icon: 'fa-solid fa-feather',
    description: '填入 Token 后可直接作为远程图像生成后端',
  },
  {
    value: 'custom',
    label: '自定义 API',
    icon: 'fa-solid fa-code-branch',
    description: '用于后续对接自建图形生成中间层',
  },
];

export const resolutionPresets = [
  { value: '1024x1024', label: '1024 x 1024', note: '方图 / SDXL 通用' },
  { value: '832x1216', label: '832 x 1216', note: '角色竖构图' },
  { value: '1216x832', label: '1216 x 832', note: '横构图 / 场景' },
  { value: '768x1344', label: '768 x 1344', note: '长比例人像' },
  { value: '1344x768', label: '1344 x 768', note: '横版概念图' },
  { value: '1536x640', label: '1536 x 640', note: '超宽镜头' },
  { value: '640x1536', label: '640 x 1536', note: '长卷式竖图' },
  { value: 'custom', label: '自定义尺寸', note: '手动输入宽高' },
] as const;

export const stylePresets: Array<{
  value: StylePresetKey;
  label: string;
  icon: string;
  promptHint: string;
}> = [
  {
    value: 'none',
    label: '不使用预设',
    icon: 'fa-regular fa-circle',
    promptHint: '完全按你的前后缀与实时提示词决定风格。',
  },
  {
    value: 'anime-cinematic',
    label: '动漫电影感',
    icon: 'fa-solid fa-film',
    promptHint: '适合角色立绘、剧情 CG、电影式景别。',
  },
  {
    value: 'realistic-photo',
    label: '写实摄影',
    icon: 'fa-solid fa-camera-retro',
    promptHint: '强调皮肤质感、镜头语言与真实光照。',
  },
  {
    value: 'ink-illustration',
    label: '插画线稿',
    icon: 'fa-solid fa-pen-ruler',
    promptHint: '适合平面插画、设定图和较强描边。',
  },
  {
    value: 'fantasy-concept',
    label: '奇幻概念',
    icon: 'fa-solid fa-hat-wizard',
    promptHint: '强化氛围、材质层次和世界观设计感。',
  },
  {
    value: 'portrait-editorial',
    label: '时尚肖像',
    icon: 'fa-solid fa-star',
    promptHint: '适合杂志肖像、封面感与高级打光。',
  },
];

export const imageWorkbenchConfigSchema = z.object({
  backendType: z.enum(['sd-webui', 'sd-forge', 'comfyui', 'novelai', 'custom']).default('sd-webui').catch('sd-webui'),
  authType: z.enum(['none', 'bearer', 'custom']).default('none').catch('none'),
  apiBaseUrl: stringField('http://127.0.0.1:7860'),
  apiPath: stringField('/sdapi/v1/txt2img'),
  apiKey: stringField(''),
  apiHeaderName: stringField('Authorization'),
  timeoutSeconds: integerField(60, 5, 600),

  model: stringField(''),
  sampler: stringField('DPM++ 2M Karras'),
  scheduler: stringField('karras'),
  clipSkip: integerField(1, 1, 12),

  width: dimensionField(832),
  height: dimensionField(1216),
  steps: integerField(28, 1, 150),
  cfgScale: floatField(7, 1, 30, 1),
  denoiseStrength: floatField(0.45, 0, 1, 2),
  seed: z.coerce.number().default(-1).catch(-1).transform(value => Math.round(value)),
  batchSize: integerField(1, 1, 8),
  batchCount: integerField(1, 1, 12),

  enableHiresFix: booleanField(false),
  hiresScale: floatField(1.5, 1, 3, 2),
  hiresSteps: integerField(10, 0, 80),
  upscaler: stringField('Latent'),

  stylePreset: z
    .enum(['none', 'anime-cinematic', 'realistic-photo', 'ink-illustration', 'fantasy-concept', 'portrait-editorial'])
    .default('none')
    .catch('none'),
  promptPrefix: stringField('masterpiece, best quality, ultra detailed, cinematic lighting'),
  promptSuffix: stringField(''),
  negativePrompt: stringField('lowres, bad anatomy, bad hands, extra fingers, text, watermark, blurry'),
  enableTranslationHint: booleanField(true),
  autoInjectCharacterName: booleanField(false),
  appendSceneContext: booleanField(true),

  runtimeEnabled: booleanField(true),
  cacheEnabled: booleanField(true),
  cacheMaxCount: integerField(300, 10, 5000),

  retryCount: integerField(3, 1, 3),
  retryIntervalMs: integerField(1200, 200, 10000),
  requestCooldownMs: integerField(0, 0, 60000),
  saveToMessageVariable: booleanField(true),
  keepLastResultCount: integerField(10, 1, 50),
  responseImageField: stringField('images'),
  extraHeadersJson: stringField('{}'),
  extraPayloadJson: stringField('{}'),
});

export type ImageWorkbenchConfig = z.infer<typeof imageWorkbenchConfigSchema>;

export const defaultImageWorkbenchConfig = imageWorkbenchConfigSchema.parse({});

const imageWorkbenchPresetSchema = z.object({
  id: z.string().min(1).catch('default'),
  name: z.string().min(1).catch('默认配置'),
  updatedAt: z.coerce.number().catch(() => Date.now()),
  config: imageWorkbenchConfigSchema.catch(defaultImageWorkbenchConfig),
});

const imageWorkbenchPresetStoreSchema = z.object({
  activePresetId: z.string().min(1).catch('default'),
  presets: z.record(z.string(), imageWorkbenchPresetSchema).catch({}),
});

export type ImageWorkbenchPreset = z.infer<typeof imageWorkbenchPresetSchema>;
export type ImageWorkbenchPresetStore = z.infer<typeof imageWorkbenchPresetStoreSchema>;

function createPresetId(): string {
  return `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createPreset(name: string, config: unknown, id = 'default'): ImageWorkbenchPreset {
  return imageWorkbenchPresetSchema.parse({
    id,
    name,
    updatedAt: Date.now(),
    config: sanitizeImageWorkbenchConfig(config),
  });
}

function createDefaultPresetStore(config = defaultImageWorkbenchConfig): ImageWorkbenchPresetStore {
  const preset = createPreset('默认配置', config, 'default');
  return {
    activePresetId: preset.id,
    presets: {
      [preset.id]: preset,
    },
  };
}

function normalizePresetStore(input: unknown, fallbackConfig = defaultImageWorkbenchConfig): ImageWorkbenchPresetStore {
  const parsed = imageWorkbenchPresetStoreSchema.safeParse(input);
  const baseStore = parsed.success ? parsed.data : createDefaultPresetStore(fallbackConfig);
  const presetEntries = Object.entries(baseStore.presets)
    .map(([key, preset]) => {
      const normalized = imageWorkbenchPresetSchema.parse({
        ...preset,
        id: preset.id || key,
      });
      return [normalized.id, normalized] as const;
    })
    .filter(([, preset]) => preset.name.trim());

  if (presetEntries.length === 0) {
    return createDefaultPresetStore(fallbackConfig);
  }

  const presets = Object.fromEntries(presetEntries);
  const activePresetId = presets[baseStore.activePresetId] ? baseStore.activePresetId : presetEntries[0][0];

  return {
    activePresetId,
    presets,
  };
}

function getLocalStorageRef(): Storage | null {
  const topWindow = window.parent && window.parent !== window ? window.parent : window;

  try {
    return topWindow.localStorage;
  } catch {
    return null;
  }
}

function readPartialFromScriptVariables(): PartialConfig | null {
  try {
    const variables = getVariables({ type: 'script', script_id: getScriptId() });
    const raw = variables[CONFIG_VARIABLE_KEY];
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    const parsed = imageWorkbenchConfigSchema.partial().safeParse(raw);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readPartialFromLocalStorage(): PartialConfig | null {
  const storage = getLocalStorageRef();
  if (!storage) return null;

  try {
    const raw = storage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = imageWorkbenchConfigSchema.partial().safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function readPresetStoreFromScriptVariables(): ImageWorkbenchPresetStore | null {
  try {
    const variables = getVariables({ type: 'script', script_id: getScriptId() });
    const raw = variables[PRESET_STORE_VARIABLE_KEY];
    if (!raw || typeof raw !== 'object') {
      return null;
    }

    return normalizePresetStore(raw);
  } catch {
    return null;
  }
}

function readPresetStoreFromLocalStorage(): ImageWorkbenchPresetStore | null {
  const storage = getLocalStorageRef();
  if (!storage) return null;

  try {
    const raw = storage.getItem(PRESET_STORE_LOCAL_STORAGE_KEY);
    if (!raw) return null;
    return normalizePresetStore(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writePresetStoreToScriptVariables(store: ImageWorkbenchPresetStore): boolean {
  try {
    const variables = getVariables({ type: 'script', script_id: getScriptId() });
    variables[PRESET_STORE_VARIABLE_KEY] = store;
    const activeConfig = store.presets[store.activePresetId]?.config ?? defaultImageWorkbenchConfig;
    variables[CONFIG_VARIABLE_KEY] = activeConfig;
    replaceVariables(variables, { type: 'script', script_id: getScriptId() });
    return true;
  } catch {
    return false;
  }
}

function writePresetStoreToLocalStorage(store: ImageWorkbenchPresetStore): boolean {
  const storage = getLocalStorageRef();
  if (!storage) return false;

  try {
    storage.setItem(PRESET_STORE_LOCAL_STORAGE_KEY, JSON.stringify(store));
    storage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(store.presets[store.activePresetId]?.config ?? defaultImageWorkbenchConfig),
    );
    return true;
  } catch {
    return false;
  }
}

export function sanitizeImageWorkbenchConfig(input: unknown): ImageWorkbenchConfig {
  return imageWorkbenchConfigSchema.parse(input ?? {});
}

export function mergeImageWorkbenchConfig(...parts: Array<unknown>): ImageWorkbenchConfig {
  return sanitizeImageWorkbenchConfig(Object.assign({}, defaultImageWorkbenchConfig, ...parts));
}

export function loadImageWorkbenchConfig(): {
  config: ImageWorkbenchConfig;
  source: 'script' | 'local' | 'default';
} {
  const presetStoreResult = loadImageWorkbenchPresetStore();
  const activePreset = getActiveImageWorkbenchPreset(presetStoreResult.store);

  if (activePreset) {
    return {
      config: activePreset.config,
      source: presetStoreResult.source,
    };
  }

  return { config: { ...defaultImageWorkbenchConfig }, source: 'default' };
}

export function saveImageWorkbenchConfig(input: unknown): {
  config: ImageWorkbenchConfig;
  savedToScript: boolean;
  savedToLocal: boolean;
} {
  const config = sanitizeImageWorkbenchConfig(input);
  const currentStore = loadImageWorkbenchPresetStore().store;
  const activePreset = getActiveImageWorkbenchPreset(currentStore);
  const nextStore = upsertImageWorkbenchPreset(
    currentStore,
    activePreset?.name ?? '默认配置',
    config,
    activePreset?.id ?? currentStore.activePresetId,
  );

  return {
    config,
    savedToScript: writePresetStoreToScriptVariables(nextStore),
    savedToLocal: writePresetStoreToLocalStorage(nextStore),
  };
}

export function exportImageWorkbenchConfigJson(input: unknown): string {
  return JSON.stringify(sanitizeImageWorkbenchConfig(input), null, 2);
}

export function importImageWorkbenchConfigJson(raw: string, base?: unknown): ImageWorkbenchConfig {
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  return mergeImageWorkbenchConfig(base ?? defaultImageWorkbenchConfig, parsed);
}

export function loadImageWorkbenchPresetStore(): {
  store: ImageWorkbenchPresetStore;
  source: 'script' | 'local' | 'default';
} {
  const storeFromScript = readPresetStoreFromScriptVariables();
  if (storeFromScript) {
    return {
      store: storeFromScript,
      source: 'script',
    };
  }

  const storeFromLocal = readPresetStoreFromLocalStorage();
  if (storeFromLocal) {
    return {
      store: storeFromLocal,
      source: 'local',
    };
  }

  const legacyFromScript = readPartialFromScriptVariables();
  if (legacyFromScript) {
    return {
      store: createDefaultPresetStore(mergeImageWorkbenchConfig(legacyFromScript)),
      source: 'script',
    };
  }

  const legacyFromLocal = readPartialFromLocalStorage();
  if (legacyFromLocal) {
    return {
      store: createDefaultPresetStore(mergeImageWorkbenchConfig(legacyFromLocal)),
      source: 'local',
    };
  }

  return {
    store: createDefaultPresetStore(),
    source: 'default',
  };
}

export function saveImageWorkbenchPresetStore(store: unknown): {
  store: ImageWorkbenchPresetStore;
  savedToScript: boolean;
  savedToLocal: boolean;
} {
  const normalized = normalizePresetStore(store);
  return {
    store: normalized,
    savedToScript: writePresetStoreToScriptVariables(normalized),
    savedToLocal: writePresetStoreToLocalStorage(normalized),
  };
}

export function getActiveImageWorkbenchPreset(store: ImageWorkbenchPresetStore): ImageWorkbenchPreset | null {
  return store.presets[store.activePresetId] ?? Object.values(store.presets)[0] ?? null;
}

export function upsertImageWorkbenchPreset(
  store: ImageWorkbenchPresetStore,
  name: string,
  config: unknown,
  presetId?: string,
): ImageWorkbenchPresetStore {
  const nextId = presetId ?? createPresetId();
  const nextPreset = createPreset(name.trim() || '未命名预设', config, nextId);

  return normalizePresetStore({
    activePresetId: nextId,
    presets: {
      ...store.presets,
      [nextId]: nextPreset,
    },
  });
}

export function removeImageWorkbenchPreset(store: ImageWorkbenchPresetStore, presetId: string): ImageWorkbenchPresetStore {
  const nextPresets = { ...store.presets };
  delete nextPresets[presetId];
  return normalizePresetStore(
    {
      activePresetId: store.activePresetId === presetId ? Object.keys(nextPresets)[0] : store.activePresetId,
      presets: nextPresets,
    },
    defaultImageWorkbenchConfig,
  );
}

export function setActiveImageWorkbenchPreset(store: ImageWorkbenchPresetStore, presetId: string): ImageWorkbenchPresetStore {
  return normalizePresetStore({
    ...store,
    activePresetId: store.presets[presetId] ? presetId : store.activePresetId,
  });
}

export function exportImageWorkbenchPresetStoreJson(store: unknown): string {
  return JSON.stringify(normalizePresetStore(store), null, 2);
}

export function importImageWorkbenchPresetStoreJson(raw: string): ImageWorkbenchPresetStore {
  return normalizePresetStore(JSON.parse(raw));
}
