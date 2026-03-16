<template>
  <div class="tti-shell">
    <aside class="tti-sidebar">
      <div class="tti-brand">
        <div class="tti-brand__icon">
          <i class="fa-solid fa-wand-magic-sparkles" aria-hidden="true"></i>
        </div>
        <div class="tti-brand__copy">
          <div class="tti-brand__eyebrow">SillyTavern Image Workbench</div>
          <h1>文生图配置工作台</h1>
        </div>
      </div>

      <nav class="tti-nav">
        <button
          v-for="item in navItems"
          :key="item.key"
          type="button"
          class="tti-nav__item"
          :class="{ active: activeSection === item.key }"
          @click="activeSection = item.key"
        >
          <i :class="item.icon" aria-hidden="true"></i>
          <div>
            <strong>{{ item.label }}</strong>
            <span>{{ item.desc }}</span>
          </div>
        </button>
      </nav>

      <div class="tti-summary-card">
        <span class="tti-summary-card__label">当前端点</span>
        <strong class="tti-summary-card__endpoint">{{ endpointLabel }}</strong>
        <span class="tti-summary-card__meta">{{ currentBackendLabel }}</span>
      </div>

      <div class="tti-summary-grid">
        <div class="tti-mini-stat">
          <span>分辨率</span>
          <strong>{{ config.width }} x {{ config.height }}</strong>
          <small>{{ aspectRatioLabel }} / {{ megapixelsLabel }}</small>
        </div>
        <div class="tti-mini-stat">
          <span>批量输出</span>
          <strong>{{ totalImageCount }} 张</strong>
          <small>{{ config.batchSize }} x {{ config.batchCount }}</small>
        </div>
        <div class="tti-mini-stat">
          <span>采样强度</span>
          <strong>{{ config.steps }} steps</strong>
          <small>CFG {{ config.cfgScale.toFixed(1) }}</small>
        </div>
        <div class="tti-mini-stat">
          <span>配置来源</span>
          <strong>{{ loadSourceLabel }}</strong>
          <small>{{ isDirty ? '存在未保存修改' : '已与存储同步' }}</small>
        </div>
      </div>

      <div class="tti-sidebar-note">
        <i class="fa-solid fa-circle-info" aria-hidden="true"></i>
        <p>宽高会自动对齐到 64 的倍数，便于后续直接对接 SD WebUI、Forge 或自定义生成接口。</p>
      </div>
    </aside>

    <main class="tti-main">
      <header class="tti-hero">
        <div class="tti-hero__copy">
          <div class="tti-badges">
            <span class="tti-badge accent">
              <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
              当前预设：{{ activePresetName }}
            </span>
            <span class="tti-badge" :class="isDirty ? 'warn' : 'ok'">
              <i :class="isDirty ? 'fa-solid fa-pen-to-square' : 'fa-solid fa-circle-check'" aria-hidden="true"></i>
              {{ isDirty ? '未保存更改' : '已保存' }}
            </span>
          </div>

          <h2>{{ currentSectionTitle }}</h2>
          <p>{{ currentSectionDescription }}</p>

          <div class="tti-preset-bar">
            <label class="tti-preset-picker">
              <span>配置预设</span>
              <select v-model="selectedPresetId" @change="switchPreset">
                <option v-for="preset in presetList" :key="preset.id" :value="preset.id">
                  {{ preset.name }}
                </option>
              </select>
            </label>

            <div class="tti-inline-actions">
              <button type="button" class="tti-btn ghost small" @click="saveConfig">
                <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
                覆盖当前
              </button>
              <button type="button" class="tti-btn ghost small" @click="saveAsPreset">
                <i class="fa-solid fa-bookmark" aria-hidden="true"></i>
                另存预设
              </button>
              <button type="button" class="tti-btn ghost small" :disabled="presetList.length <= 1" @click="deleteCurrentPreset">
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
                删除
              </button>
              <button type="button" class="tti-btn ghost small" @click="exportCurrentPreset">
                <i class="fa-solid fa-file-export" aria-hidden="true"></i>
                导出当前
              </button>
              <button type="button" class="tti-btn ghost small" @click="exportAllPresets">
                <i class="fa-solid fa-box-archive" aria-hidden="true"></i>
                导出全部
              </button>
              <button type="button" class="tti-btn ghost small" @click="importPresetJson">
                <i class="fa-solid fa-file-import" aria-hidden="true"></i>
                导入预设
              </button>
            </div>
          </div>
        </div>

        <div class="tti-actions">
          <button type="button" class="tti-btn ghost" @click="copyConfigJson">
            <i class="fa-solid fa-copy" aria-hidden="true"></i>
            复制当前配置
          </button>
          <button type="button" class="tti-btn ghost" @click="resetConfig">
            <i class="fa-solid fa-rotate-left" aria-hidden="true"></i>
            恢复默认
          </button>
          <button type="button" class="tti-btn primary" @click="saveConfig">
            <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i>
            保存配置
          </button>
        </div>
      </header>

      <div v-if="statusMessage" class="tti-status" :class="statusType">
        <i :class="statusIcon" aria-hidden="true"></i>
        <span>{{ statusMessage }}</span>
      </div>

      <section class="tti-main-scroll">
        <template v-if="activeSection === 'api'">
          <article class="tti-panel tti-panel--dense">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Backend</span>
                <h3>图形生成 API 配置</h3>
              </div>
              <p>点击预设可直接套用推荐地址、路径与认证方式。</p>
            </header>

            <div class="tti-option-grid backends">
              <button
                v-for="item in backendOptions"
                :key="item.value"
                type="button"
                class="tti-option-card"
                :class="{ active: config.backendType === item.value }"
                @click="applyBackendPreset(item.value)"
              >
                <i :class="item.icon" aria-hidden="true"></i>
                <strong>{{ item.label }}</strong>
                <span>{{ item.description }}</span>
              </button>
            </div>
          </article>

          <div class="tti-grid two-up tti-grid--api">
            <article class="tti-panel tti-panel--dense">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Connection</span>
                  <h3>连接与认证</h3>
                </div>
                <div class="tti-inline-actions">
                  <button type="button" class="tti-btn ghost small" :disabled="apiBusy" @click="testApiConnection">
                    <i class="fa-solid fa-plug-circle-bolt" aria-hidden="true"></i>
                    {{ apiAction === 'testing' ? '测试中...' : '测试连接' }}
                  </button>
                </div>
              </header>

              <div class="tti-form-grid two">
                <label class="tti-field tti-field--span-2">
                  <span>API 基础地址</span>
                  <input v-model="config.apiBaseUrl" type="text" placeholder="http://127.0.0.1:7860" />
                  <small>例如本地 WebUI、Forge 服务，或你自己的中间层地址。</small>
                </label>

                <label class="tti-field">
                  <span>生成接口路径</span>
                  <input v-model="config.apiPath" type="text" placeholder="/sdapi/v1/txt2img" />
                </label>

                <label class="tti-field">
                  <span>请求超时（秒）</span>
                  <input v-model.number="config.timeoutSeconds" type="number" min="5" max="600" />
                </label>

                <label class="tti-field">
                  <span>认证模式</span>
                  <select v-model="config.authType">
                    <option value="none">不使用认证</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="custom">自定义 Header</option>
                  </select>
                </label>

                <label class="tti-field" :class="{ muted: config.authType === 'none' }">
                  <span>Header 名称</span>
                  <input v-model="config.apiHeaderName" type="text" :disabled="config.authType === 'none'" />
                  <small>{{ config.authType === 'bearer' ? '一般保持为 Authorization。' : '例如 X-API-Key。' }}</small>
                </label>

                <label class="tti-field tti-field--span-2" :class="{ muted: config.authType === 'none' }">
                  <span>API 密钥 / Token</span>
                  <input
                    v-model="config.apiKey"
                    type="password"
                    :disabled="config.authType === 'none'"
                    placeholder="sk-*** / local-token"
                    autocomplete="off"
                  />
                </label>

                <div v-if="connectionTestMessage" class="tti-report tti-field--span-2" :class="connectionTestTone">
                  <i
                    :class="
                      connectionTestTone === 'ok'
                        ? 'fa-solid fa-circle-check'
                        : connectionTestTone === 'warn'
                          ? 'fa-solid fa-triangle-exclamation'
                          : 'fa-solid fa-circle-info'
                    "
                    aria-hidden="true"
                  ></i>
                  <span>{{ connectionTestMessage }}</span>
                </div>
              </div>
            </article>

            <article class="tti-panel tti-panel--dense">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Runtime</span>
                  <h3>模型列表与默认值</h3>
                </div>
                <div v-if="!isNovelAiBackend" class="tti-inline-actions">
                  <button type="button" class="tti-btn ghost small" :disabled="apiBusy" @click="fetchModelList">
                    <i class="fa-solid fa-arrows-rotate" aria-hidden="true"></i>
                    {{ apiAction === 'models' ? '获取中...' : '获取模型' }}
                  </button>
                </div>
              </header>

              <div class="tti-form-grid two">
                <label class="tti-field tti-field--span-2">
                  <span>模型名称 / Checkpoint</span>
                  <div class="tti-inline-field">
                    <input v-model="config.model" type="text" placeholder="例如：juggernautXL_v9 / animePastelDream" />
                    <select v-if="modelOptions.length" v-model="config.model" class="tti-inline-select">
                      <option v-for="modelName in modelOptions" :key="modelName" :value="modelName">
                        {{ getModelOptionLabel(modelName) }}
                      </option>
                    </select>
                  </div>
                  <small>
                    {{
                      isNovelAiBackend
                        ? `已内置 ${modelOptions.length} 个 NovelAI 官方图像模型，可直接选择。`
                        : modelOptions.length
                          ? `已获取 ${modelOptions.length} 个模型，可直接从下拉框选择。`
                          : '可手动输入，或点击“获取模型”读取后端模型列表。'
                    }}
                  </small>
                </label>

                <label class="tti-field">
                  <span>采样器</span>
                  <input v-model="config.sampler" type="text" placeholder="DPM++ 2M Karras" />
                </label>

                <label class="tti-field">
                  <span>调度器</span>
                  <input v-model="config.scheduler" type="text" placeholder="karras / normal" />
                </label>

                <label class="tti-field">
                  <span>CLIP Skip</span>
                  <input v-model.number="config.clipSkip" type="number" min="1" max="12" />
                </label>

                <div v-if="modelFetchMessage && !isNovelAiBackend" class="tti-report tti-field--span-2" :class="modelFetchTone">
                  <i
                    :class="
                      modelFetchTone === 'ok'
                        ? 'fa-solid fa-circle-check'
                        : modelFetchTone === 'warn'
                          ? 'fa-solid fa-triangle-exclamation'
                          : 'fa-solid fa-circle-info'
                    "
                    aria-hidden="true"
                  ></i>
                  <span>{{ modelFetchMessage }}</span>
                </div>

                <div class="tti-callout tti-field--span-2">
                  <i class="fa-solid fa-circle-nodes" aria-hidden="true"></i>
                  <div>
                    <strong>后续调用建议</strong>
                    <p>生成脚本直接从本配置读取 `backendType / apiPath / extraPayloadJson`，避免在多个功能里重复维护接口细节。</p>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </template>

        <template v-else-if="activeSection === 'generation'">
          <article class="tti-panel">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Resolution</span>
                <h3>分辨率与构图预设</h3>
              </div>
              <p>可以直接使用预设，也可以手动调整宽高。最终保存时会自动规范到 64 的倍数。</p>
            </header>

            <div class="tti-option-grid presets">
              <button
                v-for="preset in resolutionPresets"
                :key="preset.value"
                type="button"
                class="tti-option-card small"
                :class="{ active: resolutionPreset === preset.value }"
                @click="selectResolutionPreset(preset.value)"
              >
                <strong>{{ preset.label }}</strong>
                <span>{{ preset.note }}</span>
              </button>
            </div>

            <div class="tti-grid two-up">
              <div class="tti-panel tti-panel--subtle">
                <header class="tti-panel__header compact">
                  <div>
                    <span class="tti-kicker">Canvas</span>
                    <h3>画布参数</h3>
                  </div>
                </header>

                <div class="tti-form-grid two">
                  <label class="tti-field">
                    <span>宽度 Width</span>
                    <input v-model.number="config.width" type="number" min="256" max="2048" step="64" />
                  </label>

                  <label class="tti-field">
                    <span>高度 Height</span>
                    <input v-model.number="config.height" type="number" min="256" max="2048" step="64" />
                  </label>

                  <button type="button" class="tti-btn ghost tti-field--button" @click="swapResolution">
                    <i class="fa-solid fa-rotate" aria-hidden="true"></i>
                    横竖互换
                  </button>

                  <div class="tti-highlight">
                    <span>输出摘要</span>
                    <strong>{{ aspectRatioLabel }}</strong>
                    <small>{{ megapixelsLabel }} / {{ totalImageCount }} 张</small>
                  </div>
                </div>
              </div>

              <div class="tti-panel tti-panel--subtle">
                <header class="tti-panel__header compact">
                  <div>
                    <span class="tti-kicker">Sampling</span>
                    <h3>核心采样参数</h3>
                  </div>
                </header>

                <div class="tti-form-grid two">
                  <label class="tti-slider">
                    <span>采样步数 Steps</span>
                    <div>
                      <input v-model.number="config.steps" type="range" min="1" max="150" step="1" />
                      <strong>{{ config.steps }}</strong>
                    </div>
                  </label>

                  <label class="tti-slider">
                    <span>CFG Scale</span>
                    <div>
                      <input v-model.number="config.cfgScale" type="range" min="1" max="30" step="0.5" />
                      <strong>{{ config.cfgScale.toFixed(1) }}</strong>
                    </div>
                  </label>

                  <label class="tti-field">
                    <span>Denoise Strength</span>
                    <input v-model.number="config.denoiseStrength" type="number" min="0" max="1" step="0.05" />
                  </label>

                  <label class="tti-field">
                    <span>Seed（-1 随机）</span>
                    <input v-model.number="config.seed" type="number" />
                  </label>

                  <label class="tti-field">
                    <span>Batch Size</span>
                    <input v-model.number="config.batchSize" type="number" min="1" max="8" />
                  </label>

                  <label class="tti-field">
                    <span>Batch Count</span>
                    <input v-model.number="config.batchCount" type="number" min="1" max="12" />
                  </label>
                </div>
              </div>
            </div>
          </article>

          <article class="tti-panel">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Upscale</span>
                <h3>高清修复与二段采样</h3>
              </div>
              <p>适合作为角色大图或 CG 精修的默认参数模板。</p>
            </header>

            <div class="tti-form-grid two">
              <label class="tti-toggle tti-field--span-2">
                <input v-model="config.enableHiresFix" type="checkbox" />
                <div>
                  <strong>启用 Hires Fix</strong>
                  <span>开启后会使用额外的放大倍率和二次采样步数。</span>
                </div>
              </label>

              <label class="tti-field" :class="{ muted: !config.enableHiresFix }">
                <span>放大倍率</span>
                <input v-model.number="config.hiresScale" type="number" min="1" max="3" step="0.05" :disabled="!config.enableHiresFix" />
              </label>

              <label class="tti-field" :class="{ muted: !config.enableHiresFix }">
                <span>二次采样步数</span>
                <input v-model.number="config.hiresSteps" type="number" min="0" max="80" :disabled="!config.enableHiresFix" />
              </label>

              <label class="tti-field tti-field--span-2" :class="{ muted: !config.enableHiresFix }">
                <span>放大器 / Upscaler</span>
                <input v-model="config.upscaler" type="text" :disabled="!config.enableHiresFix" placeholder="Latent / ESRGAN / 4x-UltraSharp" />
              </label>
            </div>
          </article>
        </template>

        <template v-else-if="activeSection === 'prompt'">
          <article class="tti-panel">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Prompt</span>
                <h3>风格预设与提示词拼装</h3>
              </div>
              <p>前缀、后缀与负向词将作为全局模板，后续功能只需要填入当次场景词即可。</p>
            </header>

            <div class="tti-option-grid styles">
              <button
                v-for="preset in stylePresets"
                :key="preset.value"
                type="button"
                class="tti-option-card"
                :class="{ active: config.stylePreset === preset.value }"
                @click="config.stylePreset = preset.value"
              >
                <i :class="preset.icon" aria-hidden="true"></i>
                <strong>{{ preset.label }}</strong>
                <span>{{ preset.promptHint }}</span>
              </button>
            </div>
          </article>

          <div class="tti-grid two-up">
            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Positive</span>
                  <h3>正向提示词模板</h3>
                </div>
              </header>

              <div class="tti-form-grid one">
                <label class="tti-field">
                  <span>前缀 Prefix</span>
                  <textarea
                    v-model="config.promptPrefix"
                    rows="6"
                    placeholder="masterpiece, best quality, rim light, detailed fabric..."
                  ></textarea>
                  <small>永远拼接在最前面，适合写质量词、风格词与固定镜头语言。</small>
                </label>

                <label class="tti-field">
                  <span>后缀 Suffix</span>
                  <textarea
                    v-model="config.promptSuffix"
                    rows="4"
                    placeholder="sharp focus, volumetric lighting, clean linework"
                  ></textarea>
                  <small>永远拼接在后面，适合补充材质、镜头或气氛收束词。</small>
                </label>
              </div>
            </article>

            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Negative</span>
                  <h3>负向词与自动增强</h3>
                </div>
              </header>

              <div class="tti-form-grid one">
                <label class="tti-field">
                  <span>Negative Prompt</span>
                  <textarea
                    v-model="config.negativePrompt"
                    rows="7"
                    placeholder="lowres, deformed hand, text, watermark, blurry"
                  ></textarea>
                </label>

                <label class="tti-toggle">
                  <input v-model="config.enableTranslationHint" type="checkbox" />
                  <div>
                    <strong>中文提示词自动补英文增强提示</strong>
                    <span>后续脚本可利用这个开关决定是否自动做提示词增强。</span>
                  </div>
                </label>

                <label class="tti-toggle">
                  <input v-model="config.autoInjectCharacterName" type="checkbox" />
                  <div>
                    <strong>自动注入角色名</strong>
                    <span>适合后续与当前角色卡绑定时，在提示词里自动带入角色身份。</span>
                  </div>
                </label>

                <label class="tti-toggle">
                  <input v-model="config.appendSceneContext" type="checkbox" />
                  <div>
                    <strong>自动追加场景上下文</strong>
                    <span>为后续接聊天上下文或场景摘要预留开关。</span>
                  </div>
                </label>
              </div>
            </article>
          </div>
        </template>

        <template v-else-if="activeSection === 'cache'">
          <div class="tti-grid two-up">
            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Runtime</span>
                  <h3>消息内插图运行期</h3>
                </div>
              </header>

              <div class="tti-form-grid one">
                <label class="tti-toggle">
                  <input v-model="config.runtimeEnabled" type="checkbox" />
                  <div>
                    <strong>启用消息内插图运行期</strong>
                    <span>关闭后不再监听 `image###...###`，也不会把已保存插图注入到消息显示层。</span>
                  </div>
                </label>

                <div class="tti-callout">
                  <i class="fa-solid fa-file-image" aria-hidden="true"></i>
                  <div>
                    <strong>单脚本内嵌存储</strong>
                    <p>生成成功后，图片会直接以 `data URL` 写入对应消息的 `extra.tti_image_workbench.slots`，因此同一聊天在其他浏览器打开时仍能恢复显示。</p>
                  </div>
                </div>
              </div>
            </article>

            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Storage</span>
                  <h3>存储说明</h3>
                </div>
              </header>

              <div class="tti-form-grid two">
                <div class="tti-highlight">
                  <span>请求发起方</span>
                  <strong>浏览器</strong>
                  <small>不是 SillyTavern 服务器。浏览器会直接向你配置的图像 API 发起请求。</small>
                </div>

                <div class="tti-highlight">
                  <span>持久化位置</span>
                  <strong>聊天文件</strong>
                  <small>图片跟随消息一并保存，不依赖额外插件或服务端文件缓存。</small>
                </div>

                <div class="tti-report tti-field--span-2 info">
                  <i class="fa-solid fa-triangle-exclamation" aria-hidden="true"></i>
                  <span>因为现在是浏览器直连模式，目标 API 必须允许当前页面访问。若目标服务没有开启 CORS 或需要服务器侧代理，浏览器会直接报跨域或连通性错误。</span>
                </div>
              </div>
            </article>
          </div>
        </template>

        <template v-else-if="activeSection === 'advanced'">
          <div class="tti-grid two-up">
            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Transport</span>
                  <h3>请求控制</h3>
                </div>
              </header>

              <div class="tti-form-grid two">
                <label class="tti-field">
                  <span>失败重试次数</span>
                  <input v-model.number="config.retryCount" type="number" min="1" max="3" />
                </label>

                <label class="tti-field">
                  <span>重试间隔（毫秒）</span>
                  <input v-model.number="config.retryIntervalMs" type="number" min="200" max="10000" step="100" />
                </label>

                <label class="tti-field">
                  <span>请求冷却（毫秒）</span>
                  <input v-model.number="config.requestCooldownMs" type="number" min="0" max="60000" step="100" />
                </label>

                <label class="tti-field">
                  <span>响应图像字段路径</span>
                  <input v-model="config.responseImageField" type="text" placeholder="images / data[0].b64_json" />
                  <small>为后续统一从响应体中取图提供字段路径。</small>
                </label>
              </div>
            </article>

            <article class="tti-panel">
              <header class="tti-panel__header compact">
                <div>
                  <span class="tti-kicker">Persistence</span>
                  <h3>结果存储策略</h3>
                </div>
              </header>

              <div class="tti-form-grid one">
                <label class="tti-toggle">
                  <input v-model="config.saveToMessageVariable" type="checkbox" />
                  <div>
                    <strong>保存最近结果到消息变量</strong>
                    <span>后续真正生成图片时，可把请求摘要与最近输出落到变量中。</span>
                  </div>
                </label>

                <label class="tti-field">
                  <span>最近结果保留数量</span>
                  <input v-model.number="config.keepLastResultCount" type="number" min="1" max="50" />
                </label>
              </div>
            </article>
          </div>

          <article class="tti-panel">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Extensions</span>
                <h3>自定义请求扩展</h3>
              </div>
              <p>用于保存额外 Header 和额外 payload 字段，之后真实 API 请求时可以直接合并。</p>
            </header>

            <div class="tti-grid two-up">
              <label class="tti-field">
                <span>额外 Headers JSON</span>
                <textarea v-model="config.extraHeadersJson" rows="7" placeholder='{"X-API-Key":"demo"}'></textarea>
                <small :class="{ error: !extraHeadersState.valid }">
                  {{ extraHeadersState.valid ? '必须是 JSON 对象。' : extraHeadersState.message }}
                </small>
              </label>

              <label class="tti-field">
                <span>额外 Payload JSON</span>
                <textarea
                  v-model="config.extraPayloadJson"
                  rows="7"
                  placeholder='{"override_settings":{"CLIP_stop_at_last_layers":2}}'
                ></textarea>
                <small :class="{ error: !extraPayloadState.valid }">
                  {{ extraPayloadState.valid ? '会在后续请求体中并入。' : extraPayloadState.message }}
                </small>
              </label>
            </div>
          </article>

          <article class="tti-panel">
            <header class="tti-panel__header">
              <div>
                <span class="tti-kicker">Preview</span>
                <h3>配置预览</h3>
              </div>
              <p>这是后续真正调用 API 时会参考的摘要结构。</p>
            </header>

            <pre class="tti-preview">{{ requestPreview }}</pre>
          </article>
        </template>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import {
  backendOptions,
  defaultImageWorkbenchConfig,
  exportImageWorkbenchConfigJson,
  exportImageWorkbenchPresetStoreJson,
  getActiveImageWorkbenchPreset,
  importImageWorkbenchConfigJson,
  importImageWorkbenchPresetStoreJson,
  loadImageWorkbenchPresetStore,
  removeImageWorkbenchPreset,
  resolutionPresets,
  saveImageWorkbenchConfig,
  saveImageWorkbenchPresetStore,
  setActiveImageWorkbenchPreset,
  stylePresets,
  upsertImageWorkbenchPreset,
  type BackendType,
  type ConfigSectionKey,
  type ImageWorkbenchConfig,
  type ImageWorkbenchPreset,
  type ImageWorkbenchPresetStore,
} from './config';

const navItems: Array<{ key: ConfigSectionKey; label: string; desc: string; icon: string }> = [
  { key: 'api', label: 'API 接入', desc: '后端与认证', icon: 'fa-solid fa-server' },
  { key: 'generation', label: '生成参数', desc: '尺寸与采样', icon: 'fa-solid fa-expand' },
  { key: 'prompt', label: '提示词策略', desc: '风格与模板', icon: 'fa-solid fa-feather-pointed' },
  { key: 'cache', label: '存储方式', desc: '消息内嵌与运行期', icon: 'fa-solid fa-database' },
  { key: 'advanced', label: '高级配置', desc: '扩展字段与预览', icon: 'fa-solid fa-gears' },
];

type ResolutionPresetValue = (typeof resolutionPresets)[number]['value'];
type StatusTone = 'info' | 'ok' | 'warn';

type JsonFieldState = {
  valid: boolean;
  message: string;
  value: Record<string, unknown>;
};

type ApiAction = 'idle' | 'testing' | 'models';

type BackendPreset = {
  apiBaseUrl: string;
  apiPath: string;
  authType: ImageWorkbenchConfig['authType'];
  apiHeaderName: string;
};

const backendPresets: Record<BackendType, BackendPreset> = {
  'sd-webui': {
    apiBaseUrl: 'http://127.0.0.1:7860',
    apiPath: '/sdapi/v1/txt2img',
    authType: 'none',
    apiHeaderName: 'Authorization',
  },
  'sd-forge': {
    apiBaseUrl: 'http://127.0.0.1:7860',
    apiPath: '/sdapi/v1/txt2img',
    authType: 'none',
    apiHeaderName: 'Authorization',
  },
  comfyui: {
    apiBaseUrl: 'http://127.0.0.1:8188',
    apiPath: '/prompt',
    authType: 'none',
    apiHeaderName: 'Authorization',
  },
  novelai: {
    apiBaseUrl: 'https://image.novelai.net',
    apiPath: '/ai/generate-image',
    authType: 'bearer',
    apiHeaderName: 'Authorization',
  },
  custom: {
    apiBaseUrl: 'http://127.0.0.1:7860',
    apiPath: '/sdapi/v1/txt2img',
    authType: 'none',
    apiHeaderName: 'Authorization',
  },
};

const NOVELAI_STATIC_MODELS = [
  { value: 'nai-diffusion-4-5-full', label: 'Anime v4.5 Full' },
  { value: 'nai-diffusion-4-5-curated', label: 'Anime v4.5 Curated' },
  { value: 'nai-diffusion-4-full', label: 'Anime v4 Full' },
  { value: 'nai-diffusion-4-curated-preview', label: 'Anime v4 Curated' },
  { value: 'nai-diffusion-3', label: 'Anime v3' },
  { value: 'nai-diffusion-furry-3', label: 'Furry v3' },
] as const;

const novelAiModelLabelMap = Object.fromEntries(NOVELAI_STATIC_MODELS.map(item => [item.value, item.label])) as Record<string, string>;

const activeSection = ref<ConfigSectionKey>('api');
const config = ref<ImageWorkbenchConfig>({ ...defaultImageWorkbenchConfig });
const presetStore = ref<ImageWorkbenchPresetStore>(loadImageWorkbenchPresetStore().store);
const selectedPresetId = ref('default');
const resolutionPreset = ref<ResolutionPresetValue>('custom');
const statusMessage = ref('');
const statusType = ref<StatusTone>('info');
const loadSourceLabel = ref('默认值');
const lastSavedFingerprint = ref(exportImageWorkbenchConfigJson(defaultImageWorkbenchConfig));
const apiAction = ref<ApiAction>('idle');
const connectionTestMessage = ref('');
const connectionTestTone = ref<StatusTone>('info');
const modelFetchMessage = ref('');
const modelFetchTone = ref<StatusTone>('info');
const modelOptions = ref<string[]>([]);

const totalImageCount = computed(() => config.value.batchSize * config.value.batchCount);
const apiBusy = computed(() => apiAction.value !== 'idle');
const isNovelAiBackend = computed(() => config.value.backendType === 'novelai');
const presetList = computed(() =>
  Object.values(presetStore.value.presets).sort((a, b) => {
    if (a.id === 'default') return -1;
    if (b.id === 'default') return 1;
    return b.updatedAt - a.updatedAt;
  }),
);
const activePreset = computed(() => getActiveImageWorkbenchPreset(presetStore.value));
const activePresetName = computed(() => activePreset.value?.name ?? '默认配置');

const currentSectionTitle = computed(() => navItems.find(item => item.key === activeSection.value)?.label ?? '配置');
const currentSectionDescription = computed(
  () => navItems.find(item => item.key === activeSection.value)?.desc ?? '管理文生图工作台的默认行为。',
);

const currentBackendLabel = computed(
  () => backendOptions.find(item => item.value === config.value.backendType)?.label ?? '自定义 API',
);

const endpointLabel = computed(() => `${config.value.apiBaseUrl}${config.value.apiPath}`);

const megapixelsLabel = computed(() => `${((config.value.width * config.value.height) / 1000000).toFixed(2)} MP`);

const aspectRatioLabel = computed(() => {
  const divisor = gcd(config.value.width, config.value.height);
  return `${config.value.width / divisor}:${config.value.height / divisor}`;
});

const isDirty = computed(() => exportImageWorkbenchConfigJson(config.value) !== lastSavedFingerprint.value);

const statusIcon = computed(() => {
  if (statusType.value === 'ok') return 'fa-solid fa-circle-check';
  if (statusType.value === 'warn') return 'fa-solid fa-triangle-exclamation';
  return 'fa-solid fa-circle-info';
});

const extraHeadersState = computed(() => parseJsonObject(config.value.extraHeadersJson));
const extraPayloadState = computed(() => parseJsonObject(config.value.extraPayloadJson));

const requestPreview = computed(() => {
  const authSummary =
    config.value.authType === 'none'
      ? 'none'
      : config.value.authType === 'bearer'
        ? `Bearer ${config.value.apiKey ? '***' : '(empty)'}`
        : `${config.value.apiHeaderName}: ${config.value.apiKey ? '***' : '(empty)'}`;

  return JSON.stringify(
    {
      backend: config.value.backendType,
      endpoint: endpointLabel.value,
      auth: authSummary,
      timeout_seconds: config.value.timeoutSeconds,
      defaults: {
        model: config.value.model || '(follow backend default)',
        sampler: config.value.sampler,
        scheduler: config.value.scheduler,
        clip_skip: config.value.clipSkip,
        resolution: `${config.value.width}x${config.value.height}`,
        steps: config.value.steps,
        cfg_scale: config.value.cfgScale,
        denoise_strength: config.value.denoiseStrength,
        seed: config.value.seed,
        batch_size: config.value.batchSize,
        batch_count: config.value.batchCount,
      },
      prompt_strategy: {
        style_preset: config.value.stylePreset,
        prefix: config.value.promptPrefix,
        suffix: config.value.promptSuffix,
        negative_prompt: config.value.negativePrompt,
        enable_translation_hint: config.value.enableTranslationHint,
        auto_inject_character_name: config.value.autoInjectCharacterName,
        append_scene_context: config.value.appendSceneContext,
      },
      hires_fix: config.value.enableHiresFix
        ? {
            scale: config.value.hiresScale,
            steps: config.value.hiresSteps,
            upscaler: config.value.upscaler,
          }
        : false,
      request_control: {
        runtime_enabled: config.value.runtimeEnabled,
        request_origin: 'browser',
        image_storage: 'message_extra_embedded',
        retry_count: config.value.retryCount,
        retry_interval_ms: config.value.retryIntervalMs,
        request_cooldown_ms: config.value.requestCooldownMs,
      },
      persistence: {
        save_to_message_variable: config.value.saveToMessageVariable,
        keep_last_result_count: config.value.keepLastResultCount,
        response_image_field: config.value.responseImageField,
      },
      extra_headers: extraHeadersState.value.valid ? extraHeadersState.value.value : { _error: extraHeadersState.value.message },
      extra_payload: extraPayloadState.value.valid ? extraPayloadState.value.value : { _error: extraPayloadState.value.message },
    },
    null,
    2,
  );
});

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function parseJsonObject(input: string): JsonFieldState {
  if (!input.trim()) {
    return {
      valid: true,
      message: '空字符串会按空对象处理。',
      value: {},
    };
  }

  try {
    const parsed = JSON.parse(input) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return {
        valid: false,
        message: '必须是 JSON 对象，例如 {"key":"value"}。',
        value: {},
      };
    }

    return {
      valid: true,
      message: '格式正确。',
      value: parsed as Record<string, unknown>,
    };
  } catch {
    return {
      valid: false,
      message: 'JSON 解析失败，请检查引号和逗号。',
      value: {},
    };
  }
}

function normalizeUrl(baseUrl: string, path = ''): string {
  const normalizedBase = baseUrl.trim().replace(/\/+$/, '');
  if (!path) return normalizedBase;
  if (/^https?:\/\//i.test(path)) return path;
  return `${normalizedBase}/${path.replace(/^\/+/, '')}`;
}

function getModelOptionLabel(modelName: string): string {
  return isNovelAiBackend.value ? novelAiModelLabelMap[modelName] ?? modelName : modelName;
}

function getAuthHeaders(): Record<string, string> {
  if (config.value.authType === 'none' || !config.value.apiKey.trim()) {
    return {};
  }

  if (config.value.authType === 'bearer') {
    return {
      Authorization: `Bearer ${config.value.apiKey.trim()}`,
    };
  }

  return {
    [config.value.apiHeaderName.trim() || 'Authorization']: config.value.apiKey.trim(),
  };
}

function formatRequestError(status: number, data: unknown, fallback: string): string {
  if (typeof data === 'string' && data.trim()) {
    return `[${status}] ${data.trim()}`;
  }

  if (data && typeof data === 'object') {
    const message =
      _.get(data, 'detail.message') ??
      _.get(data, 'detail') ??
      _.get(data, 'message') ??
      _.get(data, 'error.message') ??
      _.get(data, 'error') ??
      _.get(data, 'msg');

    if (typeof message === 'string' && message.trim()) {
      return `[${status}] ${message.trim()}`;
    }
  }

  return `[${status}] ${fallback}`;
}

function normalizeBrowserFetchError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : fallback;
  if (message === 'Failed to fetch' || /failed to fetch/i.test(message)) {
    return '浏览器请求被拦截或目标不可达。请检查目标地址、网络连通性以及该接口是否允许当前页面跨域访问（CORS）。';
  }
  return message;
}

async function requestJson(url: string, init: RequestInit = {}): Promise<unknown> {
  const controller = new AbortController();
  const timeout = window.setTimeout(controller.abort.bind(controller), config.value.timeoutSeconds * 1000);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain, */*',
        ...getAuthHeaders(),
        ...(init.headers ?? {}),
      },
    });

    const text = await response.text();
    let parsed: unknown = text;

    try {
      parsed = text ? (JSON.parse(text) as unknown) : {};
    } catch {
      parsed = text;
    }

    if (!response.ok) {
      throw new Error(formatRequestError(response.status, parsed, response.statusText || '请求失败'));
    }

    return parsed;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('请求超时，请检查服务是否可达。');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

function applyBackendPreset(backend: BackendType): void {
  const preset = backendPresets[backend];
  config.value.backendType = backend;
  config.value.apiBaseUrl = preset.apiBaseUrl;
  config.value.apiPath = preset.apiPath;
  config.value.authType = preset.authType;
  config.value.apiHeaderName = preset.apiHeaderName;
  modelOptions.value = backend === 'novelai' ? NOVELAI_STATIC_MODELS.map(item => item.value) : [];
  if (backend === 'novelai' && !config.value.model) {
    config.value.model = NOVELAI_STATIC_MODELS[0].value;
  }
  connectionTestMessage.value = '';
  modelFetchMessage.value = '';
  showStatus(`已套用 ${backendOptions.find(item => item.value === backend)?.label ?? backend} 预设。`, 'info');
}

function syncBackendPresetOptions(): void {
  if (config.value.backendType === 'novelai') {
    modelOptions.value = NOVELAI_STATIC_MODELS.map(item => item.value);
    if (!config.value.model) {
      config.value.model = NOVELAI_STATIC_MODELS[0].value;
    }
  } else if (config.value.backendType !== 'custom') {
    modelOptions.value = [];
  }
}

async function testApiConnection(): Promise<void> {
  apiAction.value = 'testing';
  connectionTestMessage.value = '';

  try {
    let url = '';
    let init: RequestInit = { method: 'GET' };
    let successMessage = '';

    if (config.value.backendType === 'sd-webui' || config.value.backendType === 'sd-forge') {
      url = normalizeUrl(config.value.apiBaseUrl, '/sdapi/v1/options');
      successMessage = `连接成功：${url}`;
    } else if (config.value.backendType === 'comfyui') {
      url = normalizeUrl(config.value.apiBaseUrl, '/system_stats');
      successMessage = `连接成功：${url}`;
    } else if (config.value.backendType === 'novelai') {
      url = normalizeUrl(config.value.apiBaseUrl || 'https://image.novelai.net', '/docs/index.html');
      init = { method: 'GET' };
    } else {
      url = normalizeUrl(config.value.apiBaseUrl, config.value.apiPath || '/');
      init = { method: 'OPTIONS' };
      successMessage = `连接成功：${url}`;
    }

    await requestJson(url, init);
    connectionTestTone.value = 'ok';

    if (config.value.backendType === 'novelai') {
      successMessage = config.value.apiKey.trim()
        ? 'NovelAI 图像服务入口可达，且已填写 Token。由于当前是浏览器直连模式，这里只检测图像服务域名可达性；Token 有效性会在首次实际生成时进一步验证。'
        : 'NovelAI 图像服务入口可达，但当前还没有填写 Token。请填入 API Key 后再进行实际生成。';
    }

    connectionTestMessage.value = successMessage;
    showStatus(
      config.value.backendType === 'novelai' ? 'NovelAI 图像服务入口检测通过。' : 'API 连通性测试通过。',
      'ok',
    );
  } catch (error) {
    const message = normalizeBrowserFetchError(error, '测试失败，请检查地址、认证或跨域限制。');
    connectionTestTone.value = 'warn';
    connectionTestMessage.value = message;
    showStatus('API 连通性测试失败。', 'warn');
  } finally {
    apiAction.value = 'idle';
  }
}

async function fetchModelList(): Promise<void> {
  if (config.value.backendType === 'novelai') {
    modelOptions.value = NOVELAI_STATIC_MODELS.map(item => item.value);
    modelFetchMessage.value = '';
    if (!config.value.model) {
      config.value.model = NOVELAI_STATIC_MODELS[0].value;
    }
    return;
  }

  apiAction.value = 'models';
  modelFetchMessage.value = '';

  try {
    let models: string[] = [];

    if (config.value.backendType === 'sd-webui' || config.value.backendType === 'sd-forge') {
      const data = (await requestJson(normalizeUrl(config.value.apiBaseUrl, '/sdapi/v1/sd-models'))) as unknown[];
      models = (Array.isArray(data) ? data : [])
        .map(item => {
          if (!item || typeof item !== 'object') return '';
          return String(_.get(item, 'title') ?? _.get(item, 'model_name') ?? _.get(item, 'name') ?? '');
        })
        .filter(Boolean);
    } else if (config.value.backendType === 'comfyui') {
      const data = await requestJson(normalizeUrl(config.value.apiBaseUrl, '/object_info/CheckpointLoaderSimple'));
      const comfyModels = _.get(data, 'CheckpointLoaderSimple.input.required.ckpt_name.0');
      models = (Array.isArray(comfyModels) ? comfyModels : []).map(item => String(item)).filter(Boolean);
    } else {
      throw new Error('当前自定义 API 未定义统一的模型列表接口，请手动输入模型名。');
    }

    modelOptions.value = _.uniq(models);
    if (modelOptions.value.length > 0 && !config.value.model) {
      config.value.model = modelOptions.value[0];
    }

    modelFetchTone.value = modelOptions.value.length > 0 ? 'ok' : 'warn';
    modelFetchMessage.value =
      modelOptions.value.length > 0
        ? `已读取 ${modelOptions.value.length} 个模型。`
        : '后端返回成功，但没有可用模型列表。';
    showStatus(modelFetchMessage.value, modelOptions.value.length > 0 ? 'ok' : 'warn');
  } catch (error) {
    const message = normalizeBrowserFetchError(error, '模型列表读取失败。');
    modelOptions.value = [];
    modelFetchTone.value = 'warn';
    modelFetchMessage.value = message;
    showStatus('获取模型列表失败。', 'warn');
  } finally {
    apiAction.value = 'idle';
  }
}

function showStatus(message: string, tone: StatusTone = 'info'): void {
  statusMessage.value = message;
  statusType.value = tone;

  window.setTimeout(() => {
    if (statusMessage.value === message) {
      statusMessage.value = '';
    }
  }, 2800);
}

function syncResolutionPreset(): void {
  const key = `${config.value.width}x${config.value.height}`;
  const matched = resolutionPresets.find(item => item.value === key);
  resolutionPreset.value = matched ? matched.value : 'custom';
}

function selectResolutionPreset(value: ResolutionPresetValue): void {
  resolutionPreset.value = value;
  if (value === 'custom') return;

  const [width, height] = value.split('x').map(Number);
  config.value.width = width;
  config.value.height = height;
}

function swapResolution(): void {
  const nextWidth = config.value.height;
  config.value.height = config.value.width;
  config.value.width = nextWidth;
  syncResolutionPreset();
}

function loadConfig(): void {
  const { store, source } = loadImageWorkbenchPresetStore();
  presetStore.value = store;
  selectedPresetId.value = store.activePresetId;

  const loaded = getActiveImageWorkbenchPreset(store)?.config ?? defaultImageWorkbenchConfig;
  config.value = { ...loaded };
  syncBackendPresetOptions();
  syncResolutionPreset();
  lastSavedFingerprint.value = exportImageWorkbenchConfigJson(loaded);

  loadSourceLabel.value =
    source === 'script' ? '脚本变量' : source === 'local' ? '本地回退' : '默认值';

  showStatus(
    source === 'script'
      ? '已从脚本变量读取文生图配置。'
      : source === 'local'
        ? '脚本变量为空，已从本地缓存恢复配置。'
        : '当前使用默认配置模板。',
    source === 'default' ? 'info' : 'ok',
  );
}

async function saveConfig(): Promise<void> {
  const result = saveImageWorkbenchConfig(config.value);
  config.value = { ...result.config };
  const persistedStore = loadImageWorkbenchPresetStore().store;
  presetStore.value = persistedStore;
  selectedPresetId.value = persistedStore.activePresetId;
  syncResolutionPreset();
  syncBackendPresetOptions();
  lastSavedFingerprint.value = exportImageWorkbenchConfigJson(result.config);

  if (result.savedToScript && result.savedToLocal) {
    loadSourceLabel.value = '脚本变量';
    showStatus('保存成功，已写入脚本变量和本地回退缓存。', 'ok');
    return;
  }

  if (result.savedToScript) {
    loadSourceLabel.value = '脚本变量';
    showStatus('已写入脚本变量，但本地回退缓存写入失败。', 'warn');
    return;
  }

  if (result.savedToLocal) {
    loadSourceLabel.value = '本地回退';
    showStatus('脚本变量写入失败，仅保存到本地回退缓存。', 'warn');
    return;
  }

  showStatus('保存失败，脚本变量和本地缓存都未写入。', 'warn');
}

function switchPreset(): void {
  const nextStore = setActiveImageWorkbenchPreset(presetStore.value, selectedPresetId.value);
  const persisted = saveImageWorkbenchPresetStore(nextStore);
  presetStore.value = persisted.store;
  selectedPresetId.value = persisted.store.activePresetId;

  const preset = getActiveImageWorkbenchPreset(persisted.store);
  if (!preset) return;

  config.value = { ...preset.config };
  syncBackendPresetOptions();
  syncResolutionPreset();
  lastSavedFingerprint.value = exportImageWorkbenchConfigJson(preset.config);
  showStatus(`已切换到预设“${preset.name}”。`, 'ok');
}

function saveAsPreset(): void {
  const suggested = `${activePresetName.value}-副本`;
  const name = prompt('请输入新预设名称：', suggested)?.trim();
  if (!name) return;

  const nextStore = upsertImageWorkbenchPreset(presetStore.value, name, config.value);
  const persisted = saveImageWorkbenchPresetStore(nextStore);
  presetStore.value = persisted.store;
  selectedPresetId.value = persisted.store.activePresetId;
  lastSavedFingerprint.value = exportImageWorkbenchConfigJson(config.value);
  showStatus(`已创建预设“${name}”。`, 'ok');
}

function deleteCurrentPreset(): void {
  const preset = activePreset.value;
  if (!preset || presetList.value.length <= 1) return;

  const confirmed = confirm(`确定删除预设“${preset.name}”吗？`);
  if (!confirmed) return;

  const nextStore = removeImageWorkbenchPreset(presetStore.value, preset.id);
  const persisted = saveImageWorkbenchPresetStore(nextStore);
  presetStore.value = persisted.store;
  selectedPresetId.value = persisted.store.activePresetId;

  const nextPreset = getActiveImageWorkbenchPreset(persisted.store);
  config.value = { ...(nextPreset?.config ?? defaultImageWorkbenchConfig) };
  syncBackendPresetOptions();
  syncResolutionPreset();
  lastSavedFingerprint.value = exportImageWorkbenchConfigJson(config.value);
  showStatus(`已删除预设“${preset.name}”。`, 'ok');
}

async function exportCurrentPreset(): Promise<void> {
  const preset = activePreset.value;
  if (!preset) return;

  try {
    await navigator.clipboard.writeText(JSON.stringify(preset, null, 2));
    showStatus(`预设“${preset.name}”已复制到剪贴板。`, 'ok');
  } catch {
    showStatus('导出失败，当前环境不支持剪贴板写入。', 'warn');
  }
}

async function exportAllPresets(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportImageWorkbenchPresetStoreJson(presetStore.value));
    showStatus('全部预设已复制到剪贴板。', 'ok');
  } catch {
    showStatus('导出失败，当前环境不支持剪贴板写入。', 'warn');
  }
}

function importPresetJson(): void {
  const incoming = prompt('请粘贴预设 JSON 或预设集合 JSON：');
  if (!incoming) return;

  try {
    const parsed = JSON.parse(incoming) as Record<string, unknown>;

    if (_.has(parsed, 'presets')) {
      const persisted = saveImageWorkbenchPresetStore(importImageWorkbenchPresetStoreJson(incoming));
      presetStore.value = persisted.store;
      selectedPresetId.value = persisted.store.activePresetId;
      const preset = getActiveImageWorkbenchPreset(persisted.store);
      config.value = { ...(preset?.config ?? defaultImageWorkbenchConfig) };
      syncBackendPresetOptions();
      syncResolutionPreset();
      lastSavedFingerprint.value = exportImageWorkbenchConfigJson(config.value);
      showStatus('预设集合导入成功。', 'ok');
      return;
    }

    if (_.has(parsed, 'config') && _.has(parsed, 'name')) {
      const preset = parsed as unknown as ImageWorkbenchPreset;
      const nextStore = upsertImageWorkbenchPreset(presetStore.value, preset.name, preset.config, preset.id);
      const persisted = saveImageWorkbenchPresetStore(nextStore);
      presetStore.value = persisted.store;
      selectedPresetId.value = persisted.store.activePresetId;
      const active = getActiveImageWorkbenchPreset(persisted.store);
      config.value = { ...(active?.config ?? defaultImageWorkbenchConfig) };
      syncBackendPresetOptions();
      syncResolutionPreset();
      lastSavedFingerprint.value = exportImageWorkbenchConfigJson(config.value);
      showStatus(`预设“${preset.name}”导入成功。`, 'ok');
      return;
    }

    const name = prompt('检测到这是单份配置 JSON，请输入要保存成的预设名称：', '导入配置')?.trim();
    if (!name) return;
    const nextConfig = importImageWorkbenchConfigJson(incoming, config.value);
    const nextStore = upsertImageWorkbenchPreset(presetStore.value, name, nextConfig);
    const persisted = saveImageWorkbenchPresetStore(nextStore);
    presetStore.value = persisted.store;
    selectedPresetId.value = persisted.store.activePresetId;
    config.value = { ...nextConfig };
    syncBackendPresetOptions();
    syncResolutionPreset();
    lastSavedFingerprint.value = exportImageWorkbenchConfigJson(nextConfig);
    showStatus(`配置已作为预设“${name}”导入。`, 'ok');
  } catch {
    showStatus('导入失败，JSON 格式不正确。', 'warn');
  }
}

function resetConfig(): void {
  config.value = { ...defaultImageWorkbenchConfig };
  syncResolutionPreset();
  syncBackendPresetOptions();
  showStatus('已恢复默认模板，当前变更尚未保存。', 'info');
}

async function copyConfigJson(): Promise<void> {
  try {
    await navigator.clipboard.writeText(exportImageWorkbenchConfigJson(config.value));
    showStatus('配置 JSON 已复制到剪贴板。', 'ok');
  } catch {
    showStatus('当前环境不支持剪贴板写入。', 'warn');
  }
}

watch(
  () => [config.value.width, config.value.height],
  () => syncResolutionPreset(),
);

watch(
  () => config.value.backendType,
  () => syncBackendPresetOptions(),
);

onMounted(() => {
  loadConfig();
});
</script>

<style scoped>
.tti-shell {
  --tti-bg: #09111a;
  --tti-surface: rgba(11, 22, 34, 0.88);
  --tti-surface-strong: rgba(16, 30, 45, 0.96);
  --tti-surface-soft: rgba(255, 255, 255, 0.04);
  --tti-border: rgba(255, 255, 255, 0.1);
  --tti-border-strong: rgba(111, 179, 255, 0.28);
  --tti-text: #edf5ff;
  --tti-muted: #8da6ba;
  --tti-accent: #72b6ff;
  --tti-accent-2: #67f0cf;
  --tti-warn: #ffb86b;
  --tti-ok: #7fe7a7;
  --tti-danger: #ff8c8c;

  width: 100%;
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-columns: 280px minmax(0, 1fr);
  overflow: hidden;
  color: var(--tti-text);
  background:
    radial-gradient(circle at 10% 0%, rgba(114, 182, 255, 0.16), transparent 34%),
    radial-gradient(circle at 100% 0%, rgba(103, 240, 207, 0.12), transparent 28%),
    linear-gradient(180deg, #081018 0%, #0b121b 100%);
  font-family:
    'Segoe UI',
    'PingFang SC',
    'Hiragino Sans GB',
    'Microsoft YaHei',
    sans-serif;
}

.tti-sidebar {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  padding: 18px 16px;
  border-right: 1px solid var(--tti-border);
  background: linear-gradient(180deg, rgba(8, 18, 29, 0.94), rgba(10, 18, 28, 0.88));
  scrollbar-gutter: stable;
}

.tti-brand {
  display: grid;
  grid-template-columns: 48px 1fr;
  gap: 12px;
  padding: 12px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.03));
  border: 1px solid rgba(114, 182, 255, 0.18);
}

.tti-brand__icon {
  width: 48px;
  height: 48px;
  display: grid;
  place-items: center;
  border-radius: 14px;
  background: linear-gradient(155deg, rgba(114, 182, 255, 0.9), rgba(103, 240, 207, 0.86));
  color: #04131f;
  font-size: 18px;
  box-shadow: 0 14px 24px rgba(59, 124, 196, 0.22);
}

.tti-brand__eyebrow {
  margin-bottom: 6px;
  color: #7ecfff;
  font-size: 11px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.tti-brand h1 {
  margin: 0;
  font-size: 18px;
  line-height: 1.2;
}

.tti-brand p {
  margin: 6px 0 0;
  color: var(--tti-muted);
  font-size: 12px;
  line-height: 1.55;
}

.tti-nav {
  display: grid;
  gap: 10px;
}

.tti-nav__item {
  display: grid;
  grid-template-columns: 18px 1fr;
  gap: 10px;
  align-items: start;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.tti-nav__item:hover,
.tti-nav__item.active {
  transform: translateY(-1px);
  border-color: rgba(114, 182, 255, 0.32);
  background: linear-gradient(180deg, rgba(114, 182, 255, 0.14), rgba(255, 255, 255, 0.04));
}

.tti-nav__item i {
  padding-top: 2px;
  color: #7ecfff;
}

.tti-nav__item strong {
  display: block;
  font-size: 14px;
}

.tti-nav__item span {
  display: block;
  margin-top: 4px;
  color: var(--tti-muted);
  font-size: 12px;
}

.tti-summary-card,
.tti-mini-stat,
.tti-sidebar-note {
  border-radius: 16px;
  border: 1px solid var(--tti-border);
  background: rgba(255, 255, 255, 0.03);
}

.tti-summary-card {
  display: grid;
  gap: 6px;
  padding: 14px;
}

.tti-summary-card__endpoint {
  min-width: 0;
  overflow-wrap: anywhere;
  word-break: break-word;
  font-size: 13px;
  line-height: 1.45;
}

.tti-summary-card__label {
  color: var(--tti-muted);
  font-size: 12px;
}

.tti-summary-card__meta {
  color: #8ae8cf;
  font-size: 12px;
}

.tti-summary-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.tti-mini-stat {
  display: grid;
  gap: 4px;
  padding: 12px;
}

.tti-mini-stat span,
.tti-mini-stat small {
  color: var(--tti-muted);
  font-size: 12px;
}

.tti-mini-stat strong {
  font-size: 15px;
}

.tti-sidebar-note {
  display: grid;
  grid-template-columns: 16px 1fr;
  gap: 10px;
  padding: 14px;
  margin-top: auto;
}

.tti-sidebar-note i {
  padding-top: 2px;
  color: #8ae8cf;
}

.tti-sidebar-note p {
  margin: 0;
  color: var(--tti-muted);
  font-size: 12px;
  line-height: 1.6;
}

.tti-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.tti-hero {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  padding: 22px 24px 18px;
  border-bottom: 1px solid var(--tti-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.03), transparent),
    radial-gradient(circle at top right, rgba(114, 182, 255, 0.1), transparent 40%);
}

.tti-hero__copy h2 {
  margin: 10px 0 6px;
  font-size: 28px;
  line-height: 1.15;
}

.tti-hero__copy p {
  margin: 0;
  color: var(--tti-muted);
  font-size: 14px;
}

.tti-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tti-badge {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: var(--tti-muted);
  font-size: 12px;
}

.tti-badge.accent {
  color: #bde2ff;
  border-color: rgba(114, 182, 255, 0.28);
}

.tti-badge.ok {
  color: var(--tti-ok);
  border-color: rgba(127, 231, 167, 0.24);
}

.tti-badge.warn {
  color: var(--tti-warn);
  border-color: rgba(255, 184, 107, 0.24);
}

.tti-preset-bar {
  display: grid;
  gap: 10px;
  margin-top: 14px;
}

.tti-preset-picker {
  display: grid;
  gap: 6px;
  max-width: 360px;
}

.tti-preset-picker span {
  color: var(--tti-muted);
  font-size: 12px;
  font-weight: 600;
}

.tti-preset-picker select {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--tti-text);
  padding: 10px 12px;
}

.tti-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  align-content: flex-start;
  gap: 10px;
  max-width: 260px;
}

.tti-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 42px;
  padding: 0 14px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.tti-btn:hover {
  transform: translateY(-1px);
  border-color: rgba(114, 182, 255, 0.28);
}

.tti-btn.primary {
  border-color: rgba(103, 240, 207, 0.26);
  background: linear-gradient(135deg, rgba(114, 182, 255, 0.2), rgba(103, 240, 207, 0.16));
}

.tti-btn.ghost {
  background: rgba(255, 255, 255, 0.03);
}

.tti-status {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 24px 0;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.04);
  font-size: 13px;
}

.tti-status.ok {
  color: var(--tti-ok);
  border-color: rgba(127, 231, 167, 0.24);
}

.tti-status.warn {
  color: var(--tti-warn);
  border-color: rgba(255, 184, 107, 0.24);
}

.tti-status.info {
  color: #cfe5ff;
  border-color: rgba(114, 182, 255, 0.2);
}

.tti-main-scroll {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: 18px 24px 24px;
  display: grid;
  gap: 16px;
  align-content: start;
}

.tti-grid.two-up {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
}

.tti-panel {
  display: grid;
  gap: 16px;
  padding: 18px;
  min-width: 0;
  border-radius: 20px;
  border: 1px solid var(--tti-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.035), rgba(255, 255, 255, 0.02)),
    rgba(8, 15, 24, 0.85);
  box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
}

.tti-panel--dense {
  gap: 12px;
  padding: 14px 16px;
}

.tti-panel--subtle {
  background: rgba(255, 255, 255, 0.025);
}

.tti-panel__header {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.tti-panel__header.compact {
  align-items: center;
}

.tti-panel__header h3 {
  margin: 4px 0 0;
  font-size: 20px;
}

.tti-panel__header p {
  margin: 0;
  max-width: 380px;
  color: var(--tti-muted);
  font-size: 13px;
  line-height: 1.6;
}

.tti-kicker {
  color: #7ecfff;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.tti-option-grid {
  display: grid;
  gap: 12px;
}

.tti-option-grid.backends {
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

.tti-option-grid.presets {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.tti-option-grid.styles {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.tti-option-card {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    transform 0.18s ease,
    border-color 0.18s ease,
    background 0.18s ease;
}

.tti-option-card.small {
  min-height: 88px;
}

.tti-option-card:hover,
.tti-option-card.active {
  transform: translateY(-1px);
  border-color: var(--tti-border-strong);
  background: linear-gradient(180deg, rgba(114, 182, 255, 0.14), rgba(255, 255, 255, 0.03));
}

.tti-option-card i {
  color: #8ae8cf;
}

.tti-option-card strong {
  font-size: 14px;
}

.tti-option-card span {
  color: var(--tti-muted);
  font-size: 12px;
  line-height: 1.6;
}

.tti-grid--api {
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
}

.tti-form-grid {
  display: grid;
  gap: 14px;
}

.tti-form-grid.one {
  grid-template-columns: minmax(0, 1fr);
}

.tti-form-grid.two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.tti-field,
.tti-slider,
.tti-toggle {
  display: grid;
  gap: 8px;
}

.tti-field--span-2 {
  grid-column: 1 / -1;
}

.tti-field span,
.tti-slider span {
  font-size: 13px;
  font-weight: 600;
}

.tti-field small,
.tti-callout p,
.tti-highlight small {
  color: var(--tti-muted);
  font-size: 12px;
  line-height: 1.5;
}

.tti-field small.error {
  color: var(--tti-danger);
}

.tti-field input,
.tti-field select,
.tti-field textarea {
  width: 100%;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.04);
  color: var(--tti-text);
  padding: 11px 12px;
  outline: none;
  transition:
    border-color 0.18s ease,
    background 0.18s ease;
}

.tti-field textarea {
  resize: vertical;
  min-height: 120px;
}

.tti-field input:focus,
.tti-field select:focus,
.tti-field textarea:focus {
  border-color: rgba(114, 182, 255, 0.34);
  background: rgba(255, 255, 255, 0.06);
}

.tti-field.muted {
  opacity: 0.58;
}

.tti-field--button {
  align-self: end;
}

.tti-inline-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.tti-btn.small {
  height: 36px;
  padding: 0 12px;
  border-radius: 10px;
  font-size: 12px;
}

.tti-inline-field {
  display: grid;
  gap: 8px;
}

.tti-inline-select {
  font-size: 13px;
}

.tti-report {
  display: grid;
  grid-template-columns: 16px 1fr;
  align-items: start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
  font-size: 12px;
  line-height: 1.6;
}

.tti-report.ok {
  color: var(--tti-ok);
  border-color: rgba(127, 231, 167, 0.22);
}

.tti-report.warn {
  color: var(--tti-warn);
  border-color: rgba(255, 184, 107, 0.22);
}

.tti-report.info {
  color: #cfe5ff;
  border-color: rgba(114, 182, 255, 0.22);
}

.tti-slider {
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.tti-slider > div {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
}

.tti-slider input[type='range'] {
  width: 100%;
}

.tti-toggle {
  grid-template-columns: 18px 1fr;
  align-items: start;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 14px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(255, 255, 255, 0.03);
}

.tti-toggle input {
  margin-top: 3px;
}

.tti-toggle strong {
  display: block;
  font-size: 14px;
}

.tti-toggle span {
  display: block;
  margin-top: 4px;
  color: var(--tti-muted);
  font-size: 12px;
  line-height: 1.6;
}

.tti-callout,
.tti-highlight {
  display: grid;
  gap: 6px;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: linear-gradient(180deg, rgba(114, 182, 255, 0.1), rgba(255, 255, 255, 0.03));
}

.tti-callout {
  grid-template-columns: 18px 1fr;
  align-items: start;
}

.tti-callout i,
.tti-highlight span {
  color: #8ae8cf;
}

.tti-highlight strong {
  font-size: 18px;
}

.tti-preview {
  margin: 0;
  border-radius: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(5, 10, 16, 0.88);
  color: #d5e8ff;
  padding: 16px;
  overflow: auto;
  font-size: 12px;
  line-height: 1.7;
}

@media (max-width: 1280px) {
  .tti-shell {
    grid-template-columns: 260px minmax(0, 1fr);
  }

  .tti-option-grid.backends,
  .tti-option-grid.presets {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tti-option-grid.styles {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .tti-grid--api {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 980px) {
  .tti-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .tti-sidebar {
    border-right: 0;
    border-bottom: 1px solid var(--tti-border);
  }

  .tti-summary-grid,
  .tti-grid.two-up,
  .tti-form-grid.two {
    grid-template-columns: minmax(0, 1fr);
  }

  .tti-hero {
    flex-direction: column;
  }

  .tti-actions {
    justify-content: flex-start;
    max-width: none;
  }

  .tti-preset-picker {
    max-width: none;
  }
}

@media (max-width: 640px) {
  .tti-sidebar,
  .tti-main-scroll,
  .tti-hero {
    padding-left: 16px;
    padding-right: 16px;
  }

  .tti-brand {
    grid-template-columns: 48px 1fr;
  }

  .tti-brand__icon {
    width: 48px;
    height: 48px;
    border-radius: 14px;
  }

  .tti-option-grid.backends,
  .tti-option-grid.presets,
  .tti-option-grid.styles,
  .tti-summary-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .tti-inline-actions {
    justify-content: flex-start;
  }
}
</style>
