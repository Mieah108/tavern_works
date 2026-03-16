<template>
  <div class="tti-config-container">
    <div class="tabs">
      <div 
        class="tab" 
        :class="{ active: activeTab === 'api' }"
        @click="activeTab = 'api'"
      >
        <i class="fa-solid fa-server"></i> API 配置
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'gen' }"
        @click="activeTab = 'gen'"
      >
        <i class="fa-solid fa-sliders"></i> 生成参数
      </div>
      <div 
        class="tab" 
        :class="{ active: activeTab === 'prompt' }"
        @click="activeTab = 'prompt'"
      >
        <i class="fa-solid fa-pen-nib"></i> 提示词
      </div>
    </div>

    <div class="tab-content" v-if="activeTab === 'api'">
      <div class="form-group">
        <label>API 基础地址 (Endpoint URL)</label>
        <input type="text" v-model="config.apiUrl" placeholder="http://127.0.0.1:7860" />
      </div>
      <div class="form-group">
        <label>API 密钥 (如果需要)</label>
        <input type="password" v-model="config.apiKey" placeholder="sk-..." />
      </div>
      <div class="form-group">
        <label>模型 (Model Checkpoint)</label>
        <input type="text" v-model="config.model" placeholder="默认" />
      </div>
      <div class="form-group">
        <label>后端类型</label>
        <select v-model="config.backendType">
          <option value="sd-webui">Stable Diffusion WebUI</option>
          <option value="comfyui">ComfyUI</option>
          <option value="novelai">NovelAI / SwarmUI</option>
          <option value="dalle3">DALL-E 3</option>
        </select>
      </div>
    </div>

    <div class="tab-content" v-if="activeTab === 'gen'">
      <div class="form-group">
        <label>预设分辨率</label>
        <select v-model="presetResolution" @change="applyResolution">
          <option value="512x512">512 x 512 (正方形)</option>
          <option value="512x768">512 x 768 (竖图)</option>
          <option value="768x512">768 x 512 (横图)</option>
          <option value="1024x1024">1024 x 1024 (SDXL正方形)</option>
          <option value="832x1216">832 x 1216 (SDXL竖图)</option>
          <option value="1216x832">1216 x 832 (SDXL横图)</option>
          <option value="custom">自定义...</option>
        </select>
      </div>
      
      <div class="flex-row">
        <div class="form-group">
          <label>宽度 (Width)</label>
          <input type="number" v-model="config.width" min="64" max="4096" step="64" :disabled="presetResolution !== 'custom'"/>
        </div>
        <div class="form-group">
          <label>高度 (Height)</label>
          <input type="number" v-model="config.height" min="64" max="4096" step="64" :disabled="presetResolution !== 'custom'"/>
        </div>
      </div>

      <div class="form-group">
        <label>采样步数 (Steps): {{ config.steps }}</label>
        <input type="range" v-model="config.steps" min="1" max="100" step="1" />
      </div>

      <div class="form-group">
        <label>提示词引导系数 (CFG Scale): {{ config.cfgScale }}</label>
        <input type="range" v-model="config.cfgScale" min="1" max="30" step="0.5" />
      </div>
      
      <div class="form-group">
        <label>采样器 (Sampler)</label>
        <input type="text" v-model="config.sampler" placeholder="Euler a" />
      </div>
    </div>

    <div class="tab-content" v-if="activeTab === 'prompt'">
      <div class="form-group">
        <label>正面提示词前缀 (总是附加在前面)</label>
        <textarea v-model="config.promptPrefix" rows="3" placeholder="masterpiece, best quality, masterpiece, best quality, highres..."></textarea>
      </div>
      <div class="form-group">
        <label>正面提示词后缀 (总是附加在后面)</label>
        <textarea v-model="config.promptSuffix" rows="2" placeholder=""></textarea>
      </div>
      <div class="form-group">
        <label>负面提示词 (Negative Prompt)</label>
        <textarea v-model="config.negativePrompt" rows="4" placeholder="worst quality, low quality, normal quality, bad anatomy..."></textarea>
      </div>
    </div>

    <div class="footer">
      <button class="save-btn" @click="saveConfig"><i class="fa-solid fa-save"></i> 保存设置</button>
      <div class="save-status" v-if="saveStatus">{{ saveStatus }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';

const activeTab = ref('api');
const saveStatus = ref('');
const presetResolution = ref('512x768');

interface TtiConfig {
  apiUrl: string;
  apiKey: string;
  model: string;
  backendType: string;
  width: number;
  height: number;
  steps: number;
  cfgScale: number;
  sampler: string;
  promptPrefix: string;
  promptSuffix: string;
  negativePrompt: string;
}

const config = ref<TtiConfig>({
  apiUrl: 'http://127.0.0.1:7860',
  apiKey: '',
  model: '',
  backendType: 'sd-webui',
  width: 512,
  height: 768,
  steps: 20,
  cfgScale: 7.0,
  sampler: 'Euler a',
  promptPrefix: 'masterpiece, best quality, ultra-detailed, ',
  promptSuffix: '',
  negativePrompt: '(worst quality, low quality:1.4), bad anatomy, watermark, signature'
});

const STORAGE_KEY = 'ST_TTI_EXTENSION_CONFIG_V1';

const loadConfig = () => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      config.value = { ...config.value, ...parsed };
      matchResolutionToPreset();
    } catch(e) {
      console.error('Failed to load text-to-image config', e);
    }
  }
};

const saveConfig = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config.value));
  saveStatus.value = '保存成功!';
  setTimeout(() => saveStatus.value = '', 2000);
};

const matchResolutionToPreset = () => {
  const res = `${config.value.width}x${config.value.height}`;
  const common = ['512x512', '512x768', '768x512', '1024x1024', '832x1216', '1216x832'];
  if (common.includes(res)) {
    presetResolution.value = res;
  } else {
    presetResolution.value = 'custom';
  }
};

const applyResolution = () => {
  if (presetResolution.value !== 'custom') {
    const [w, h] = presetResolution.value.split('x').map(Number);
    config.value.width = w;
    config.value.height = h;
  }
};

onMounted(() => {
  loadConfig();
});

</script>

<style scoped>
.tti-config-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  box-sizing: border-box;
  padding: 10px;
  background: var(--SmartThemeBodyColor, #1a1a2e);
  color: var(--SmartThemeTextColor, #e0e0e0);
}

.tabs {
  display: flex;
  border-bottom: 2px solid var(--SmartThemeBorderColor, #4a4a6a);
  margin-bottom: 15px;
}

.tab {
  padding: 8px 15px;
  cursor: pointer;
  border-radius: 4px 4px 0 0;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  gap: 6px;
}

.tab:hover {
  background: rgba(255, 255, 255, 0.1);
}

.tab.active {
  background: var(--SmartThemeBlurTintColor, #2a2a40);
  border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
  border-bottom: none;
  margin-bottom: -2px;
  font-weight: bold;
}

.tab-content {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

.form-group {
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.flex-row {
  display: flex;
  gap: 15px;
}

.flex-row .form-group {
  flex: 1;
}

label {
  font-size: 13px;
  opacity: 0.9;
}

input[type="text"], 
input[type="password"], 
input[type="number"], 
select, 
textarea {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
  color: inherit;
  padding: 8px;
  border-radius: 4px;
  font-family: inherit;
  outline: none;
}

input:focus, select:focus, textarea:focus {
  border-color: var(--SmartThemeAccentColor, #007bff);
}

textarea {
  resize: vertical;
}

input[type="range"] {
  width: 100%;
}

.footer {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid var(--SmartThemeBorderColor, #4a4a6a);
  display: flex;
  align-items: center;
  gap: 15px;
}

.save-btn {
  background: var(--SmartThemeAccentColor, #007bff);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: bold;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: opacity 0.2s;
}

.save-btn:hover {
  opacity: 0.8;
}

.save-status {
  color: #4CAF50;
  font-weight: bold;
  font-size: 13px;
}
</style>
