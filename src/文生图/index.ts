import $ from 'jquery';
import App from './App.vue';
import { FloatingWindowManager } from './FloatingWindow';

const SCRIPT_ID = 'tti-image-workbench';
const WINDOW_ID = 'tti-image-workbench-config-window';
const MENU_CONTAINER_ID = `${SCRIPT_ID}-extensions-menu-container`;
const MENU_ITEM_ID = `${SCRIPT_ID}-menu-item`;
const MENU_EVENT_NAMESPACE = `.${SCRIPT_ID}`;
const MENU_RETRY_DELAY_MS = 1600;
const MENU_ENTRY_ATTR = 'data-tti-image-workbench-menu';

const LEGACY_MENU_IDS = [
  MENU_CONTAINER_ID,
  MENU_ITEM_ID,
  'tti-config-window',
  'tti-image-workbench-extensions-menu-container',
  'tti-image-workbench-menu-item',
];

function getTopWindow(): Window {
  return window.parent && window.parent !== window ? window.parent : window;
}

function getParentDocument(): Document {
  return getTopWindow().document;
}

function getJQueryRef(): JQueryStatic {
  const topWin = getTopWindow() as unknown as { jQuery?: JQueryStatic };
  const localWin = window as unknown as { jQuery?: JQueryStatic };
  return (topWin.jQuery ?? localWin.jQuery ?? $) as JQueryStatic;
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

function openConfigWindow(): void {
  FloatingWindowManager.getInstance().createWindow(
    {
      id: WINDOW_ID,
      title: '文生图配置工作台',
      iconClass: 'fa-solid fa-wand-magic-sparkles',
      width: 1220,
      height: 860,
      minWidth: 900,
      minHeight: 620,
      rememberState: true,
      resizable: true,
      maximizable: true,
    },
    App,
  );
}

function cleanupLegacyUiArtifacts(): void {
  const jq = getJQueryRef();
  const parentDoc = getParentDocument();

  LEGACY_MENU_IDS.forEach(id => {
    jq(`#${id}`, parentDoc).off(MENU_EVENT_NAMESPACE).remove();
  });

  jq(`[${MENU_ENTRY_ATTR}="true"]`, parentDoc).off(MENU_EVENT_NAMESPACE).remove();
  jq(`[data-tti-window-id="${WINDOW_ID}"]`, parentDoc).remove();

  try {
    replaceScriptButtons([]);
  } catch {
    // Ignore button cleanup failures in environments without script button support.
  }
}

async function onMenuEntryClick($extensionsMenu: JQuery<HTMLElement>, parentDoc: Document): Promise<void> {
  const jq = getJQueryRef();
  const $menuButton = jq('#extensionsMenuButton', parentDoc);

  if ($menuButton.length > 0 && $extensionsMenu.is(':visible')) {
    $menuButton.trigger('click');
    await delay(140);
  }

  openConfigWindow();
}

function bindMenuItemClick($menuItem: JQuery<HTMLElement>, $extensionsMenu: JQuery<HTMLElement>, parentDoc: Document): void {
  $menuItem.off(`click${MENU_EVENT_NAMESPACE}`).on(`click${MENU_EVENT_NAMESPACE}`, async event => {
    event.stopPropagation();
    await onMenuEntryClick($extensionsMenu, parentDoc);
  });
}

function ensureMenuItem(): boolean {
  const jq = getJQueryRef();
  const parentDoc = getParentDocument();
  const $extensionsMenu = jq('#extensionsMenu', parentDoc);

  if ($extensionsMenu.length === 0) {
    return false;
  }

  cleanupLegacyUiArtifacts();

  const $container = jq(
    `<div class="extension_container interactable" id="${MENU_CONTAINER_ID}" tabindex="0" ${MENU_ENTRY_ATTR}="true"></div>`,
  );
  const $menuItem = jq(
    `<div class="list-group-item flex-container flexGap5 interactable" id="${MENU_ITEM_ID}" ${MENU_ENTRY_ATTR}="true" title="打开文生图配置工作台">
      <div class="fa-fw fa-solid fa-wand-magic-sparkles extensionsMenuExtensionButton"></div>
      <span>文生图配置工作台</span>
    </div>`,
  );

  bindMenuItemClick($menuItem as JQuery<HTMLElement>, $extensionsMenu as JQuery<HTMLElement>, parentDoc);
  $container.append($menuItem);
  $extensionsMenu.append($container);
  return true;
}

function cleanupRuntime(): void {
  FloatingWindowManager.getInstance().destroyAll();
  cleanupLegacyUiArtifacts();
}

function initTtiExtension(): void {
  if (!ensureMenuItem()) {
    window.setTimeout(initTtiExtension, MENU_RETRY_DELAY_MS);
    return;
  }

  console.info('[文生图] 已注入独立配置工作台入口。');
}

$(() => {
  cleanupLegacyUiArtifacts();
  initTtiExtension();
  $(window).on('pagehide', cleanupRuntime);
});

