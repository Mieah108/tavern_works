import $ from 'jquery';
import App from './App.vue';
import { FloatingWindowManager } from './FloatingWindow';

/**
 * 插件的入口：文生图 (Text-to-Image) 扩展
 * 该文件会在插件加载时执行
 */
export async function initTtiExtension() {
  console.log('[文生图扩展] 初始化开始...');
  
  // 等待SillyTavern DOM就绪后再注入按钮
  const checkInterval = setInterval(() => {
    // 寻找扩展菜单容器，或者直接添加到底部控制栏/左侧面板等
    // SillyTavern的扩展菜单通常用 id='extensionsMenu' 或其他容器
    const $extensionsMenu = $('#extensionsMenu');
    
    if ($extensionsMenu.length > 0 || $('#top-bar').length > 0) {
      clearInterval(checkInterval);
      injectExtensionButton();
    }
  }, 1000);
}

function injectExtensionButton() {
  // 防止重复注入
  if ($('#tti-extension-btn').length > 0) return;

  // 这是注入在扩展菜单的通用做法
  const $btn = $('<div>')
    .attr('id', 'tti-extension-btn')
    .addClass('extension-menu-item')
    .css({
      'display': 'flex',
      'align-items': 'center',
      'gap': '10px',
      'padding': '10px',
      'cursor': 'pointer',
      'border-radius': '4px',
      'user-select': 'none'
    })
    .html('<i class="fa-solid fa-image" style="width:20px;text-align:center;"></i> 文生图配置')
    .hover(
      function() { $(this).css('background', 'rgba(255,255,255,0.1)'); },
      function() { $(this).css('background', 'transparent'); }
    )
    .on('click', openConfigWindow);

  // 根据当前SillyTavern的UI结构尝试插入
  if ($('#extensionsMenu').length > 0) {
    $('#extensionsMenu').append($btn);
  } else if ($('#left-nav').length > 0) {
    $('#left-nav').append($btn);
  } else {
    // 作为一个普通的悬浮按钮备用兜底
    $btn.css({
        'position':'fixed',
        'bottom':'10px',
        'left':'10px',
        'background':'rgba(0,0,0,0.5)',
        'z-index': 9999
    }).appendTo('body');
  }
}

function openConfigWindow() {
  const wm = FloatingWindowManager.getInstance();
  
  wm.createWindow({
    id: 'tti-config-window',
    title: '文生图参数配置 (Text-to-Image)',
    width: 600,
    height: 550,
  }, App);
}

// 自动执行初始化
initTtiExtension();
