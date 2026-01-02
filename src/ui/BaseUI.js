import { CARDS } from '../data/cards.js';
import { RELICS } from '../data/relics.js';
import { gameStore } from '../store/GameStore.js';
import { battleStore } from '../store/BattleStore.js';
import { PATHS } from '../data/constants.js';

// 伤害数字物理模拟系统
class DamageNumberSystem {
    constructor() {
        this.container = document.getElementById('game-window');
    }

    /**
     * 创建一个伤害数字
     * @param {string|number} value - 显示数值
     * @param {HTMLElement} target - 目标元素 (用于定位)
     * @param {Object} options - 配置项 { color, scale, isCrit, type }
     */
    spawn(value, target, options = {}) {
        if (!this.container || !target) return;

        const el = document.createElement('div');
        el.className = 'damage-popup';
        el.innerText = value;
        
        // 样式配置
        const color = options.color || '#fff';
        const scale = options.scale || 1.0;
        const isCrit = options.isCrit || false;

        el.style.color = color;
        el.style.fontSize = `${1.5 * scale}em`;
        el.style.textShadow = `0 0 5px ${color}`;
        if (isCrit) {
            el.style.fontWeight = 'bold';
            el.style.fontSize = `${2.0 * scale}em`;
            el.style.zIndex = '100'; // 暴击在最上层
        }

        // 初始位置计算
        const tRect = target.getBoundingClientRect();
        const cRect = this.container.getBoundingClientRect();
        
        // 随机偏移 (防止完全重叠)
        const startX = tRect.left - cRect.left + tRect.width / 2 + (Math.random() - 0.5) * 40;
        const startY = tRect.top - cRect.top + tRect.height / 2 - 20;

        el.style.left = `${startX}px`;
        el.style.top = `${startY}px`;

        this.container.appendChild(el);

        // 物理参数
        let velocityX = (Math.random() - 0.5) * 6; // 横向随机速度
        let velocityY = -6 - Math.random() * 4;   // 向上爆发速度
        if (isCrit) velocityY -= 3;               // 暴击飞得更高
        const gravity = 0.4;                      // 重力
        const friction = 0.95;                    // 空气阻力

        // 动画循环
        let opacity = 1.0;
        let posX = startX;
        let posY = startY;
        let life = 60; // 存活帧数 (约1秒)

        const animate = () => {
            if (life <= 0) {
                el.remove();
                return;
            }

            // 物理更新
            posX += velocityX;
            posY += velocityY;
            velocityY += gravity;
            velocityX *= friction;

            // 样式更新
            el.style.left = `${posX}px`;
            el.style.top = `${posY}px`;

            // 渐隐与缩放
            if (life < 20) {
                opacity -= 0.05;
                el.style.opacity = opacity;
                el.style.transform = `scale(${opacity})`; // 消失时变小
            } else {
                // 出生时的弹跳缩放 (Elastic Out 模拟)
                // 这里简单用 scale 1 -> 1.2 -> 1
                if (life > 50) {
                    const progress = (60 - life) / 10;
                    const s = 1 + Math.sin(progress * Math.PI) * 0.3; 
                    el.style.transform = `scale(${s})`;
                } else {
                     el.style.transform = `scale(1)`;
                }
            }

            life--;
            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }
}

const DamageSystem = new DamageNumberSystem();

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

    // 升级版 floatText: 自动判断是否使用高级伤害数字
    floatText(txt, targetId, col) {
        const target = document.getElementById(targetId); 
        if (!target) return;

        // 尝试解析 txt 是否为纯数字 (伤害/治疗)
        // txt 可能是 "-12", "+5", "格挡", "易伤+1"
        // 简单的正则匹配：是否以数字开头或包含数字
        // 为了安全起见，我们只对纯数值或带简单符号的数值使用 DamageSystem
        // 比如 "-12" (String) -> 12
        
        const numMatch = txt.toString().match(/^([+\-]?)(\d+)$/);
        
        if (numMatch) {
            // 是简单的数字变化
            const sign = numMatch[1];
            const val = parseInt(numMatch[2]);
            const isCrit = val > 20; // 简单阈值，以后可以传参
            
            // 决定缩放
            let scale = 1.0;
            if (val > 10) scale = 1.2;
            if (val > 30) scale = 1.5;
            
            DamageSystem.spawn(txt, target, { color: col, scale: scale, isCrit: isCrit });
        } else {
            // 非数字文本 (如 "格挡", "易伤+1")，走旧逻辑但加点简单的上浮动画
            const el = document.createElement('div'); 
            el.className = 'float-text'; 
            el.innerText = txt; 
            el.style.color = col; 
            
            const r = target.getBoundingClientRect(); 
            const win = document.getElementById('game-window');
            if(!win) return;
            const w = win.getBoundingClientRect();
            
            // 静态文本也稍微给点随机偏移
            el.style.left = (r.left - w.left + r.width/2 - 20 + (Math.random()-0.5)*10) + 'px';
            el.style.top = (r.top - w.top) + 'px';
            win.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }
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