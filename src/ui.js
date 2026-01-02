import { events } from './eventBus.js';
import { gameStore } from './store/GameStore.js';
import { battleStore } from './store/BattleStore.js';

// js/ui.js

window.UI = {
    // 切换场景
    switchScene(id) {
        document.querySelectorAll('.scene').forEach(e => e.classList.remove('active'));
        document.getElementById(id).classList.add('active');
    },

    // 渲染角色选择界面
    renderCharSelect(elId, cb) {
        const el = document.getElementById(elId); 
        if(!el) return;
        el.innerHTML = '';
        Object.keys(window.ROLES).forEach(key => {
            if(elId === 'grid-recruit' && gameStore.partyRoles.includes(key)) return;
            const r = window.ROLES[key];
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
        con.innerHTML = '';
        battleStore.allies.forEach((a, i) => {
            const unit = document.createElement('div');
            unit.className = 'char-unit';
            unit.id = `char-${a.role}`;
            unit.onclick = () => window.TacticManager.handleClick(i);
            unit.style.zIndex = i + 1; 
            
            // 注意：这里使用了 div 的 background-image，无法直接用 onerror。
            // 建议：如果依然不显示，请检查 style.css 中 .musician-sprite 的尺寸是否被正确设置
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
                <div class="musician-sprite idle-breathe" style="background-image:url('${window.ROLES[a.role].sprite}'); animation-delay: ${i * 0.4}s"></div>
            `;
            con.appendChild(unit);
        });
    },
    
    // ... (highlightUnit, renderRewards, renderUpgradeRewards, showDeckModal, closeDeckModal 保持不变) ...

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
        const el = document.getElementById('reward-list'); el.innerHTML='';
        if (mode === 'new') {
            document.getElementById('reward-title').innerText = "领悟新乐谱";
            document.getElementById('reward-text').innerText = "选择一张加入牌组 (若已有则强化)";
            const keys = window.game.getSmartRewards(); 
            for(let k of keys) {
                const c = window.CARDS[k];
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
        const el = document.getElementById('reward-list'); el.innerHTML='';
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
            const c = window.CARDS[id];
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

    // ================= 地图渲染 (New) =================
    renderMap(mapGraph, currentPos) {
        if (!mapGraph || mapGraph.length === 0) {
            console.warn("MapGraph is empty!");
            return;
        }
        
        // Ensure numbers
        const cLayer = parseInt(currentPos.layer);
        const cIndex = parseInt(currentPos.index);

        console.log("RenderMap:", cLayer, cIndex, "Graph Layers:", mapGraph.length);
        
        const nodeContainer = document.getElementById('map-nodes');
        const svgContainer = document.getElementById('map-lines');
        if(!nodeContainer || !svgContainer) return;
        
        nodeContainer.innerHTML = '';
        svgContainer.innerHTML = ''; // 清空连线

        // 1. Render Nodes
        mapGraph.forEach((layerNodes, layerIdx) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'map-layer';
            layerDiv.id = `layer-${layerIdx}`;
            
            layerNodes.forEach((node, nodeIdx) => {
                const nDiv = document.createElement('div');
                nDiv.className = 'map-node-v2';
                nDiv.id = `node-${layerIdx}-${nodeIdx}`;
                
                // Determine State
                let state = 'locked';
                
                // 1. 如果还在地图外 (-1)，Layer 0 可达
                if (cLayer === -1) {
                    if (layerIdx === 0) state = 'reachable';
                }
                // 2. 如果已经进入地图
                else {
                    if (layerIdx < cLayer) state = 'passed';
                    else if (layerIdx === cLayer) {
                        if (nodeIdx === cIndex) state = 'current';
                        else state = 'locked'; 
                    }
                    else if (layerIdx === cLayer + 1) {
                        // 检查连通性
                        const currNodeData = mapGraph[cLayer]?.[cIndex]; // Add safe check
                        if (currNodeData && currNodeData.next && currNodeData.next.includes(nodeIdx)) {
                            state = 'reachable';
                        }
                    }
                }
                
                nDiv.classList.add(state);
                if (node.type === 'boss') nDiv.classList.add('boss');

                // Icon
                let icon = 'assets/UI/Battle.png';
                if(node.type === 'elite') icon = 'assets/UI/Elite.png';
                if(node.type === 'camp') icon = 'assets/UI/camp.png';
                if(node.type === 'recruit') icon = 'assets/UI/Recruit.png';
                if(node.type === 'shop') icon = 'assets/UI/shop_icon.png';
                if(node.type === 'boss') icon = 'assets/UI/BossBattle.png';
                if(node.type === 'start') icon = 'assets/UI/common_button.png'; 

                nDiv.innerHTML = `<img src="${icon}"><div class="node-name">${node.name}</div>`;
                
                if (state === 'reachable') {
                    nDiv.onclick = () => {
                        console.log("Clicked Node:", node.type, layerIdx, nodeIdx);
                        window.game.enterNode(node.type, layerIdx, nodeIdx);
                    };
                }
                
                layerDiv.appendChild(nDiv);
            });
            
            nodeContainer.appendChild(layerDiv);
        });

        // 2. Draw Lines (After DOM layout)
        setTimeout(() => {
            const containerRect = document.getElementById('map-container')?.getBoundingClientRect();
            if (!containerRect) return; // Safety check
            
            mapGraph.forEach((layerNodes, layerIdx) => {
                if (layerIdx >= mapGraph.length - 1) return; 
                
                layerNodes.forEach((node, nodeIdx) => {
                    const startEl = document.getElementById(`node-${layerIdx}-${nodeIdx}`);
                    if (!startEl) return;
                    const startRect = startEl.getBoundingClientRect();
                    
                    // Simple check if visible (width > 0)
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
                        line.setAttribute('x1', startX);
                        line.setAttribute('y1', startY);
                        line.setAttribute('x2', endX);
                        line.setAttribute('y2', endY);
                        line.setAttribute('stroke', '#555');
                        line.setAttribute('stroke-width', '2');
                        
                        svgContainer.appendChild(line);
                    });
                });
            });
            
            // Auto scroll to current layer
            const scrollArea = document.getElementById('map-scroll-area');
            if (cLayer === -1 && scrollArea) {
                // Initial state: scroll to start
                scrollArea.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                const currentLayerEl = document.getElementById(`layer-${cLayer}`);
                if(scrollArea && currentLayerEl) {
                    const offset = currentLayerEl.offsetLeft - scrollArea.clientWidth / 2 + currentLayerEl.clientWidth / 2;
                    scrollArea.scrollTo({ left: offset, behavior: 'smooth' });
                }
            }
            
        }, 100); // 增加延迟，确保布局完成
    },

    // ================= 商店渲染 =================
    renderShop(shopData) {
        const cGrid = document.getElementById('shop-cards'); cGrid.innerHTML = '';
        const rGrid = document.getElementById('shop-relics'); rGrid.innerHTML = '';
        const sGrid = document.getElementById('shop-services'); sGrid.innerHTML = '';

        // 更新标题
        const cardSectionTitle = cGrid.parentElement.querySelector('h3');
        if(cardSectionTitle) cardSectionTitle.innerHTML = '<img src="assets/UI/upgrade_icon.png" class="icon-title"> 技艺磨炼 <span style="font-size:0.6em;color:#2ecc71">(强化)</span>';

        // Cards (Upgrades)
        shopData.cards.forEach((item, idx) => {
            const c = window.CARDS[item.id];
            const d = document.createElement('div');
            d.className = 'shop-item' + (item.sold ? ' sold' : '');
            
            const currentLv = item.level;
            const nextLv = currentLv + 1;
            
            d.innerHTML = `
                <div style="position:relative; width:80px; height:80px;">
                    <img src="${c.img}" style="width:100%; height:100%; object-fit:contain;">
                    <div style="position:absolute; bottom:0; right:0; background:#2ecc71; color:#000; font-size:0.8em; padding:2px 4px; border-radius:4px; font-weight:bold;">
                        Lv.${currentLv} -> ${nextLv}
                    </div>
                </div>
                <div class="shop-item-name">${c.name}</div>
                <div class="shop-item-desc" style="color:#2ecc71">点击强化</div>
                <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
            `;
            d.onclick = () => window.game.buyItem('cards', idx);
            cGrid.appendChild(d);
        });

        // Relics
        const relicSectionTitle = rGrid.parentElement.querySelector('h3');
        if(relicSectionTitle) relicSectionTitle.innerHTML = '<img src="assets/UI/mystery_relic_icon.png" class="icon-title"> 传世圣物';

        shopData.relics.forEach((item, idx) => {
            const r = window.RELICS[item.key];
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

        // Services
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
    },

    showDeckModal(cardList, title, onCardClick = null) {
        const overlay = document.getElementById('modal-overlay');
        const contentList = document.getElementById('modal-card-list');
        document.getElementById('modal-title').innerText = title;
        contentList.innerHTML = '';
        overlay.classList.add('active');
        
        // 排序逻辑：如果是移除卡牌模式 (onCardClick存在)，则不排序，保持原顺序以便 splice
        // 如果是查看模式，保持 ID 排序
        const listToRender = onCardClick ? cardList.map((id, i) => ({id, originalIdx: i})) : [...cardList].sort((a,b) => a - b).map(id => ({id}));
        
        if(listToRender.length === 0) {
            contentList.innerHTML = '<div style="color:#666; margin-top:50px;">暂无卡牌</div>';
            return;
        }

        listToRender.forEach((item) => {
            const id = item.id;
            const c = window.CARDS[id];
            const d = document.createElement('div'); 
            d.className = 'card-display'; 
            if (c.type === 'duo') d.classList.add('duet');
            if (c.type === 'trio') d.classList.add('trio');
            const level = gameStore.getCardLevel(id);
            if(level > 0) d.classList.add('upgraded');
            let desc = c.desc;
            
            // 变奏
            if (c.eff === 'variation') {
                const bonus = 50 + (10 * level);
                desc = desc.replace('50%', `${bonus}%`);
            }
            // 功能牌
            if (c.eff === 'polyphony') {
                const drawCount = 2 + Math.floor((level + 1)/2);
                const manaGain = 1 + Math.floor(level/2);
                desc = desc.replace('{draw}', `<span class="highlight-val">${drawCount}</span>`)
                           .replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'upbeat') {
                const manaGain = 1 + Math.floor(level/2);
                desc = desc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'breath') {
                const manaGain = 2 + level;
                desc = desc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'weaken') {
                const strLoss = 2 + level;
                desc = desc.replace('{str}', `<span class="highlight-val">${strLoss}</span>`);
            }

            let displayVal = c.val;
            if (displayVal !== undefined) {
                 if(level > 0 && displayVal > 0) displayVal = Math.ceil(displayVal * (1 + 0.5 * level));
                 const color = (c.type==='duo'||c.type==='trio') ? '#4dabf7' : '#2ecc71';
                 desc = desc.replace('{val}', `<span class="highlight-val" style="color:${color}">${displayVal}</span>`);
            }
            const nameSuffix = level > 0 ? ` +${level}` : '';
            d.innerHTML = `
                <div class="card-cost">${c.cost}</div>
                <img src="${c.img}" class="card-art" onerror="this.src=''">
                <div class="card-text">
                    <div class="card-name">${c.name}${nameSuffix}</div>
                    <div class="card-desc"><span>${desc}</span></div>
                </div>
            `;
            
            if (onCardClick) {
                d.style.cursor = 'pointer';
                d.style.border = '2px dashed #e74c3c';
                d.onmouseover = () => d.style.borderColor = '#f0c040';
                d.onmouseout = () => d.style.border = '2px dashed #e74c3c';
                d.onclick = () => onCardClick(id, item.originalIdx);
            }

            contentList.appendChild(d);
        });
    },

    closeDeckModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    },

    // Update 核心部分
    update() {
        // 更新金币显示
        const mapGold = document.getElementById('map-gold');
        if(mapGold) mapGold.innerText = gameStore.gold;
        const battleGold = document.getElementById('battle-gold');
        if(battleGold) battleGold.innerText = gameStore.gold;
        const shopGold = document.getElementById('shop-gold');
        if(shopGold) shopGold.innerText = gameStore.gold;

        const mBox = document.getElementById('mana-ui'); 
        if(mBox) {
            // Smart update for Mana to allow animations
            // Check existing dots
            const currentMana = battleStore.mana.current;
            const maxMana = battleStore.mana.max;
            
            // 1. Sync DOM count
            while(mBox.children.length < maxMana) {
                const d = document.createElement('div');
                d.className = 'mana-dot empty'; // 新创建的默认为空，等待下方状态更新
                mBox.appendChild(d);
            }
            while(mBox.children.length > maxMana) {
                if(mBox.lastChild) mBox.lastChild.remove();
            }

            // 2. Update states
            Array.from(mBox.children).forEach((dot, i) => {
                const shouldBeFull = i < currentMana;
                const isFull = !dot.classList.contains('empty');
                
                if (shouldBeFull && !isFull) {
                    // 从空变满 -> 播放获得动画
                    dot.classList.remove('empty');
                    dot.classList.remove('active-anim');
                    void dot.offsetWidth; // Trigger reflow
                    dot.classList.add('active-anim');
                } else if (!shouldBeFull && isFull) {
                    // 从满变空 -> 变灰 (可以加消耗动画，这里暂且直接变灰)
                    dot.classList.add('empty');
                    dot.classList.remove('active-anim');
                }
            });
        }
        
        const drawUi = document.getElementById('draw-ui');
        // 添加 onerror，防止图标缺失导致显示异常
        if(drawUi) drawUi.innerHTML = `<img src="assets/UI/draw.png" class="ui-icon" style="width:32px;height:32px;" onerror="this.style.display='none'"> 手牌: ${battleStore.mana.draw}`;
        
        const levelUi = document.getElementById('level-ui');
        if(levelUi) levelUi.innerText = gameStore.level;
        
        const mapNum = document.getElementById('map-level-num');
        if(mapNum) mapNum.innerText = gameStore.level;
        
        const rBar = document.getElementById('relic-bar'); 
        if(rBar) {
            rBar.innerHTML = '';
            gameStore.relics.forEach(r => {
                const d = document.createElement('div');
                d.className = 'relic'; d.innerText = window.RELICS[r].icon;
                d.setAttribute('data-desc', `${window.RELICS[r].name}: ${window.RELICS[r].desc}`);
                rBar.appendChild(d);
            });
        }

        battleStore.allies.forEach(a => {
            const unit = document.getElementById(`char-${a.role}`);
            if(unit) {
                if(a.dead) unit.classList.add('dead'); else unit.classList.remove('dead');
                
                const hpText = document.getElementById(`hp-text-${a.role}`);
                if(hpText) hpText.innerText = `${a.hp}`;
                
                const blkEl = document.getElementById(`block-${a.role}`);
                const blkVal = document.getElementById(`block-val-${a.role}`);
                if(blkEl && blkVal) {
                    if(a.block > 0) {
                         blkEl.style.display = 'flex';
                         blkVal.innerText = a.block;
                    } else {
                         blkEl.style.display = 'none';
                    }
                }
            }
        });

        if(battleStore.enemy && battleStore.enemy.maxHp) {
            const eHpPct = (battleStore.enemy.hp / battleStore.enemy.maxHp) * 100;
            const eHpBar = document.getElementById('e-hp-bar');
            if(eHpBar) eHpBar.style.width = eHpPct + '%';
            
            const eHpText = document.getElementById('e-hp-text');
            if(eHpText) eHpText.innerText = `${battleStore.enemy.hp}/${battleStore.enemy.maxHp}`;
            
            const eName = document.getElementById('e-name');
            if(eName) eName.innerText = battleStore.enemy.name;
            
            const eSprite = document.getElementById('sprite-enemy');
            if(eSprite) {
                // 如果正在播放特殊的序列帧动画，不使用 JS 强制设置背景图，允许 CSS 动画接管
                const hasSpecialAnim = eSprite.classList.contains('anim-knight-attack') || 
                                     eSprite.classList.contains('anim-dancer-attack') || 
                                     eSprite.classList.contains('anim-demon-cast');
                                     
                if (!hasSpecialAnim) {
                    eSprite.style.backgroundImage = `url('${battleStore.enemy.sprite}')`;
                } else {
                    // 清除内联样式，确保 CSS keyframes 生效
                    eSprite.style.backgroundImage = '';
                }
            }
            
            const intentEl = document.getElementById('e-intent');
            if(intentEl) {
                if(battleStore.enemy.stunned) {
                    intentEl.innerHTML = '<span class="intent-icon">❄️</span> 无法行动';
                    if(eSprite) eSprite.classList.add('frozen-effect');
                } else {
                    const iIcon = battleStore.enemy.intent.icon || 'assets/UI/attack.png';
                    let iVal = battleStore.enemy.intent.val > 0 ? battleStore.enemy.intent.val : '';
                    
                    // Show strength bonus for all attack types
                    const atkTypes = ['atk', 'atk_heavy', 'atk_vuln'];
                    let isBuffed = false;
                    if(atkTypes.includes(battleStore.enemy.intent.type) && iVal !== '') {
                        const str = battleStore.enemy.buffs.str || 0;
                        if (str > 0) isBuffed = true;
                        iVal = parseInt(iVal) + str;
                    }
                    // 添加 onerror
                    const valHtml = isBuffed ? `<span style="color:#e74c3c; font-weight:bold; text-shadow:0 0 5px rgba(231,76,60,0.5);">${iVal}</span>` : iVal;
                    intentEl.innerHTML = `<img src="${iIcon}" class="intent-icon-img" onerror="this.src='assets/UI/attack.png'"> ${valHtml}`;
                    if(eSprite) eSprite.classList.remove('frozen-effect');
                }
            }

            const sRow = document.getElementById('e-status');
            if(sRow) {
                sRow.innerHTML = '';
                // 护盾显示：移到状态栏或者血条旁。这里放在状态栏里比较清晰
                if(battleStore.enemy.block > 0) {
                     sRow.innerHTML += `<div style="display:flex;align-items:center;background:rgba(0,0,0,0.8);border-radius:4px;padding:4px 8px;margin-right:5px;"><img src="assets/UI/block.png" class="ui-icon" style="width:28px;height:28px;" onerror="this.style.display='none'"> <span style="font-weight:bold;margin-left:6px;color:#3498db;font-size:1.2em;">${battleStore.enemy.block}</span></div>`;
                }
                
                // 添加 onerror
                if(battleStore.enemy.buffs.vuln > 0) sRow.innerHTML += `<div style="display:flex;align-items:center;background:rgba(0,0,0,0.8);border-radius:4px;padding:4px 8px;margin-right:5px;"><img src="assets/UI/Vulnerable.png" class="ui-icon" style="width:28px;height:28px;" onerror="this.style.display='none'"> <span style="font-weight:bold;margin-left:6px;color:#e67e22;font-size:1.2em;">${battleStore.enemy.buffs.vuln}</span></div>`;
                if(battleStore.enemy.buffs.res > 0) sRow.innerHTML += `<div class="status-icon" style="background:#9b59b6">共鸣 ${battleStore.enemy.buffs.res}</div>`; 
                if(battleStore.enemy.buffs.str > 0) sRow.innerHTML += `<div class="status-icon" style="background:#e74c3c">力量 ${battleStore.enemy.buffs.str}</div>`;
            }
        }

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

            // 1. 移除多余的 DOM 节点 (如果手牌变少了)
            while (existingChildren.length > handData.length) {
                const el = existingChildren.pop();
                el.remove();
            }

            // 2. 更新或创建节点
            handData.forEach((cardId, i) => {
                const c = window.CARDS[cardId];
                if (!c) return;
                
                let d = existingChildren[i];
                let isNew = false;

                // 如果节点不存在，创建新节点
                if (!d) {
                    d = document.createElement('div');
                    hEl.appendChild(d);
                    isNew = true;
                }

                // 检查是否需要更新内容 (根据 cardId 或 isNew)
                // 为了性能，我们只在 cardId 变化(比如位置变了)或新创建时重新渲染 innerHTML
                // 或者我们可以简单点，总是更新内容，因为 DOM 操作本身开销还行，主要是避免 remove/append 导致的动画重置
                const prevCardId = d.getAttribute('data-card-id');
                const shouldUpdateContent = isNew || prevCardId != cardId;

                d.id = `hand-card-${i}`; // 确保 ID 对应当前 index
                d.setAttribute('data-card-id', cardId);

                const level = gameStore.getCardLevel(cardId);
                const playable = window.battle.isCardPlayable(c);
                const isSelected = (i === battleStore.state.selectedCardIdx);

                // 更新 Class
                d.className = 'card' + (isSelected ? ' selected' : '') 
                            + (c.type==='duo' ? ' duet' : '') 
                            + (c.type==='trio' ? ' trio' : '')
                            + (!playable ? ' disabled' : '')
                            + (level > 0 ? ' upgraded' : '');
                
                // 如果是新创建的，添加抽牌动画 Class
                if (isNew) {
                    d.classList.add('card-draw-anim');
                    // 动画播放完后移除 class (可选，防止干扰后续 transform)
                    setTimeout(() => d.classList.remove('card-draw-anim'), 400);
                }

                // 动态计算布局参数，防止手牌过多挤出屏幕
                const totalCards = handData.length;
                let rotStep = 5;
                let overlap = -30;
                let scale = 1;

                if (totalCards > 6) {
                    rotStep = 4;
                    overlap = -50;
                }
                if (totalCards > 9) {
                    rotStep = 3;
                    overlap = -70;
                    scale = 0.9; // 微缩以容纳更多
                }

                d.style.marginLeft = `${overlap}px`;
                d.style.marginRight = `${overlap}px`;

                // 计算旋转 (只要不是被选中状态)
                if(!isSelected && playable) {
                    const rot = (i - (totalCards-1)/2) * rotStep;
                    // 动态 Y 轴偏移：手牌越多，扇形弧度越小，需要的 Y 轴修正越小
                    let yOffset = Math.abs(rot) * 2;
                    if (totalCards > 8) yOffset = Math.abs(rot) * 1.5 + 10;
                    
                    d.style.transform = `rotate(${rot}deg) translateY(${yOffset}px) scale(${scale})`;
                } else {
                    // 如果被选中或不可用，可能有特定的 transform (例如 selected 会放大)
                    // 这里我们只负责重置非选中状态的 transform。
                    // 选中状态由 CSS .selected 控制 scale 和 translate，但 CSS 无法动态计算 rotate 复位。
                    // 通常选中时我们会移除 rotate。
                    d.style.transform = isSelected ? '' : `scale(${scale})`; 
                }

                if (shouldUpdateContent) {
                    let displayVal = c.val;
                    let displayDesc = c.desc;
                    
                    // 动态描述逻辑
                    if (c.eff === 'variation') {
                        const bonus = 50 + (10 * level);
                        displayDesc = displayDesc.replace('50%', `${bonus}%`);
                    }
                    if (c.eff === 'polyphony') {
                        const drawCount = 2 + Math.floor((level + 1)/2);
                        const manaGain = 1 + Math.floor(level/2);
                        displayDesc = displayDesc.replace('{draw}', `<span class="highlight-val">${drawCount}</span>`)
                                                 .replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
                    }
                    if (c.eff === 'upbeat') {
                        const manaGain = 1 + Math.floor(level/2);
                        displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
                    }
                    if (c.eff === 'breath') {
                        const manaGain = 2 + level;
                        displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
                    }
                    if (c.eff === 'weaken') {
                        const strLoss = 2 + level;
                        displayDesc = displayDesc.replace('{str}', `<span class="highlight-val">${strLoss}</span>`);
                    }
    
                    if (displayVal !== undefined) {
                        if(level > 0 && displayVal > 0) displayVal = Math.ceil(displayVal * (1 + 0.5 * level));
                        displayDesc = displayDesc.replace('{val}', `<span class="highlight-val">${displayVal}</span>`);
                    }
                    
                    const nameSuffix = level > 0 ? ` +${level}` : '';
                    const realCost = window.battle.getCardCost ? window.battle.getCardCost(cardId) : c.cost;
    
                    d.innerHTML = `
                        <div class="card-cost">${realCost}</div>
                        <img src="${c.img}" class="card-art" onerror="this.src=''">
                        <div class="card-text">
                            <div class="card-name">${c.name}${nameSuffix}</div>
                            <div class="card-desc"><span>${displayDesc}</span></div>
                        </div>
                    `;
                    
                    // 重新绑定事件 (防止因为 index 变化导致闭包里的 i 过期? 
                    // 其实因为我们每次 render 都重新绑定，所以闭包里的 i 是新的循环变量 i，是正确的)
                    d.onclick = (e) => { e.stopPropagation(); if(playable) window.battle.selectCard(i); };
                } else {
                    // 即使内容不更新，Cost 可能会变 (费用减免等)，以及 onclick 的 index 必须更新！
                    // 为了安全起见，我们还是重新绑定 onclick 和更新 cost 显示
                    const realCost = window.battle.getCardCost ? window.battle.getCardCost(cardId) : c.cost;
                    const costEl = d.querySelector('.card-cost');
                    if(costEl && costEl.innerText != realCost) costEl.innerText = realCost;
                    
                    d.onclick = (e) => { e.stopPropagation(); if(playable) window.battle.selectCard(i); };
                }
            });
        }
    },
    
    // ... (rest of the file)
    toast(msg) {
        const el = document.createElement('div'); el.className = 'toast'; el.innerText = msg;
        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    floatText(txt, targetId, col) {
        const el = document.createElement('div'); el.className = 'float-text'; 
        el.innerText = txt; el.style.color = col; 
        const target = document.getElementById(targetId);
        if(!target) return;
        
        const r = target.getBoundingClientRect();
        const w = document.getElementById('game-window').getBoundingClientRect();
        // 增加随机偏移，防止完全重叠
        const randomX = (Math.random() - 0.5) * 20; 
        el.style.left = (r.left - w.left + r.width/2 - 20 + randomX) + 'px';
        el.style.top = (r.top - w.top) + 'px';
        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 1000);
    },

    spawnVFX(type, targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        const rect = target.getBoundingClientRect();
        const gameWin = document.getElementById('game-window').getBoundingClientRect();
        
        const el = document.createElement('img');
        el.src = `assets/vfx/vfx_${type}.png`; 
        el.className = `vfx-particle vfx-${type}`;
        
        const centerX = rect.left - gameWin.left + rect.width / 2;
        const centerY = rect.top - gameWin.top + rect.height / 2;
        const randomX = (Math.random() - 0.5) * 40;
        const randomY = (Math.random() - 0.5) * 40;
        
        el.style.left = (centerX + randomX) + 'px'; 
        el.style.top = (centerY + randomY) + 'px';
        el.style.filter = `hue-rotate(${Math.random() * 20}deg)`; 

        document.getElementById('game-window').appendChild(el);
        setTimeout(() => el.remove(), 500);
    },

    // 灵感粒子特效
    spawnManaParticle(startTargetId, count = 1) {
        const startElem = document.getElementById(startTargetId) || document.getElementById('party-container');
        const endElem = document.getElementById('mana-ui');
        if (!startElem || !endElem) return;

        const gameWin = document.getElementById('game-window').getBoundingClientRect();
        const sRect = startElem.getBoundingClientRect();
        const eRect = endElem.getBoundingClientRect();

        // 终点稍微修正到 Mana 条的中心
        const targetX = eRect.left - gameWin.left + 50; 
        const targetY = eRect.top - gameWin.top + 20;

        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                const el = document.createElement('div');
                el.className = 'mana-particle';
                
                // 起点随机偏移
                const startX = sRect.left - gameWin.left + sRect.width/2 + (Math.random()-0.5)*40;
                const startY = sRect.top - gameWin.top + sRect.height/2 + (Math.random()-0.5)*40;
                
                el.style.left = startX + 'px';
                el.style.top = startY + 'px';
                document.getElementById('game-window').appendChild(el);

                // 使用 Web Animations API 实现抛物线或平滑移动
                // 这里用简单的 transition
                el.style.transition = 'all 0.6s cubic-bezier(0.5, 0, 0, 1)';
                
                // 强制重绘以确保 transition 生效
                void el.offsetWidth; 

                el.style.left = targetX + 'px';
                el.style.top = targetY + 'px';
                el.style.transform = 'scale(0.5)'; // 飞过去变小
                el.style.opacity = '0';

                setTimeout(() => el.remove(), 600);
            }, i * 150);
        }
    },

    shake() {
        const w = document.getElementById('game-window');
        if(w) {
            w.classList.remove('shake'); 
            void w.offsetWidth; 
            w.classList.add('shake');
        }
    },

    playSound(path) {
        const audio = new Audio(path);
        audio.volume = 0.6;
        audio.play().catch(e => console.warn("Audio error:", e));
    },

    playBGM(path) {
        // 如果当前正在播放同一首曲子，则直接返回，防止重头播放
        if (this.currentBGM && this.currentBGM.src.endsWith(encodeURI(path))) return;
        
        if (this.currentBGM) {
            this.currentBGM.pause();
        }
        this.currentBGM = new Audio(path);
        this.currentBGM.loop = true;
        this.currentBGM.volume = 0.5;
        this.currentBGM.play().catch(e => console.warn("BGM error:", e));
    },

    stopBGM() {
        if (this.currentBGM) {
            this.currentBGM.pause();
            this.currentBGM = null;
        }
    },

    // 战斗日志
    log(msg, type='') {
        const el = document.getElementById('battle-log');
        if(!el) return;
        const line = document.createElement('div');
        line.innerHTML = msg;
        line.className = `log-line log-${type}`;
        el.appendChild(line);
        el.scrollTop = el.scrollHeight;
    },
    
    clearLog() {
        const el = document.getElementById('battle-log');
        if(el) el.innerHTML = '';
    },

    // ================= 卡牌动画系统 =================
    animateCardPlay({ card, handIndex }) {
        // 1. 找到原始卡牌 DOM
        // 注意：renderHand 里我们给每个卡牌的 ID 是 hand-card-${i} 吗？
        // 检查 renderHand: `d.id = 'hand-card-' + i;` (需要在 renderHand 里确认添加了这个 ID)
        // 之前的 read_file 没有显示 renderHand 加了 ID，我们需要在 renderHand 里补上 ID，或者通过 querySelector 获取
        // 为了稳妥，我们假设 renderHand 现在的实现可能没有 id，我们先去 renderHand 加上 ID。
        // 或者直接用 children index。
        
        const handEl = document.getElementById('hand');
        if (!handEl || !handEl.children[handIndex]) return;
        
        const originalCard = handEl.children[handIndex];
        const rect = originalCard.getBoundingClientRect();
        
        // 2. 创建克隆体
        const clone = originalCard.cloneNode(true);
        
        // 3. 设置克隆体样式，使其脱离文档流并重合
        clone.style.position = 'fixed';
        clone.style.left = rect.left + 'px';
        clone.style.top = rect.top + 'px';
        clone.style.width = rect.width + 'px';
        clone.style.height = rect.height + 'px';
        clone.style.margin = '0'; // 清除 margin 干扰
        clone.style.transform = originalCard.style.transform; // 继承旋转
        clone.style.zIndex = '9999';
        clone.style.transition = 'none'; // 移除 hover 效果可能的 transition
        clone.style.pointerEvents = 'none'; // 穿透点击
        
        // 移除可能存在的 hover/select class
        clone.classList.remove('selected', 'card-draw-anim');
        
        // 4. 添加到 body 或 game-window
        document.body.appendChild(clone);
        
        // 5. 应用动画 Class
        // 强制重绘
        void clone.offsetWidth;
        
        let animClass = 'anim-card-play-skill'; // 默认
        if (card.type === 'atk' || card.tag === 'atk' || card.type === 'duo') {
            animClass = 'anim-card-play-atk';
        }
        // 如果费用很高或是特殊大招
        if (card.cost >= 3 || card.type === 'trio' || card.name === '胡桃夹子') {
            animClass = 'anim-card-play-power';
        }
        
        clone.classList.add(animClass);
        
        // 6. 动画结束后清理
        setTimeout(() => {
            clone.remove();
        }, 800); // 略长于 CSS 动画时间 (0.7s)
    },

    // ================= 箭头系统 (New) =================
    initArrow() {
        document.addEventListener('mousemove', (e) => {
            const idx = battleStore.state.selectedCardIdx;
            
            // 1. 如果没有选中卡牌，或者是无法指向的卡牌(非攻击/Debuff)，则隐藏
            if (idx === -1) {
                this.hideArrow();
                return;
            }
            const cardId = battleStore.hand[idx];
            const c = window.CARDS[cardId];
            
            // 检查是否是需要指向目标的卡牌 (atk, debuff 等)
            // 简单判断：如果它不是AOE或Buff，通常需要指。 
            // 这里的判断逻辑应该与 battle.js 中 selectCard 的逻辑一致
            // battle.js: if(cardData.type === 'atk' || cardData.type === 'debuff' || cardData.eff === 'boom' || cardData.eff === 'bash')
            if (!c || !(c.type === 'atk' || c.type === 'debuff' || c.eff === 'boom' || c.eff === 'bash')) {
                this.hideArrow();
                return;
            }

            // 2. 计算起点和终点
            const cardEl = document.getElementById(`hand-card-${idx}`);
            if (cardEl) {
                const rect = cardEl.getBoundingClientRect();
                // 起点：卡牌顶部中心
                const startX = rect.left + rect.width / 2;
                const startY = rect.top; 
                
                // 终点：鼠标位置
                const endX = e.clientX;
                const endY = e.clientY;
                
                this.drawArrow(startX, startY, endX, endY);
            }
        });
        
        // 当鼠标点击任意位置（且不是有效目标）时，battle.js 会处理 deselect
        // 但为了视觉即时性，我们也可以监听 mouseup
    },

    drawArrow(x1, y1, x2, y2) {
        const layer = document.getElementById('drag-arrow-layer');
        const path = document.getElementById('drag-arrow-path');
        if (!layer || !path) return;

        layer.style.display = 'block';
        
        // 贝塞尔曲线控制点
        // 我们希望线条呈现一种"抛物线"或"绳索"的感觉
        // P0=(x1,y1), P2=(x2,y2)
        // 控制点 P1 可以取中点，但 Y 轴稍微向上提，形成弧度
        // 或者简单的：控制点 x 在两点之间，y 比最高点还高一些
        
        const cx = x1 + (x2 - x1) * 0.5;
        const cy = Math.min(y1, y2) - 100; // 向上拱起

        // 如果要更像杀戮尖塔，它其实是一个 S 型或者简单的抛物线
        // 尝试: 起点控制点偏上，终点控制点偏目标方向
        // 这里用简单的二次贝塞尔曲线 Q
        
        const d = `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
        path.setAttribute('d', d);
        
        // 简单的目标高亮逻辑 (可选)
        // 检查鼠标是否悬停在敌人身上
        const enemyEl = document.getElementById('sprite-enemy');
        if (enemyEl) {
            const rect = enemyEl.getBoundingClientRect();
            if (x2 >= rect.left && x2 <= rect.right && y2 >= rect.top && y2 <= rect.bottom) {
                // 此时可以高亮敌人
                enemyEl.style.filter = "brightness(1.5) drop-shadow(0 0 10px red)";
                path.setAttribute('stroke', '#ffcc00'); // 箭头变黄
                document.getElementById('arrowhead').children[0].setAttribute('fill', '#ffcc00');
            } else {
                enemyEl.style.filter = ""; // 复原
                path.setAttribute('stroke', '#ff0000');
                document.getElementById('arrowhead').children[0].setAttribute('fill', '#ff0000');
            }
        }
    },

    hideArrow() {
        const layer = document.getElementById('drag-arrow-layer');
        if (layer) layer.style.display = 'none';
        
        // 顺便清理敌人高亮
        const enemyEl = document.getElementById('sprite-enemy');
        if (enemyEl) enemyEl.style.filter = "";
    }
};

// Event Listeners Registration
events.on('highlight-unit', ({ idx, active }) => window.UI.highlightUnit(idx, active));
events.on('render-battlefield', () => window.UI.renderBattleField());
events.on('clear-log', () => window.UI.clearLog());
events.on('log', ({ msg, type }) => window.UI.log(msg, type));
events.on('toast', (msg) => window.UI.toast(msg));
events.on('float-text', ({ text, targetId, color }) => window.UI.floatText(text, targetId, color));
events.on('play-sound', (path) => window.UI.playSound(path));
events.on('spawn-vfx', ({ type, targetId }) => window.UI.spawnVFX(type, targetId));
events.on('shake', () => window.UI.shake());
events.on('update-ui', () => window.UI.update());
events.on('play-bgm', (path) => window.UI.playBGM(path));
events.on('stop-bgm', () => window.UI.stopBGM());
events.on('animate-card-play', (data) => window.UI.animateCardPlay(data));

// Init Arrow System
window.UI.initArrow();