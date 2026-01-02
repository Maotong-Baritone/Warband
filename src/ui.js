import { events } from './eventBus.js';
import { BaseUI } from './ui/BaseUI.js';
import { MapRenderer } from './ui/MapRenderer.js';
import { ShopRenderer } from './ui/ShopRenderer.js';
import { RewardRenderer } from './ui/RewardRenderer.js';
import { MenuRenderer } from './ui/MenuRenderer.js';
import { BattleRenderer } from './ui/BattleRenderer.js';

// js/ui.js - 门面模式 (Facade)
// 修复：使用箭头函数包裹，防止 this 上下文丢失

export const UI = {
    // --- 代理: 场景与通用 ---
    switchScene: (id) => BaseUI.switchScene(id),
    toast: (msg) => BaseUI.toast(msg),
    floatText: (txt, targetId, col) => BaseUI.floatText(txt, targetId, col),
    spawnVFX: (type, targetId) => BaseUI.spawnVFX(type, targetId),
    shake: () => BaseUI.shake(),
    playSound: (path) => BaseUI.playSound(path),
    playBGM: (path) => BaseUI.playBGM(path),
    stopBGM: () => BaseUI.stopBGM(),
    showDeckModal: (list, title, cb) => BaseUI.showDeckModal(list, title, cb),
    closeDeckModal: () => BaseUI.closeDeckModal(),
    
    // --- 代理: 菜单与奖励 ---
    renderCharSelect: (id, cb) => MenuRenderer.renderCharSelect(id, cb),
    renderRewards: (mode) => RewardRenderer.renderRewards(mode),
    renderUpgradeRewards: (gold) => RewardRenderer.renderUpgradeRewards(gold),

    // --- 代理: 地图与商店 ---
    renderMap: (graph, pos) => MapRenderer.render(graph, pos),
    renderShop: (data) => ShopRenderer.render(data),

    // --- 代理: 战斗核心 ---
    setBattleBackground: (type) => BattleRenderer.setBattleBackground(type),
    renderBattleField: () => BattleRenderer.renderBattleField(),
    renderEnemies: () => BattleRenderer.renderEnemies(),
    highlightUnit: (idx, active) => BattleRenderer.highlightUnit(idx, active),
    log: (msg, type) => BattleRenderer.log(msg, type),
    clearLog: () => BattleRenderer.clearLog(),
    spawnManaParticle: (id, count) => BattleRenderer.spawnManaParticle(id, count),
    animateCardPlay: (data) => BattleRenderer.animateCardPlay(data),
    
    initArrow: () => BattleRenderer.initArrow(),
    
    // --- 总更新循环 ---
    update() {
        // 1. 全局 HUD
        BaseUI.updateHeader();
        
        // 2. 战斗 UI (仅在战斗场景时更新)
        const battleScene = document.getElementById('scene-battle');
        if (battleScene && battleScene.classList.contains('active')) {
            BattleRenderer.update();
        }
    }
};

// --- 事件监听 ---
events.on('highlight-unit', ({ idx, active }) => UI.highlightUnit(idx, active));
events.on('render-battlefield', () => UI.renderBattleField());
events.on('clear-log', () => UI.clearLog());
events.on('log', ({ msg, type }) => UI.log(msg, type));
events.on('toast', (msg) => UI.toast(msg));
events.on('float-text', ({ text, targetId, color }) => UI.floatText(text, targetId, color));
events.on('play-sound', (path) => UI.playSound(path));
events.on('spawn-vfx', ({ type, targetId }) => UI.spawnVFX(type, targetId));
events.on('shake', () => UI.shake());
events.on('update-ui', () => UI.update());
events.on('play-bgm', (path) => UI.playBGM(path));
events.on('stop-bgm', () => UI.stopBGM());
events.on('animate-card-play', (data) => UI.animateCardPlay(data));

// 初始化交互监听
UI.initArrow();