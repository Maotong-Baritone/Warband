import { CARDS } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { gameStore } from '../store/GameStore.js';
import { battleStore } from '../store/BattleStore.js';
import { PATHS } from '../data/constants.js';

export const BaseUI = {
    // --- 场景管理 ---
    switchScene(id) {
        document.querySelectorAll('.scene').forEach(e => e.classList.remove('active'));
        const el = document.getElementById(id);
        if(el) el.classList.add('active');
    },

    // --- 全局 HUD 更新 (顶部栏) ---
    updateHeader() {
        const mapGold = document.getElementById('map-gold'); if(mapGold) mapGold.innerText = gameStore.gold;
        const battleGold = document.getElementById('battle-gold'); if(battleGold) battleGold.innerText = gameStore.gold;
        const shopGold = document.getElementById('shop-gold'); if(shopGold) shopGold.innerText = gameStore.gold;
        
        const levelUi = document.getElementById('level-ui'); if(levelUi) levelUi.innerText = gameStore.level;
        const mapNum = document.getElementById('map-level-num'); if(mapNum) mapNum.innerText = gameStore.level;
        
        const rBar = document.getElementById('relic-bar'); 
        if(rBar) {
            // 简单 diff，防止频繁重绘 DOM
            // 也可以直接清空重绘，这里为了省事直接重绘，因为 relic 不常变
            rBar.innerHTML = '';
            gameStore.relics.forEach(r => {
                const d = document.createElement('div'); d.className = 'relic'; d.innerText = RELICS[r].icon;
                d.setAttribute('data-desc', `${RELICS[r].name}: ${RELICS[r].desc}`);
                rBar.appendChild(d);
            });
        }
    },

    // --- 通用反馈 (Toast, VFX, Audio) ---
    toast(msg) {
        const el = document.createElement('div'); el.className = 'toast'; el.innerText = msg;
        const win = document.getElementById('game-window');
        if(win) win.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    floatText(txt, targetId, col) {
        const target = document.getElementById(targetId); if(!target) return;
        const el = document.createElement('div'); el.className = 'float-text'; el.innerText = txt; el.style.color = col; 
        const r = target.getBoundingClientRect(); 
        const win = document.getElementById('game-window');
        if(!win) return;
        const w = win.getBoundingClientRect();
        
        el.style.left = (r.left - w.left + r.width/2 - 20 + (Math.random()-0.5)*20) + 'px';
        el.style.top = (r.top - w.top) + 'px';
        win.appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    spawnVFX(type, targetId) {
        const target = document.getElementById(targetId); if (!target) return;
        const win = document.getElementById('game-window'); if(!win) return;
        const rect = target.getBoundingClientRect(); const gameWin = win.getBoundingClientRect();
        const el = document.createElement('img'); el.src = `assets/vfx/vfx_${type}.png`; el.className = `vfx-particle vfx-${type}`;
        el.style.left = (rect.left - gameWin.left + rect.width / 2 + (Math.random()-0.5)*40) + 'px'; 
        el.style.top = (rect.top - gameWin.top + rect.height / 2 + (Math.random()-0.5)*40) + 'px';
        el.style.filter = `hue-rotate(${Math.random() * 20}deg)`; 
        win.appendChild(el);
        setTimeout(() => el.remove(), 500);
    },

    shake() {
        const w = document.getElementById('game-window');
        if(w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }
    },

    // --- 音频管理 ---
    currentBGM: null,
    
    playSound(path) {
        const audio = new Audio(path); audio.volume = 0.6;
        audio.play().catch(e => console.warn("Audio error:", e));
    },

    playBGM(path) {
        if (this.currentBGM && this.currentBGM.src.endsWith(encodeURI(path))) return;
        if (this.currentBGM) this.currentBGM.pause();
        this.currentBGM = new Audio(path); this.currentBGM.loop = true; this.currentBGM.volume = 0.5;
        this.currentBGM.play().catch(e => console.warn("BGM error:", e));
    },

    stopBGM() { if (this.currentBGM) { this.currentBGM.pause(); this.currentBGM = null; } },

    // --- 卡组查看模态框 ---
    showDeckModal(cardList, title, onCardClick = null) {
        const overlay = document.getElementById('modal-overlay');
        const contentList = document.getElementById('modal-card-list');
        if(!overlay || !contentList) return;
        const titleEl = document.getElementById('modal-title');
        if(titleEl) titleEl.innerText = title;
        
        contentList.innerHTML = '';
        overlay.classList.add('active');
        
        const listToRender = onCardClick ? cardList.map((id, i) => ({id, originalIdx: i})) : [...cardList].sort((a,b) => a - b).map(id => ({id}));
        
        if(listToRender.length === 0) {
            contentList.innerHTML = '<div style="color:#666; margin-top:50px;">暂无卡牌</div>';
            return;
        }

        listToRender.forEach((item) => {
            const id = item.id; const c = CARDS[id]; 
            if(!c) return;
            const d = document.createElement('div'); 
            d.className = 'card-display'; 
            if (c.type === 'duo') d.classList.add('duet');
            if (c.type === 'trio') d.classList.add('trio');
            const level = gameStore.getCardLevel(id);
            if(level > 0) d.classList.add('upgraded');
            let desc = c.desc;
            
            // 解析描述中的动态数值
            if (c.eff === 'variation') { desc = desc.replace('50%', `${50 + (10 * level)}%`); }
            if (c.eff === 'polyphony') {
                desc = desc.replace('{draw}', `<span class="highlight-val">${2 + Math.floor((level + 1)/2)}</span>`)
                           .replace('{mana}', `<span class="highlight-val">${1 + Math.floor(level/2)}</span>`);
            }
            if (c.eff === 'upbeat') { desc = desc.replace('{mana}', `<span class="highlight-val">${1 + Math.floor(level/2)}</span>`); }
            if (c.eff === 'breath') { desc = desc.replace('{mana}', `<span class="highlight-val">${2 + level}</span>`); }
            if (c.eff === 'weaken') { desc = desc.replace('{str}', `<span class="highlight-val">${2 + level}</span>`); }

            let displayVal = c.val;
            if (displayVal !== undefined) {
                 if(level > 0 && displayVal > 0) displayVal = Math.ceil(displayVal * (1 + 0.5 * level));
                 const color = (c.type==='duo'||c.type==='trio') ? '#4dabf7' : '#2ecc71';
                 desc = desc.replace('{val}', `<span class="highlight-val" style="color:${color}">${displayVal}</span>`);
            }
            d.innerHTML = `
                <div class="card-cost">${c.cost}</div>
                <img src="${c.img}" class="card-art" onerror="this.src=''">
                <div class="card-text">
                    <div class="card-name">${c.name}${level > 0 ? ' +'+level : ''}</div>
                    <div class="card-desc"><span>${desc}</span></div>
                </div>
            `;
            if (onCardClick) {
                d.style.cursor = 'pointer'; d.style.border = '2px dashed #e74c3c';
                d.onclick = () => onCardClick(id, item.originalIdx);
            }
            contentList.appendChild(d);
        });
    },

    closeDeckModal() {
        const overlay = document.getElementById('modal-overlay');
        if(overlay) overlay.classList.remove('active');
    }
};
