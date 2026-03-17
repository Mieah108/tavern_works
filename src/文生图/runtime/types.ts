import type { ImageWorkbenchConfig } from '../config';

export type ImagePromptSlotSource = 'body' | 'reasoning-only';
export type ImageSlotStatus = 'idle' | 'generating' | 'success' | 'error';

export interface ImagePromptSlot {
  slotId: string;
  source: ImagePromptSlotSource;
  index: number;
  prompt: string;
  summary: string;
  rawMatch?: string;
  placeholderToken?: string;
}

export interface ParsedImagePromptMessage {
  bodyTemplate: string;
  bodySlots: ImagePromptSlot[];
  reasoningOnlySlots: ImagePromptSlot[];
  allSlots: ImagePromptSlot[];
  slotById: Map<string, ImagePromptSlot>;
}

export interface ImageSlotRenderState {
  status: ImageSlotStatus;
  expanded: boolean;
  imageUrl: string;
  error: string;
  cacheHit: boolean;
  updatedAt: number | null;
}

export interface MessageImageSlotState {
  imageUrl: string;
  prompt: string;
  updatedAt: number;
  mimeType?: string;
  byteLength?: number;
  storage?: 'embedded';
}

export interface MessageImageStore {
  version: number;
  slots: Record<string, MessageImageSlotState>;
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
