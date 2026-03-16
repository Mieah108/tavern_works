# 酒馆助手 TavernHelper 支持的接口类型定义

> 本文档基于 `/@types/function/` 及 `/@types/iframe/` 目录下的类型定义文件，结合[官方文档](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/%E5%85%B3%E4%BA%8E%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B/%E4%BB%8B%E7%BB%8D.html)整理，涵盖所有主要可用接口。

---

## 目录

- [音频相关](#音频相关)
- [消息与聊天](#消息与聊天)
- [变量管理](#变量管理)
- [脚本与按钮](#脚本与按钮)
- [扩展管理](#扩展管理)
- [世界书与角色卡](#世界书与角色卡)
- [提示词与注入](#提示词与注入)
- [宏与正则](#宏与正则)
- [预设管理](#预设管理)
- [通用工具函数](#通用工具函数)
- [版本信息](#版本信息)
- [扩展 Util 工具库](#扩展-util-工具库)

---

## 音频相关

- `playAudio(type, audio)`：播放音频（背景音乐/音效）。
- `pauseAudio(type)`：暂停音频。
- `getAudioList(type)`：获取播放列表。
- `replaceAudioList(type, audio_list)`：替换播放列表。
- `insertAudioList(type, audio, index)`：插入音频到播放列表。
- `getAudioSettings()` / `setAudioSettings(settings)`：获取/设置音频设置。

## 消息与聊天

- `getChatMessages(range, option)`：获取聊天消息。
- `setChatMessages(messages)`：设置聊天消息。
- `createChatMessages(messages)`：创建新消息。
- `deleteChatMessages(ids)`：删除消息。
- `rotateChatMessages()`：轮换消息。
- `formatAsDisplayedMessage(text, option)`：格式化消息为显示用HTML。
- `retrieveDisplayedMessage(message_id)`：获取消息楼层的JQuery实例。
- `refreshOneMessage(message_id)`：刷新单个楼层显示。

## 变量管理

- `getVariables(option)`：获取变量表。
- `replaceVariables(option, variables)`：完全替换变量。
- `updateVariablesWith(option, patch)`：增量更新变量。
- `insertOrAssignVariables(option, variables)`：插入或赋值变量。
- `insertVariables(option, variables)`：插入变量。
- `deleteVariable(option, key)`：删除变量。

## 脚本与按钮

- `getAllEnabledScriptButtons()`：获取所有启用的脚本按钮。
- `getScriptTrees(option)`：获取脚本树结构。

## 扩展管理

- `isAdmin()`：是否为管理员。
- `getExtensionType(extension_id)`：获取扩展类型。
- `getExtensionInstallationInfo(extension_id)`：获取扩展安装信息。
- `isInstalledExtension(extension_id)`：是否已安装扩展。
- `installExtension(url, type)`：安装扩展。
- `uninstallExtension(extension_id)`：卸载扩展。
- `reinstallExtension(extension_id)`：重装扩展。
- `updateExtension(extension_id)`：更新扩展。

## 世界书与角色卡

- `getWorldbookNames()`：获取世界书名称列表。
- `getGlobalWorldbookNames()`：获取全局世界书。
- `rebindGlobalWorldbooks(worldbook_names)`：重新绑定全局世界书。
- `getCharWorldbookNames(character_name)`：获取角色卡绑定的世界书。
- `rebindCharWorldbooks(character_name, char_worldbooks)`：重新绑定角色卡世界书。
- `getChatWorldbookName(chat_name)`：获取聊天文件绑定的世界书。
- `rebindChatWorldbook(chat_name, worldbook_name)`：重新绑定聊天文件世界书。
- `createWorldbook(name)` / `deleteWorldbook(name)`：创建/删除世界书。
- `getCharacterNames()`：获取角色卡名称列表。
- `createCharacter(data)` / `deleteCharacter(name)`：创建/删除角色卡。
- `getCharacter(name)` / `replaceCharacter(name, data)`：获取/替换角色卡。

## 提示词与注入

- `injectPrompts(prompts, options)`：注入提示词。
- `uninjectPrompts(ids)`：移除注入的提示词。
- `generate(config)`：请求AI生成文本。
- `generateRaw(config)`：底层生成接口。

## 宏与正则

- `registerMacroLike(regex, replace)`：注册助手宏。
- `unregisterMacroLike(regex)`：取消注册助手宏。
- `formatAsTavernRegexedString(text, source, destination, option)`：应用酒馆正则。
- `getTavernRegexes()` / `replaceTavernRegexes()` / `updateTavernRegexesWith()`：管理正则。

## 预设管理

- `getPresetNames()` / `getLoadedPresetName()`：获取预设名/当前预设。
- `loadPreset(name)` / `createPreset(data)` / `deletePreset(name)`：加载/创建/删除预设。
- `getPreset(name)` / `replacePreset(name, data)` / `updatePresetWith(name, patch)`：获取/替换/更新预设。

## 通用工具函数

- `substitudeMacros(text)`：替换字符串中的酒馆宏。
- `getLastMessageId()`：获取最新楼层id。
- `errorCatched(fn)`：包装函数，自动捕获错误。
- `getMessageId(iframe_name)`：获取iframe所在楼层号。
- `triggerSlash(command)`：运行Slash命令。

## 版本信息

- `getTavernHelperVersion()`：获取酒馆助手版本号。
- `getTavernHelperExtensionId()`：获取酒馆助手扩展id。
- `getTavernVersion()`：获取酒馆版本号。

---

## 扩展 Util 工具库
>
> 本脚手架在 `util/` 文件夹下提供了一系列常用功能封装和业务辅助库。

### 常用基础函数 (common.ts)

- `assignInplace(destination, new_array)`：原地替换数组内容。
- `correctlyMerge(lhs, rhs)`：修复 `_.merge` 对数组的错误合并行为。
- `chunkBy(array, predicate)`：依据自定义断言函数分割数组区块。
- `regexFromString(input, replace_macros)`：将字符串转换为安全正则对象，可选支持宏替换。
- `uuidv4()`：生成随机 UUID v4。
- `checkMinimumVersion(expected, title)`：检查酒馆助手版本是否符合要求，否则弹窗报错。
- `prettifyErrorWithInput(error)`：美化 Zod 的校验报错输出。
- `parseString(content)`：高稳定解析字符串内容（智能兼通 YAML、JSON、JSON5），并抛出详尽的格式错误。

### 变量框架 MVU (mvu.ts)

- `defineMvuDataStore(schema, variable_option, additional_setup)`：定义并挂载基于 Pinia + Zod 的 MVU (MagVarUpdate) 数据 Store，自动将酒馆的 `stat_data` 变量与响应式数据绑定双向同步。

### 样式与脚本注入 (script.ts)

- `loadReadme(url)`：读取网络内容并替换当前脚本信息面板的内容。
- `teleportStyle(append_to)`：传输（克隆）主文档中的样式（`<style>` 标签）进目标元素（通常是 iframe），实现样式隔离或同步。
- `createScriptIdIframe()`：创建一个自带 `script_id` 且加载了 `srcdoc` 模板的安全 iframe 容器。
- `createScriptIdDiv()`：创建一个打上当前 `script_id` 的普通 div。
- `reloadOnChatChange()`：监听页面切换事件（聊天变更），自动刷新页面重启脚本沙箱环境。

### 流式界面与组件挂载 (streaming.ts)

- `mountStreamingMessages(creator, options)`：拦截、替换或重渲染楼层原生的纯文本为自定义流式 Vue 组件界面。（支持使用 `iframe` 作样式隔离，或用 `div` 作继承渲染）。
- `injectStreamingMessageContext()`：Vue 依赖注入使用，在自定义组件内获取原生的 `message_id`、`message` 内容及当前是否属于流式传输中 (`during_streaming`)。

---

## 说明

- 详细参数、返回值、用法请参考各 `.d.ts` 文件注释及[官方文档](https://n0vi028.github.io/JS-Slash-Runner-Doc/guide/%E5%85%B3%E4%BA%8E%E9%85%92%E9%A6%86%E5%8A%A9%E6%89%8B/%E4%BB%8B%E7%BB%8D.html)。
- 某些接口需特定上下文（如管理员、已选中角色卡等）。
- 具体类型定义详见 `/@types/function/` 和 `/@types/iframe/` 目录。

如需补充详细参数和类型定义，可进一步展开每个接口的注释内容。
