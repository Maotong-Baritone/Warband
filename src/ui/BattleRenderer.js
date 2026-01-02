import { gameStore } from '../store/GameStore.js';
import { battleStore } from '../store/BattleStore.js'; // 引入 Store 
import { STATUSES } from '../data/statuses.js';
import { CARDS } from '../data/cards.js';
import { ROLES } from '../data/roles.js';
import { TacticManager } from '../TacticManager.js';

export const BattleRenderer = {
    
    // --- 核心渲染循环 ---
    update() {
        // 1. 灵感 (Mana)
        const mBox = document.getElementById('mana-ui'); 
        if(mBox) {
            const currentMana = battleStore.mana.current; const maxMana = battleStore.mana.max;
            while(mBox.children.length < maxMana) {
                const d = document.createElement('div'); d.className = 'mana-dot empty'; mBox.appendChild(d);
            }
            while(mBox.children.length > maxMana) { if(mBox.lastChild) mBox.lastChild.remove(); }
            Array.from(mBox.children).forEach((dot, i) => {
                const shouldBeFull = i < currentMana; const isFull = !dot.classList.contains('empty');
                if (shouldBeFull && !isFull) {
                    dot.classList.remove('empty', 'active-anim'); void dot.offsetWidth; dot.classList.add('active-anim');
                } else if (!shouldBeFull && isFull) { dot.classList.add('empty'); dot.classList.remove('active-anim'); }
            });
        }
        
        // 2. 抽牌堆
        const drawUi = document.getElementById('draw-ui');
        if(drawUi) drawUi.innerHTML = `<img src="assets/UI/draw.png" class="ui-icon" style="width:32px;height:32px;" onerror="this.style.display='none'"> 手牌: ${battleStore.mana.draw}`;
        
        // 3. 我方单位状态 (血量/护盾)
        battleStore.allies.forEach(a => {
            const unit = document.getElementById(`char-${a.role}`);
            if(unit) {
                if(a.dead) unit.classList.add('dead'); else unit.classList.remove('dead');
                const hpText = document.getElementById(`hp-text-${a.role}`); if(hpText) hpText.innerText = `${a.hp}`;
                const blkEl = document.getElementById(`block-${a.role}`);
                const blkVal = document.getElementById(`block-val-${a.role}`);
                if(blkEl && blkVal) {
                    if(a.block > 0) { blkEl.style.display = 'flex'; blkVal.innerText = a.block; } 
                    else { blkEl.style.display = 'none'; }
                }
            }
        });

        // 4. 敌人单位
        this.renderEnemies();

        // 5. 结束回合按钮
        const btnEnd = document.getElementById('btn-end');
        if (btnEnd) {
             const canEnd = (battleStore.phase === 'PLAYER' && !battleStore.state.processing);
             btnEnd.disabled = !canEnd;
        }

        // 6. 手牌渲染 (使用稳定的静态布局)
        this.renderHand();
    },

    // --- 场地下层 ---
    renderBattleField() {
        const con = document.getElementById('party-container');
        if (!con) return;
        con.innerHTML = '';
        
        const allies = battleStore.allies;
        allies.forEach((a, i) => {
            const unit = document.createElement('div');
            unit.className = 'char-unit';
            unit.id = `char-${a.role}`;
            unit.onclick = () => TacticManager.handleClick(i);
            
            unit.innerHTML = `
                <div class="mini-status">
                    <div class="mini-hp-text">
                        <img src="assets/UI/hp_icon.png" class="ui-icon" onerror="this.style.display='none'"> <span id="hp-text-${a.role}">${a.hp}</span>
                    </div>
                    <div class="mini-block" id="block-${a.role}" style="display:none">
                        <div class="block-bg"></div>
                        <div class="block-val" id="block-val-${a.role}"></div>
                    </div>
                </div>
                <div class="musician-sprite idle-breathe" style="background-image:url('${ROLES[a.role].sprite}'); animation-delay: ${i * 0.4}s"></div>
            `;
            con.appendChild(unit);
        });
        
        // 应用动态布局
        this.applyDynamicLayout(con, 'char-unit', false);
    },

    renderEnemies() {
        const container = document.querySelector('.enemy-container');
        if (!container) return;

        const enemies = battleStore.enemies;
        if (enemies.length === 0) return;
        
        // 1. 检查节点数量
        if (container.children.length !== enemies.length) {
            container.innerHTML = '';
            enemies.forEach((enemy, idx) => {
                const eDiv = document.createElement('div');
                eDiv.className = 'enemy-unit';
                eDiv.id = `enemy-unit-${idx}`;
                const spriteId = (idx === 0) ? 'sprite-enemy' : `sprite-enemy-${idx}`;
                eDiv.innerHTML = `
                    <div class="status-row"></div>
                    <div class="intent-badge"></div>
                    <div id="${spriteId}" class="sprite-enemy enemy-idle-breathe" onclick="window.battle.targetEnemy(${idx})"></div>
                    <div class="enemy-hp-box">
                        <img src="assets/UI/hp_icon.png" class="ui-icon" style="width:28px;height:28px;"> 
                        <span class="hp-text" style="color:#fff; font-weight:bold; font-size:1.4em; text-shadow:0 0 5px #000;"></span>
                    </div>
                    <div class="enemy-name"></div>
                `;
                container.appendChild(eDiv);
            });
            // 重新计算布局
            this.applyDynamicLayout(container, 'enemy-unit', true);
        }

        // 2. 状态更新
        enemies.forEach((enemy, idx) => {
            const eDiv = document.getElementById(`enemy-unit-${idx}`);
            if (!eDiv) return;

            if (enemy.isDying) { eDiv.classList.add('dead'); } 
            else if (enemy.hp <= 0) { eDiv.classList.add('dead-static'); eDiv.classList.remove('dead'); } 
            else { eDiv.classList.remove('dead', 'dead-static'); }

            const hpText = eDiv.querySelector('.hp-text');
            if (hpText) hpText.innerText = `${enemy.hp}/${enemy.maxHp}`;

            const nameEl = eDiv.querySelector('.enemy-name');
            if (nameEl) nameEl.innerText = enemy.name;

            const intentEl = eDiv.querySelector('.intent-badge');
            if (intentEl) {
                if (enemy.stunned) {
                    intentEl.innerHTML = '<span class="intent-icon">❄️</span> 无法行动';
                } else {
                    const iIcon = enemy.intent.icon || 'assets/UI/attack.png';
                    let iVal = enemy.intent.val > 0 ? enemy.intent.val : '';
                    let displayVal = iVal;
                    
                    if (['atk', 'atk_heavy', 'atk_vuln'].includes(enemy.intent.type) && iVal !== '') {
                         // 查找力量层数
                        const strStatus = (enemy.status || []).find(s => s.id === 'str');
                        const strVal = strStatus ? strStatus.amount : 0;
                        const weakStatus = (enemy.status || []).find(s => s.id === 'temp_str_down');
                        const weakVal = weakStatus ? weakStatus.amount : 0;
                        
                        displayVal = parseInt(iVal) + strVal - weakVal;
                    }
                    intentEl.innerHTML = `<img src="${iIcon}" class="intent-icon-img" onerror="this.src='assets/UI/attack.png'"> ${displayVal}`;
                }
            }

            const statusRow = eDiv.querySelector('.status-row');
            if (statusRow) {
                let statusHtml = '';
                if(enemy.block > 0) statusHtml += `<div class="status-badge block"><img src="assets/UI/block.png" class="ui-icon"> <span>${enemy.block}</span></div>`;
                
                if (enemy.status && enemy.status.length > 0) {
                    enemy.status.forEach(s => {
                        const def = STATUSES[s.id];
                        if (!def) return;
                        
                        // 简单样式处理
                        const isDebuff = def.type === 'debuff';
                        const colorStyle = isDebuff ? '' : 'filter: hue-rotate(90deg);'; 
                        let iconPath = def.icon;
                        
                        statusHtml += `
                            <div class="status-badge" title="${def.name}: ${s.amount}" style="${s.id==='vuln'?'background:#e67e22':''}">
                                <img src="${iconPath}" class="ui-icon" style="${colorStyle}"> 
                                <span>${s.amount}</span>
                            </div>
                        `;
                    });
                }
                statusRow.innerHTML = statusHtml;
            }

            const spriteId = (idx === 0) ? 'sprite-enemy' : `sprite-enemy-${idx}`;
            const spriteEl = document.getElementById(spriteId);
            if (spriteEl) {
                if (enemy.stunned) spriteEl.classList.add('frozen-effect');
                else spriteEl.classList.remove('frozen-effect');
                
                // 修复立绘消失问题：只要不在播放攻击/特殊序列动画，就强制恢复背景图
                const isAnimating = spriteEl.className.includes('anim-');
                // 检查背景图是否丢失
                const currentBg = spriteEl.style.backgroundImage;
                
                if (!isAnimating) {
                    // 如果没有动画，且背景图不对（或者为空），强制恢复
                    if (!currentBg || !currentBg.includes(enemy.sprite)) {
                        spriteEl.style.backgroundImage = `url('${enemy.sprite}')`;
                    }
                }
            }
        });
    },

    // --- 动态布局算法 (Parallax + Overlap) ---
    applyDynamicLayout(container, className, isEnemy) {
        const units = container.getElementsByClassName(className);
        const total = units.length;
        if (total === 0) return;

        // 基础参数配置
        const baseScale = 1.0;
        const scaleStep = 0.05; // 每向后一层，缩放减小 5%
        const yOffsetStep = -8; // 每向后一层，向上移动 8px
        
        // 负边距计算 (挤压算法)
        let overlapMargin = 0;
        if (total > 3) overlapMargin = -20;
        if (total > 4) overlapMargin = -40;

        // [New] 敌人专用：全局拥挤缩放 (当数量>=4时，整体缩小以适应屏幕)
        let globalCrowdingScale = 1.0;
        if (isEnemy && total >= 4) {
             globalCrowdingScale = 0.85; 
             overlapMargin = -50; // 更紧凑的间距
        }

        Array.from(units).forEach((el, index) => {
            let depthIndex; 
            if (!isEnemy) {
                depthIndex = index; // 0..total-1.  0 is furthest.
            } else {
                depthIndex = (total - 1) - index; 
            }

            const zIndex = 10 + depthIndex; // 越靠近中间(前排)，Z越高
            
            // 计算深度缩放
            let finalScale = baseScale - ((total - 1 - depthIndex) * scaleStep); 
            
            // [New] 应用体型修正与拥挤缩放
            if (isEnemy) {
                const enemyData = battleStore.enemies[index];
                const intrinsicScale = (enemyData && enemyData.scale) ? enemyData.scale : 1.0;
                finalScale = finalScale * intrinsicScale * globalCrowdingScale;
            }

            const yOffset = (total - 1 - depthIndex) * yOffsetStep;
            
            el.style.zIndex = zIndex;
            // 保持原有的 transition
            el.style.transform = `scale(${finalScale}) translateY(${yOffset}px)`;
            
            // Margin 处理
            if (!isEnemy) {
                 if (index > 0) el.style.marginLeft = `${overlapMargin}px`;
                 el.style.marginRight = '0';
            } else {
                 if (index > 0) el.style.marginLeft = `${overlapMargin}px`;
                 el.style.marginRight = '0';
            }
        });
    },

    // 还原旧版 renderHand (静态布局)
    renderHand() {
        const hEl = document.getElementById('hand'); 
        if(!hEl) return;
        
        const btnCancel = document.getElementById('btn-cancel');
        if(btnCancel) btnCancel.style.display = battleStore.state.selectedCardIdx === -1 ? 'none' : 'block';

        const handData = battleStore.hand;
        const existingChildren = Array.from(hEl.children);
        while (existingChildren.length > handData.length) { existingChildren.pop().remove(); }

        handData.forEach((cardId, i) => {
            const c = CARDS[cardId]; if (!c) return;
            let d = existingChildren[i]; let isNew = false;
            if (!d) { d = document.createElement('div'); hEl.appendChild(d); isNew = true; }

            const prevCardId = d.getAttribute('data-card-id');
            const shouldUpdateContent = isNew || prevCardId != cardId;
            d.id = `hand-card-${i}`; d.setAttribute('data-card-id', cardId);

            const level = gameStore.getCardLevel(cardId);
            const playable = window.battle && window.battle.isCardPlayable ? window.battle.isCardPlayable(c) : true;
            const isSelected = (i === battleStore.state.selectedCardIdx);

            d.className = 'card' + (isSelected ? ' selected' : '') + (c.type==='duo' ? ' duet' : '') + (c.type==='trio' ? ' trio' : '') + (!playable ? ' disabled' : '') + (level > 0 ? ' upgraded' : '');
            if (isNew) { d.classList.add('card-draw-anim'); setTimeout(() => d.classList.remove('card-draw-anim'), 400); }

            const totalCards = handData.length;
            let rotStep = 5; let overlap = -30; let scale = 1;
            if (totalCards > 6) { rotStep = 4; overlap = -50; }
            if (totalCards > 9) { rotStep = 3; overlap = -70; scale = 0.9; }
            d.style.marginLeft = `${overlap}px`; d.style.marginRight = `${overlap}px`;

            if(!isSelected && playable) {
                const rot = (i - (totalCards-1)/2) * rotStep;
                let yOffset = Math.abs(rot) * 2;
                if (totalCards > 8) yOffset = Math.abs(rot) * 1.5 + 10;
                d.style.transform = `rotate(${rot}deg) translateY(${yOffset}px) scale(${scale})`;
            } else { d.style.transform = isSelected ? '' : `scale(${scale})`; }

            const realCost = window.battle && window.battle.getCardCost ? window.battle.getCardCost(cardId) : c.cost;

            if (shouldUpdateContent) {
                let desc = c.desc;
                if (c.eff === 'variation') { desc = desc.replace('50%', `${50 + (10 * level)}%`); }
                if (c.eff === 'polyphony') {
                    desc = desc.replace('{draw}', `<span class="highlight-val">${2 + Math.floor((level + 1)/2)}</span>`)
                               .replace('{mana}', `<span class="highlight-val">${1 + Math.floor(level/2)}</span>`);
                }
                if (c.eff === 'upbeat') { desc = desc.replace('{mana}', `<span class="highlight-val">${1 + Math.floor(level/2)}</span>`); }
                if (c.eff === 'breath') { desc = desc.replace('{mana}', `<span class="highlight-val">${2 + level}</span>`); }
                if (c.eff === 'weaken') { desc = desc.replace('{str}', `<span class="highlight-val">${2 + level}</span>`); }
                if (c.val !== undefined) {
                    let val = c.val; if(level > 0 && val > 0) val = Math.ceil(val * (1 + 0.5 * level));
                    desc = desc.replace('{val}', `<span class="highlight-val">${val}</span>`);
                }
                
                d.innerHTML = `
                    <div class="card-cost">${realCost}</div>
                    <img src="${c.img}" class="card-art" onerror="this.src=''">
                    <div class="card-text">
                        <div class="card-name">${c.name}${level > 0 ? ' +'+level : ''}</div>
                        <div class="card-desc"><span>${desc}</span></div>
                    </div>
                `;
                d.onclick = (e) => { e.stopPropagation(); if(playable) window.battle.selectCard(i); };
            } else {
                const costEl = d.querySelector('.card-cost'); if(costEl) costEl.innerText = realCost;
                d.onclick = (e) => { e.stopPropagation(); if(playable) window.battle.selectCard(i); };
            }
        });
    },

    // --- 辅助功能 ---

    setBattleBackground(type) {
        const s = document.getElementById('scene-battle');
        const video = document.getElementById('battle-video');
        if (!s) return;
        
        s.classList.remove('bg-boss', 'bg-elite', 'bg-normal');
        
        if (type === 'boss') {
            s.classList.add('bg-boss');
            if (video) {
                video.src = 'assets/Background/Boss_battle_video.mp4';
                video.style.display = 'block';
                video.play().catch(e => console.log("Video play failed", e));
            }
        } else {
            if (video) {
                video.pause();
                video.style.display = 'none';
            }
            if (type === 'elite') s.classList.add('bg-elite');
            else s.classList.add('bg-normal');
        }
    },

    highlightUnit(idx, active) {
        const units = document.querySelectorAll('.char-unit');
        units.forEach((u, i) => {
            u.classList.remove('swap-selected', 'swap-target');
            if (active) {
                if (i === idx) u.classList.add('swap-selected');
                else u.classList.add('swap-target');
            }
        });
    },

    log(msg, type='') {
        const el = document.getElementById('battle-log'); if(!el) return;
        const line = document.createElement('div'); line.innerHTML = msg; line.className = `log-line log-${type}`;
        el.appendChild(line); el.scrollTop = el.scrollHeight;
    },
    
    clearLog() { const el = document.getElementById('battle-log'); if(el) el.innerHTML = ''; },

    spawnManaParticle(startTargetId, count = 1) {
        const startElem = document.getElementById(startTargetId) || document.getElementById('party-container');
        const endElem = document.getElementById('mana-ui');
        if (!startElem || !endElem) return;
        const win = document.getElementById('game-window');
        if(!win) return;
        const gameWin = win.getBoundingClientRect();
        const sRect = startElem.getBoundingClientRect(); const eRect = endElem.getBoundingClientRect();
        const targetX = eRect.left - gameWin.left + 50; const targetY = eRect.top - gameWin.top + 20;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const el = document.createElement('div'); el.className = 'mana-particle';
                el.style.left = (sRect.left - gameWin.left + sRect.width/2 + (Math.random()-0.5)*40) + 'px';
                el.style.top = (sRect.top - gameWin.top + sRect.height/2 + (Math.random()-0.5)*40) + 'px';
                win.appendChild(el);
                el.style.transition = 'all 0.6s cubic-bezier(0.5, 0, 0, 1)';
                void el.offsetWidth; 
                el.style.left = targetX + 'px'; el.style.top = targetY + 'px';
                el.style.transform = 'scale(0.5)'; el.style.opacity = '0';
                setTimeout(() => el.remove(), 600);
            }, i * 150);
        }
    },

    animateCardPlay({ card, handIndex }) {
        const handEl = document.getElementById('hand'); 
        let originalCard = handEl && handEl.children[handIndex];
        if (!originalCard && handEl) {
             originalCard = handEl.querySelector(`[data-card-id="${card.id}"]`);
        }
        if (!originalCard) return;

        const rect = originalCard.getBoundingClientRect();
        const computedStyle = window.getComputedStyle(originalCard);
        const currentTransform = computedStyle.transform;

        const clone = originalCard.cloneNode(true);
        clone.style.position = 'fixed'; 
        clone.style.left = rect.left + 'px'; 
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px'; 
        clone.style.height = rect.height + 'px';
        clone.style.margin = '0'; 
        
        clone.style.setProperty('--start-transform', currentTransform !== 'none' ? currentTransform : 'scale(1)');
        clone.style.transform = ''; 
        clone.style.zIndex = '9999'; 
        clone.style.pointerEvents = 'none';
        clone.classList.remove('selected', 'card-draw-anim');
        
        document.body.appendChild(clone);
        void clone.offsetWidth; 
        
        let animClass = (card.type === 'atk' || card.tag === 'atk' || card.type === 'duo') ? 'anim-card-play-atk' : 'anim-card-play-skill';
        if (card.cost >= 3 || card.type === 'trio') animClass = 'anim-card-play-power';
        
        clone.classList.add(animClass);
        setTimeout(() => clone.remove(), 800);
    },

    // --- 指向箭头系统 ---
    initArrow() {
        document.addEventListener('mousemove', (e) => {
            const idx = battleStore.state.selectedCardIdx;
            if (idx === -1) { this.hideArrow(); return; }
            
            // 注意：这里需要防御式编程，hand 可能为空
            if (!battleStore.hand[idx]) return;

            const cardId = battleStore.hand[idx]; 
            const c = CARDS[cardId];
            if (!c || !(c.type === 'atk' || c.type === 'debuff' || c.type === 'spec' || c.eff === 'boom' || c.eff === 'bash')) { this.hideArrow(); return; }
            
            const cardEl = document.getElementById(`hand-card-${idx}`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                this.drawArrow(rect.left + rect.width / 2, rect.top, e.clientX, e.clientY);
            }
        });
    },

    drawArrow(x1, y1, x2, y2) {
        const layer = document.getElementById('drag-arrow-layer');
        const path = document.getElementById('drag-arrow-path');
        if (!layer || !path) return;
        layer.style.display = 'block';
        const cx = x1 + (x2 - x1) * 0.5; const cy = Math.min(y1, y2) - 100;
        path.setAttribute('d', `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`);
        
        const enemies = document.querySelectorAll('.sprite-enemy'); let hoverTarget = null;
        enemies.forEach((el, idx) => {
             const rect = el.getBoundingClientRect();
             if (x2 >= rect.left && x2 <= rect.right && y2 >= rect.top && y2 <= rect.bottom) {
                 hoverTarget = el; el.style.filter = "brightness(1.5) drop-shadow(0 0 10px red)";
                 document.body.setAttribute('data-hover-enemy-idx', idx);
             } else { el.style.filter = ""; }
        });
        if (hoverTarget) {
            path.setAttribute('stroke', '#ffcc00'); document.getElementById('arrowhead').children[0].setAttribute('fill', '#ffcc00');
        } else {
            path.setAttribute('stroke', '#ff0000'); document.getElementById('arrowhead').children[0].setAttribute('fill', '#ff0000');
            document.body.removeAttribute('data-hover-enemy-idx');
        }
    },

    hideArrow() {
        const layer = document.getElementById('drag-arrow-layer');
        if (layer) layer.style.display = 'none';
        document.querySelectorAll('.sprite-enemy').forEach(el => el.style.filter = "");
        document.body.removeAttribute('data-hover-enemy-idx');
    }
};