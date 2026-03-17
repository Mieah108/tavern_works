import type { ImageWorkbenchConfig } from '../config';

export type ImagePromptSlotSource = 'body' | 'reasoning-only' | 'persisted-only';
export type MessageImageRecoverySlotSource = 'body' | 'reasoning-only';
export type ImageSlotStatus = 'idle' | 'generating' | 'success' | 'error';

export interface ImagePromptSlot {
  slotId: string;
  slotKey: string;
  legacySlotId?: string;
  source: ImagePromptSlotSource;
  persistedSource?: MessageImageRecoverySlotSource;
  index: number;
  prompt: string;
  summary: string;
  rawMatch?: string;
  placeholderToken?: string;
  recoveredFromStorage?: boolean;
}

export interface ParsedImagePromptMessage {
  bodyTemplate: string;
  bodySlots: ImagePromptSlot[];
  reasoningOnlySlots: ImagePromptSlot[];
  persistedOnlySlots: ImagePromptSlot[];
  allSlots: ImagePromptSlot[];
  slotById: Map<string, ImagePromptSlot>;
}

export interface ImageSlotRenderState {
  status: ImageSlotStatus;
  expanded: boolean;
  showPrompt: boolean;
  imageUrl: string;
  error: string;
  cacheHit: boolean;
  updatedAt: number | null;
}

export interface MessageImageSlotState {
  imageUrl: string;
  prompt: string;
  updatedAt: number;
  slotKey?: string;
  legacySlotId?: string;
  source?: MessageImageRecoverySlotSource;
  originalPrompt?: string;
  mimeType?: string;
  byteLength?: number;
  storage?: 'embedded';
}

export interface MessageImageStore {
  version: number;
  slots: Record<string, MessageImageSlotState>;
}

export interface MessageImageRecoveryEntry {
  slotKey: string;
  legacySlotId?: string;
  source: MessageImageRecoverySlotSource;
  originalPrompt: string;
  finalPrompt: string;
  summary: string;
  updatedAt: number;
  storage?: 'embedded';
}

export interface MessageImageRecoveryStore {
  version: number;
  slots: Record<string, MessageImageRecoveryEntry>;
  recentResults: MessageImageRecoveryEntry[];
}

export interface GenerateImageRequest {
  messageId: number;
  slotId: string;
  originalPrompt: string;
  finalPrompt: string;
  negativePrompt: string;
  contextHint: string;
  forceRegenerate: boolean;
  config: ImageWorkbenchConfig;
}

export interface GenerateImageResult {
  cacheHit: boolean;
  imageUrl: string;
  mimeType: string;
  durationMs: number;
  byteLength?: number;
  finalPrompt: string;
  negativePrompt: string;
}
