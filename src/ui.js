import { events } from './eventBus.js';
import { gameStore } from './store/GameStore.js';
import { battleStore } from './store/BattleStore.js';
import { TacticManager } from './TacticManager.js';
import { ROLES } from './data/roles.js';
import { RELICS } from './data/relics.js';
import { CARDS } from './data/cards.js';

// js/ui.js

export const UI = {
    // 切换场景
    switchScene(id) {
        document.querySelectorAll('.scene').forEach(e => e.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },

    setBattleBackground(type) {
        const s = document.getElementById('scene-battle');
        if (!s) return;
        s.classList.remove('bg-boss', 'bg-elite', 'bg-normal');
        
        if (type === 'boss') s.classList.add('bg-boss');
        else if (type === 'elite') s.classList.add('bg-elite');
        else s.classList.add('bg-normal');
    },

    // 渲染角色选择界面
    renderCharSelect(elId, cb) {
        const el = document.getElementById(elId); 
        if(!el) return;
        el.innerHTML = '';
        Object.keys(ROLES).forEach(key => {
            if(elId === 'grid-recruit' && gameStore.partyRoles.includes(key)) return;
            const r = ROLES[key];
            const d = document.createElement('div');
            d.className = 'char-card';
            
            const previewType = elId === 'grid-start' ? 'start' : 'recruit';

            // 添加 onerror 兜底
            d.innerHTML = `
                <img src="${r.sprite}" class="char-img idle-breathe" onerror="this.style.backgroundColor='#333';this.alt='图片丢失'">
                <div class="char-info">
                    <div style="color:#f0c040;font-weight:bold;font-size:1.2em">${r.name}</div>
                    <div class="bonus-text">
                        <div>❤️ HP: ${r.hp}</div>
                        <div>🌟 ${r.buff}</div>
                    </div>
                    <button class="btn-preview" onclick="window.game.previewDeck('${key}', '${previewType}')">🔍 预览卡组</button>
                </div>`;
            
            d.onclick = (e) => { 
                if(e.target.tagName !== 'BUTTON') {
                    e.stopPropagation(); 
                    if(elId==='grid-recruit') d.classList.add('joined'); 
                    cb(key); 
                }
            };
            el.appendChild(d);
        });
    },

    // 渲染战斗区域
    renderBattleField() {
        const con = document.getElementById('party-container');
        if (!con) return;
        con.innerHTML = '';
        battleStore.allies.forEach((a, i) => {
            const unit = document.createElement('div');
            unit.className = 'char-unit';
            unit.id = `char-${a.role}`;
            unit.onclick = () => TacticManager.handleClick(i);
            unit.style.zIndex = i + 1; 
            
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

    renderRewards(mode = 'new') {
        const el = document.getElementById('reward-list'); 
        if(!el) return;
        el.innerHTML='';
        if (mode === 'new') {
            document.getElementById('reward-title').innerText = "领悟新乐谱";
            document.getElementById('reward-text').innerText = "选择一张加入牌组 (若已有则强化)";
            const keys = window.game.getSmartRewards(); 
            for(let k of keys) {
                const c = CARDS[k];
                const d = document.createElement('div'); d.className='char-card'; d.style.height='250px';
                const isOwned = battleStore.deck.includes(parseInt(k));
                let desc = c.desc;
                if(c.val !== undefined) desc = desc.replace('{val}', c.val);
                let actionText = isOwned ? `<span style="color:#2ecc71">★ 突破 (全局+1)</span>` : `<span style="color:#f0c040">✨ 新获取</span>`;
                let currentLv = gameStore.getCardLevel(k);
                let suffix = currentLv > 0 ? ` +${currentLv}` : '';
                d.innerHTML = `
                    <img src="${c.img}" class="char-img" onerror="this.src=''">
                    <div class="char-info">
                        <b>${c.name}${suffix}</b>
                        <div style="margin:5px 0;">${actionText}</div>
                        <div class="card-desc"><span>${desc}</span></div>
                    </div>`;
                d.onclick = () => { 
                    if (isOwned) {
                        if (gameStore.getCardLevel(k) >= 5) {
                            window.UI.toast(`${c.name} 已达等级上限!`);
                            return;
                        }
                        gameStore.upgradeCard(k);
                        window.UI.toast(`${c.name} 突破成功!`);
                    } else {
                        const currentDeck = battleStore.deck;
                        currentDeck.push(parseInt(k));
                        battleStore.setDeck(currentDeck);
                        window.UI.toast(`习得: ${c.name}`);
                    }
                    window.game.finishReward(); 
                };
                el.appendChild(d);
            }
        }
    },

    renderUpgradeRewards(goldGain = 0) {
        const el = document.getElementById('reward-list'); 
        if(!el) return;
        el.innerHTML='';
        document.getElementById('reward-title').innerText = "战火淬炼";
        document.getElementById('reward-text').innerHTML = `获得金币: <img src="assets/UI/gold_icon.png" class="gold-icon-small"> <span style="color:#f0c040; font-weight:bold;">${goldGain}</span><br>选择一种技艺进行【钻研】(上限等级 5)`;
        
        // 过滤掉已满级的卡牌
        const uniqueIds = [...new Set(battleStore.deck)].filter(id => gameStore.getCardLevel(id) < 5);
        
        if (uniqueIds.length === 0) {
            el.innerHTML = "<div style='color:#888'>所有技艺已达化境</div>";
            return;
        }
        const pool = [...uniqueIds];
        const picks = [];
        for(let i=0; i<3; i++) {
                if(pool.length === 0) break;
                const randIdx = Math.floor(Math.random() * pool.length);
                picks.push(pool[randIdx]);
                pool.splice(randIdx, 1);
        }
        picks.forEach(id => {
            const c = CARDS[id];
            const d = document.createElement('div'); d.className = 'char-card'; d.style.height='250px';
            const currentLv = gameStore.getCardLevel(id);
            const nextLv = currentLv + 1;
            let displayVal = c.val;
            let displayDesc = c.desc;
            
            // 变奏
            if (c.eff === 'variation') {
                const bonus = 50 + (10 * nextLv);
                displayDesc = displayDesc.replace('50%', `${bonus}%`);
            }
            // 功能牌 (预览下一级)
            if (c.eff === 'polyphony') {
                const drawCount = 2 + Math.floor((nextLv + 1)/2);
                const manaGain = 1 + Math.floor(nextLv/2);
                displayDesc = displayDesc.replace('{draw}', `<span class="highlight-val">${drawCount}</span>`)
                                         .replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'upbeat') {
                const manaGain = 1 + Math.floor(nextLv/2);
                displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'breath') {
                const manaGain = 2 + nextLv;
                displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'weaken') {
                const strLoss = 2 + nextLv;
                displayDesc = displayDesc.replace('{str}', `<span class="highlight-val">${strLoss}</span>`);
            }
            
            if(c.val !== undefined) {
                const nextVal = Math.ceil(c.val * (1 + 0.5 * nextLv));
                displayDesc = displayDesc.replace('{val}', `<span class="highlight-val">${nextVal}</span>`);
            }
            d.innerHTML = `
                <img src="${c.img}" class="char-img" onerror="this.src=''">
                <div class="char-info">
                    <b style="color:${currentLv>0?'#2ecc71':'#eee'}">${c.name} ${currentLv>0?'+'+currentLv:''}</b>
                    <div style="font-size:2em; color:#f0c040; margin:2px 0;">⮕ +${nextLv}</div>
                    <div class="card-desc"><span>${displayDesc}</span></div>
                </div>`;
            d.onclick = () => { 
                gameStore.upgradeCard(id);
                window.UI.toast(`${c.name} 钻研成功!`);
                window.game.finishReward(); 
            };
            el.appendChild(d);
        });
    },

    renderMap(mapGraph, currentPos) {
        if (!mapGraph || mapGraph.length === 0) {
            console.warn("MapGraph is empty!");
            return;
        }
        
        const cLayer = parseInt(currentPos.layer);
        const cIndex = parseInt(currentPos.index);

        const nodeContainer = document.getElementById('map-nodes');
        const svgContainer = document.getElementById('map-lines');
        if(!nodeContainer || !svgContainer) return;
        
        nodeContainer.innerHTML = '';
        svgContainer.innerHTML = ''; 

        mapGraph.forEach((layerNodes, layerIdx) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'map-layer';
            layerDiv.id = `layer-${layerIdx}`;
            
            layerNodes.forEach((node, nodeIdx) => {
                const nDiv = document.createElement('div');
                nDiv.className = 'map-node-v2';
                nDiv.id = `node-${layerIdx}-${nodeIdx}`;
                
                let state = 'locked';
                if (cLayer === -1) {
                    if (layerIdx === 0) state = 'reachable';
                } else {
                    if (layerIdx < cLayer) state = 'passed';
                    else if (layerIdx === cLayer) {
                        if (nodeIdx === cIndex) state = 'current';
                        else state = 'locked'; 
                    }
                    else if (layerIdx === cLayer + 1) {
                        const currNodeData = mapGraph[cLayer]?.[cIndex];
                        if (currNodeData && currNodeData.next && currNodeData.next.includes(nodeIdx)) {
                            state = 'reachable';
                        }
                    }
                }
                
                nDiv.classList.add(state);
                if (node.type === 'boss') nDiv.classList.add('boss');

                let icon = 'assets/UI/Battle.png';
                if(node.type === 'elite') icon = 'assets/UI/Elite.png';
                if(node.type === 'camp') icon = 'assets/UI/camp.png';
                if(node.type === 'recruit') icon = 'assets/UI/Recruit.png';
                if(node.type === 'shop') icon = 'assets/UI/shop_icon.png';
                if(node.type === 'boss') icon = 'assets/UI/BossBattle.png';
                if(node.type === 'start') icon = 'assets/UI/common_button.png'; 

                nDiv.innerHTML = `<img src="${icon}"><div class="node-name">${node.name}</div>`;
                
                if (state === 'reachable') {
                    nDiv.onclick = () => window.game.enterNode(node.type, layerIdx, nodeIdx);
                }
                
                layerDiv.appendChild(nDiv);
            });
            nodeContainer.appendChild(layerDiv);
        });

        setTimeout(() => {
            const containerRect = document.getElementById('map-container')?.getBoundingClientRect();
            if (!containerRect) return;
            
            mapGraph.forEach((layerNodes, layerIdx) => {
                if (layerIdx >= mapGraph.length - 1) return; 
                layerNodes.forEach((node, nodeIdx) => {
                    const startEl = document.getElementById(`node-${layerIdx}-${nodeIdx}`);
                    if (!startEl) return;
                    const startRect = startEl.getBoundingClientRect();
                    if (startRect.width === 0) return; 

                    const startX = startRect.left - containerRect.left + startRect.width/2;
                    const startY = startRect.top - containerRect.top + startRect.height/2;

                    node.next.forEach(targetIdx => {
                        const endEl = document.getElementById(`node-${layerIdx+1}-${targetIdx}`);
                        if (!endEl) return;
                        const endRect = endEl.getBoundingClientRect();
                        const endX = endRect.left - containerRect.left + endRect.width/2;
                        const endY = endRect.top - containerRect.top + endRect.height/2;
                        
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', startX); line.setAttribute('y1', startY);
                        line.setAttribute('x2', endX); line.setAttribute('y2', endY);
                        line.setAttribute('stroke', '#555'); line.setAttribute('stroke-width', '2');
                        svgContainer.appendChild(line);
                    });
                });
            });
            
            const scrollArea = document.getElementById('map-scroll-area');
            if (cLayer === -1 && scrollArea) {
                scrollArea.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                const currentLayerEl = document.getElementById(`layer-${cLayer}`);
                if(scrollArea && currentLayerEl) {
                    const offset = currentLayerEl.offsetLeft - scrollArea.clientWidth / 2 + currentLayerEl.clientWidth / 2;
                    scrollArea.scrollTo({ left: offset, behavior: 'smooth' });
                }
            }
        }, 100);
    },

    renderShop(shopData) {
        const cGrid = document.getElementById('shop-cards'); if(cGrid) cGrid.innerHTML = '';
        const rGrid = document.getElementById('shop-relics'); if(rGrid) rGrid.innerHTML = '';
        const sGrid = document.getElementById('shop-services'); if(sGrid) sGrid.innerHTML = '';

        if(cGrid) {
            const cardSectionTitle = cGrid.parentElement.querySelector('h3');
            if(cardSectionTitle) cardSectionTitle.innerHTML = '<img src="assets/UI/upgrade_icon.png" class="icon-title"> 技艺磨炼 <span style="font-size:0.6em;color:#2ecc71">(强化)</span>';
            shopData.cards.forEach((item, idx) => {
                const c = CARDS[item.id];
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                const currentLv = item.level; const nextLv = currentLv + 1;
                d.innerHTML = `
                    <div style="position:relative; width:80px; height:80px;">
                        <img src="${c.img}" style="width:100%; height:100%; object-fit:contain;">
                        <div style="position:absolute; bottom:0; right:0; background:#2ecc71; color:#000; font-size:0.8em; padding:2px 4px; border-radius:4px; font-weight:bold;">Lv.${currentLv} -> ${nextLv}</div>
                    </div>
                    <div class="shop-item-name">${c.name}</div>
                    <div class="shop-item-desc" style="color:#2ecc71">点击强化</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('cards', idx);
                cGrid.appendChild(d);
            });
        }

        if(rGrid) {
            const relicSectionTitle = rGrid.parentElement.querySelector('h3');
            if(relicSectionTitle) relicSectionTitle.innerHTML = '<img src="assets/UI/mystery_relic_icon.png" class="icon-title"> 传世圣物';
            shopData.relics.forEach((item, idx) => {
                const r = RELICS[item.key];
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                d.innerHTML = `
                    <div style="position:relative; width:80px; height:80px; display:flex; align-items:center; justify-content:center;">
                        <img src="assets/UI/mystery_relic_icon.png" style="width:100%; height:100%; position:absolute; opacity:0.3;">
                        <span style="font-size:2.5em; position:relative; z-index:2;">${r.icon}</span>
                    </div>
                    <div class="shop-item-name">${r.name}</div>
                    <div class="shop-item-desc">${r.desc}</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('relics', idx);
                rGrid.appendChild(d);
            });
        }

        if(sGrid) {
            shopData.services.forEach((item, idx) => {
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                d.innerHTML = `
                    <div style="width:80px; height:80px;"><img src="${item.icon}" style="width:100%; height:100%; object-fit:contain;"></div>
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('services', idx);
                sGrid.appendChild(d);
            });
        }
    },

    showDeckModal(cardList, title, onCardClick = null) {
        const overlay = document.getElementById('modal-overlay');
        const contentList = document.getElementById('modal-card-list');
        if(!overlay || !contentList) return;
        document.getElementById('modal-title').innerText = title;
        contentList.innerHTML = '';
        overlay.classList.add('active');
        
        const listToRender = onCardClick ? cardList.map((id, i) => ({id, originalIdx: i})) : [...cardList].sort((a,b) => a - b).map(id => ({id}));
        
        if(listToRender.length === 0) {
            contentList.innerHTML = '<div style="color:#666; margin-top:50px;">暂无卡牌</div>';
            return;
        }

        listToRender.forEach((item) => {
            const id = item.id; const c = CARDS[id]; const d = document.createElement('div'); 
            d.className = 'card-display'; 
            if (c.type === 'duo') d.classList.add('duet');
            if (c.type === 'trio') d.classList.add('trio');
            const level = gameStore.getCardLevel(id);
            if(level > 0) d.classList.add('upgraded');
            let desc = c.desc;
            
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
    },

    // ================= 敌人渲染优化 =================
    renderEnemies() {
        const container = document.querySelector('.enemy-container');
        if (!container) return;

        const enemies = battleStore.enemies;
        if (enemies.length === 0) return;
        
        // 1. 检查节点数量是否匹配，不匹配则全量初始化一次
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
                    <div id="${spriteId}" class="sprite-enemy enemy-idle-breathe" onclick="battle.targetEnemy(${idx})"></div>
                    <div class="enemy-hp-box">
                        <img src="assets/UI/hp_icon.png" class="ui-icon" style="width:28px;height:28px;"> 
                        <span class="hp-text" style="color:#fff; font-weight:bold; font-size:1.4em; text-shadow:0 0 5px #000;"></span>
                    </div>
                    <div class="enemy-name"></div>
                `;
                container.appendChild(eDiv);
            });
        }

        // 2. 局部更新每个敌人的状态
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
                    if (['atk', 'atk_heavy', 'atk_vuln'].includes(enemy.intent.type) && iVal !== '') {
                        iVal = parseInt(iVal) + (enemy.buffs.str || 0);
                    }
                    intentEl.innerHTML = `<img src="${iIcon}" class="intent-icon-img" onerror="this.src='assets/UI/attack.png'"> ${iVal}`;
                }
            }

            const statusRow = eDiv.querySelector('.status-row');
            if (statusRow) {
                let statusHtml = '';
                if(enemy.block > 0) statusHtml += `<div class="status-badge block"><img src="assets/UI/block.png" class="ui-icon"> <span>${enemy.block}</span></div>`;
                if(enemy.buffs.vuln > 0) statusHtml += `<div class="status-badge vuln"><img src="assets/UI/Vulnerable.png" class="ui-icon"> <span>${enemy.buffs.vuln}</span></div>`;
                if(enemy.buffs.str !== 0) {
                    const isNeg = enemy.buffs.str < 0;
                    statusHtml += `<div class="status-icon" style="background:${isNeg?'#bdc3c7':'#e74c3c'}">${isNeg?'虚弱':'力量'} ${enemy.buffs.str}</div>`;
                }
                statusRow.innerHTML = statusHtml;
            }

            const spriteId = (idx === 0) ? 'sprite-enemy' : `sprite-enemy-${idx}`;
            const spriteEl = document.getElementById(spriteId);
            if (spriteEl) {
                if (enemy.stunned) spriteEl.classList.add('frozen-effect');
                else spriteEl.classList.remove('frozen-effect');
                if (!spriteEl.className.includes('anim-')) {
                    spriteEl.style.backgroundImage = `url('${enemy.sprite}')`;
                }
            }
        });
    },

    update() {
        const mapGold = document.getElementById('map-gold'); if(mapGold) mapGold.innerText = gameStore.gold;
        const battleGold = document.getElementById('battle-gold'); if(battleGold) battleGold.innerText = gameStore.gold;
        const shopGold = document.getElementById('shop-gold'); if(shopGold) shopGold.innerText = gameStore.gold;

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
        
        const drawUi = document.getElementById('draw-ui');
        if(drawUi) drawUi.innerHTML = `<img src="assets/UI/draw.png" class="ui-icon" style="width:32px;height:32px;" onerror="this.style.display='none'"> 手牌: ${battleStore.mana.draw}`;
        
        const levelUi = document.getElementById('level-ui'); if(levelUi) levelUi.innerText = gameStore.level;
        const mapNum = document.getElementById('map-level-num'); if(mapNum) mapNum.innerText = gameStore.level;
        
        const rBar = document.getElementById('relic-bar'); 
        if(rBar) {
            rBar.innerHTML = '';
            gameStore.relics.forEach(r => {
                const d = document.createElement('div'); d.className = 'relic'; d.innerText = RELICS[r].icon;
                d.setAttribute('data-desc', `${RELICS[r].name}: ${RELICS[r].desc}`);
                rBar.appendChild(d);
            });
        }

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

        this.renderEnemies();

        const btnEnd = document.getElementById('btn-end');
        if (btnEnd) {
             const canEnd = (battleStore.phase === 'PLAYER' && !battleStore.state.processing);
             btnEnd.disabled = !canEnd;
        }

        const hEl = document.getElementById('hand'); 
        if(hEl) {
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
                const playable = window.battle.isCardPlayable(c);
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
                    const realCost = window.battle.getCardCost ? window.battle.getCardCost(cardId) : c.cost;
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
                    const realCost = window.battle.getCardCost ? window.battle.getCardCost(cardId) : c.cost;
                    const costEl = d.querySelector('.card-cost'); if(costEl) costEl.innerText = realCost;
                    d.onclick = (e) => { e.stopPropagation(); if(playable) window.battle.selectCard(i); };
                }
            });
        }
    },
    
    toast(msg) {
        const el = document.createElement('div'); el.className = 'toast'; el.innerText = msg;
        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    floatText(txt, targetId, col) {
        const target = document.getElementById(targetId); if(!target) return;
        const el = document.createElement('div'); el.className = 'float-text'; el.innerText = txt; el.style.color = col; 
        const r = target.getBoundingClientRect(); const w = document.getElementById('game-window').getBoundingClientRect();
        el.style.left = (r.left - w.left + r.width/2 - 20 + (Math.random()-0.5)*20) + 'px';
        el.style.top = (r.top - w.top) + 'px';
        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    spawnVFX(type, targetId) {
        const target = document.getElementById(targetId); if (!target) return;
        const rect = target.getBoundingClientRect(); const gameWin = document.getElementById('game-window').getBoundingClientRect();
        const el = document.createElement('img'); el.src = `assets/vfx/vfx_${type}.png`; el.className = `vfx-particle vfx-${type}`;
        el.style.left = (rect.left - gameWin.left + rect.width / 2 + (Math.random()-0.5)*40) + 'px'; 
        el.style.top = (rect.top - gameWin.top + rect.height / 2 + (Math.random()-0.5)*40) + 'px';
        el.style.filter = `hue-rotate(${Math.random() * 20}deg)`; 
        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 500);
    },

    spawnManaParticle(startTargetId, count = 1) {
        const startElem = document.getElementById(startTargetId) || document.getElementById('party-container');
        const endElem = document.getElementById('mana-ui');
        if (!startElem || !endElem) return;
        const gameWin = document.getElementById('game-window').getBoundingClientRect();
        const sRect = startElem.getBoundingClientRect(); const eRect = endElem.getBoundingClientRect();
        const targetX = eRect.left - gameWin.left + 50; const targetY = eRect.top - gameWin.top + 20;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const el = document.createElement('div'); el.className = 'mana-particle';
                el.style.left = (sRect.left - gameWin.left + sRect.width/2 + (Math.random()-0.5)*40) + 'px';
                el.style.top = (sRect.top - gameWin.top + sRect.height/2 + (Math.random()-0.5)*40) + 'px';
                document.getElementById('game-window').appendChild(el);
                el.style.transition = 'all 0.6s cubic-bezier(0.5, 0, 0, 1)';
                void el.offsetWidth; 
                el.style.left = targetX + 'px'; el.style.top = targetY + 'px';
                el.style.transform = 'scale(0.5)'; el.style.opacity = '0';
                setTimeout(() => el.remove(), 600);
            }, i * 150);
        }
    },

    shake() {
        const w = document.getElementById('game-window');
        if(w) { w.classList.remove('shake'); void w.offsetWidth; w.classList.add('shake'); }
    },

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

    log(msg, type='') {
        const el = document.getElementById('battle-log'); if(!el) return;
        const line = document.createElement('div'); line.innerHTML = msg; line.className = `log-line log-${type}`;
        el.appendChild(line); el.scrollTop = el.scrollHeight;
    },
    
    clearLog() { const el = document.getElementById('battle-log'); if(el) el.innerHTML = ''; },

    animateCardPlay({ card, handIndex }) {
        const handEl = document.getElementById('hand'); 
        // 尝试通过索引获取，或者通过 card-id 查找以增强鲁棒性
        let originalCard = handEl && handEl.children[handIndex];
        
        // 如果索引找不到，尝试通过 ID 查找 (防止 UI 已经重绘导致索引失效)
        if (!originalCard && handEl) {
             originalCard = handEl.querySelector(`[data-card-id="${card.id}"]`);
        }

        if (!originalCard) return;

        const rect = originalCard.getBoundingClientRect();
        // 获取当前的计算样式 transform，这包含了旋转等信息
        const computedStyle = window.getComputedStyle(originalCard);
        const currentTransform = computedStyle.transform;

        const clone = originalCard.cloneNode(true);
        clone.style.position = 'fixed'; 
        clone.style.left = rect.left + 'px'; 
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px'; 
        clone.style.height = rect.height + 'px';
        clone.style.margin = '0'; 
        
        // 关键修复：将当前的 transform 传递给 CSS 变量，供 keyframes 使用
        // 注意：如果我们直接设置 style.transform，它会被 animation 的 0% 覆盖
        // 所以我们在 CSS 动画中使用 var(--start-transform)
        clone.style.setProperty('--start-transform', currentTransform !== 'none' ? currentTransform : 'scale(1)');
        
        // 移除原有的 transform，防止叠加干扰（虽然 animation 会覆盖，但保持清洁）
        clone.style.transform = ''; 
        
        clone.style.zIndex = '9999'; 
        clone.style.pointerEvents = 'none';
        clone.classList.remove('selected', 'card-draw-anim');
        
        document.body.appendChild(clone);
        void clone.offsetWidth; // 强制重绘
        
        let animClass = (card.type === 'atk' || card.tag === 'atk' || card.type === 'duo') ? 'anim-card-play-atk' : 'anim-card-play-skill';
        if (card.cost >= 3 || card.type === 'trio') animClass = 'anim-card-play-power';
        
        clone.classList.add(animClass);
        setTimeout(() => clone.remove(), 800);
    },

    initArrow() {
        document.addEventListener('mousemove', (e) => {
            const idx = battleStore.state.selectedCardIdx;
            if (idx === -1) { this.hideArrow(); return; }
            const cardId = battleStore.hand[idx]; const c = CARDS[cardId];
            if (!c || !(c.type === 'atk' || c.type === 'debuff' || c.eff === 'boom' || c.eff === 'bash')) { this.hideArrow(); return; }
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

UI.initArrow();