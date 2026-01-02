import { events } from './eventBus.js';
import { gameStore } from './store/GameStore.js';
import { battleStore } from './store/BattleStore.js';
import { UI } from './ui.js';
import { ROLES } from './data/roles.js';
import { ENEMIES } from './data/enemies.js';
import { RELICS } from './data/relics.js';
import { CARDS, DUO_CARDS } from './data/cards.js';
import { COMMON_DECK } from './data/constants.js';

// js/game.js

export const game = {
    // 代理属性 (Getter) 以保持兼容性，但建议逐步迁移到直接使用 gameStore
    get partyRoles() { return gameStore.partyRoles; },
    get level() { return gameStore.level; },
    get relics() { return gameStore.relics; },
    get cardLevels() { return gameStore.cardLevels; },
    get gold() { return gameStore.gold; },
    set gold(val) { /* 不允许直接设置，需使用 gameStore.addGold */ console.warn("Use gameStore.addGold/spendGold instead"); },
    
    start() {
        events.emit('update-ui'); 
        UI.switchScene('scene-select');
        UI.renderCharSelect('grid-start', (key) => this.initParty(key));
        events.emit('play-bgm', 'assets/BGM/Ravel_Gaspard de la Nuit.mp3');
    },

    initParty(leaderKey, autoNav = true) {
        gameStore.initGame(leaderKey);
        window.battle.reset(); // Reset battle store
        
        // Map System Init
        this.mapGraph = [];
        this.currentMapPos = { layer: -1, index: -1 };
        
        const r = ROLES[leaderKey];
        // window.battle.manaData is a getter proxy to store.mana, so we modify properties, not replace the object
        window.battle.manaData.current = 3;
        window.battle.manaData.max = 3;
        window.battle.manaData.draw = 5;
        
        // 应用领队被动
        if(leaderKey === 'pianist') window.battle.manaData.max = 4;
        if(leaderKey === 'violinist') window.battle.manaData.draw += 1; 

        battleStore.setAllies([ this.createAlly(leaderKey) ]);
        const startDeckIds = [...COMMON_DECK, ...r.deck];
        battleStore.setDeck([...startDeckIds]);
        
        if(autoNav) this.mapSelect(); 
    },

    createAlly(roleKey) {
        const r = ROLES[roleKey];
        return { role: roleKey, name: r.name, hp: r.hp, maxHp: r.hp, block: 0, dead: false };
    },

    mapSelect() {
        events.emit('play-bgm', 'assets/BGM/Ravel_Gaspard de la Nuit.mp3'); 
        UI.switchScene('scene-map');
        events.emit('update-ui'); 
        
        const mapNum = document.getElementById('map-level-num');
        if(mapNum) mapNum.innerText = gameStore.level;

        // 如果没有地图数据，初始化生成
        if (this.mapGraph.length === 0) {
            this.generateSectorMap();
            // 保持在地图外状态，等待用户点击起点
            this.currentMapPos = { layer: -1, index: -1 }; 
        }

        // 渲染新版地图
        UI.renderMap(this.mapGraph, this.currentMapPos);
    },

    generateSectorMap() {
        // 生成 6 层结构 (0-5)
        // Layer 0: Start
        // Layer 1-4: Random (2-3 nodes)
        // Layer 5: Boss
        
        const layers = [];
        const DEPTH = 6;
        
        // Layer 0: Start
        layers.push([{ type: 'start', name: '起点', desc: '新的乐章开始', next: [] }]);
        
        // Middle Layers
        for(let d=1; d<DEPTH-1; d++) {
            const nodeCount = 2 + Math.floor(Math.random() * 2); // 2-3 nodes
            const layerNodes = [];
            for(let i=0; i<nodeCount; i++) {
                let type = 'battle';
                let rand = Math.random();
                // 概率随总进度略微变化，这里简化
                if (rand < 0.15) type = 'camp';
                else if (rand < 0.35) type = 'shop';
                else if (rand < 0.45 && d > 1) type = 'elite'; // 精英不出现在第1层
                else if (rand < 0.55 && gameStore.partyRoles.length < 4) type = 'recruit';
                else type = 'battle';
                
                let name = '遭遇战';
                if(type==='camp') name='营地';
                if(type==='shop') name='乐器店';
                if(type==='elite') name='精英战';
                if(type==='recruit') name='音乐厅';
                
                layerNodes.push({ type: type, name: name, next: [] });
            }
            layers.push(layerNodes);
        }
        
        // Layer 5: Boss
        layers.push([{ type: 'boss', name: '决战', desc: '最终考验', next: [] }]);
        
        // 建立连线 (从左向右)
        for(let d=0; d<DEPTH-1; d++) {
            const currentLayer = layers[d];
            const nextLayer = layers[d+1];
            
            // 1. 确保当前层每个节点至少连接一个下层节点
            currentLayer.forEach(node => {
                // 随机连接 1-2 个下层节点
                // 简单算法：根据索引映射，偏向于连接位置相近的
                // 将 range 映射到 [0, nextLayer.length-1]
                // 这里采用全随机连接，但为了避免交叉太乱，通常只连相邻索引
                
                // 简化策略：
                // 如果是 Start (1个)，连接所有下层节点 (或随机2个)
                if (d === 0) {
                    nextLayer.forEach((_, idx) => node.next.push(idx));
                } else {
                    // 随机选 1-2 个
                    const count = 1 + (Math.random() > 0.5 ? 1 : 0);
                    for(let k=0; k<count; k++) {
                        const targetIdx = Math.floor(Math.random() * nextLayer.length);
                        if(!node.next.includes(targetIdx)) node.next.push(targetIdx);
                    }
                }
            });
            
            // 2. 确保下层每个节点至少被一个上层节点连接 (防止孤岛)
            nextLayer.forEach((_, nIdx) => {
                const isConnected = currentLayer.some(node => node.next.includes(nIdx));
                if (!isConnected) {
                    // 强制连接一个上层节点
                    const parentIdx = Math.floor(Math.random() * currentLayer.length);
                    currentLayer[parentIdx].next.push(nIdx);
                }
            });
            
            // 排序 next 数组以防万一
            currentLayer.forEach(node => node.next.sort((a,b)=>a-b));
        }
        
        this.mapGraph = layers;
    },
    
    // createMapNode 已废弃，UI逻辑移至 ui.js 的 renderMap

    enterNode(type, layer, index) {
        // 更新位置
        this.currentMapPos = { layer: layer, index: index };
        
        // 如果是 Start 节点，刷新地图状态以显示下一层连接
        if (type === 'start') {
            this.mapSelect();
            return;
        } 

        if(type === 'recruit') {
            UI.switchScene('scene-recruit');
            setTimeout(() => UI.renderCharSelect('grid-recruit', (key) => this.recruit(key)), 100);
        } else if(type === 'camp') {
            this.showCamp();
        } else if(type === 'shop') {
            this.showShop();
        } else {
            this.startLevel(type);
        }
    },

    // ================= 商店系统 =================
    shopData: { cards:[], relics:[], services:[] },

    showShop() {
        UI.switchScene('scene-shop');
        
        // 生成商品
        this.shopData = { cards:[], relics:[], services:[] };

        // 1. 强化服务：从当前卡组中随机选 3 张可强化的卡
        const uniqueIds = [...new Set(battleStore.deck)].filter(id => gameStore.getCardLevel(id) < 5);
        // 随机打乱
        uniqueIds.sort(() => Math.random() - 0.5);
        
        // 取前 3 张 (如果不足 3 张则全取)
        const shopCards = uniqueIds.slice(0, 3);
        
        shopCards.forEach(id => {
            const currentLv = gameStore.getCardLevel(id);
            // 价格公式：基础 50 + 等级 * 25 (0->1: 50, 1->2: 75, 2->3: 100...)
            const price = 50 + currentLv * 25;
            this.shopData.cards.push({ id: id, price: price, sold: false, level: currentLv });
        });

        // 2. 生成 1 个遗物
        const allRelicKeys = Object.keys(RELICS).filter(k => !gameStore.relics.includes(k));
        if(allRelicKeys.length > 0) {
            const rKey = allRelicKeys[Math.floor(Math.random() * allRelicKeys.length)];
            this.shopData.relics.push({ key: rKey, price: 160, sold: false });
        }

        // 3. 服务
        this.shopData.services.push({ type:'remove', name:'忘却乐谱', desc:'从牌组中移除一张牌', price: 75, sold: false, icon:'assets/UI/banish_icon.png' });
        this.shopData.services.push({ type:'heal', name:'茶歇', desc:'全员恢复 30% 生命', price: 50, sold: false, icon:'assets/UI/heal_icon.png' });

        window.UI.renderShop(this.shopData);
        events.emit('update-ui');
    },

    buyItem(cat, idx) {
        let item = this.shopData[cat][idx];
        if(item.sold) return;
        if(gameStore.gold < item.price) {
            events.emit('toast', "金币不足!");
            return;
        }

        if(cat === 'cards') {
            gameStore.spendGold(item.price);
            // 强化逻辑
            gameStore.upgradeCard(item.id);
            events.emit('toast', `强化成功: ${CARDS[item.id].name} +${gameStore.getCardLevel(item.id)}`);
            item.sold = true;
        } else if (cat === 'relics') {
            gameStore.spendGold(item.price);
            gameStore.addRelic(item.key);
            events.emit('toast', `购买了 ${RELICS[item.key].name}`);
            // Note: sheet_music logic is now handled inside GameStore.addRelic
            item.sold = true;
        } else if (cat === 'services') {
            if (item.type === 'heal') {
                gameStore.spendGold(item.price);
                window.battle.allies.forEach(a => { 
                    if(a.dead) { a.dead = false; a.hp = Math.floor(a.maxHp * 0.3); } 
                    else { a.hp = Math.min(a.maxHp, a.hp + Math.floor(a.maxHp * 0.3)); } 
                });
                events.emit('toast', "全员恢复!");
                item.sold = true;
            } else if (item.type === 'remove') {
                // 移除卡牌需要选择界面，暂时简化为随机移除一张普通牌，或者弹窗选择
                // 为了体验，我们复用 deck modal，但在那里添加点击移除的功能比较复杂
                // 这里简化：显示所有卡牌列表供选择移除
                if (battleStore.deck.length <= 5) {
                    events.emit('toast', "卡组过薄，无法移除");
                    return;
                }
                // 这是一个异步操作流程，扣款在移除后发生
                UI.showDeckModal(battleStore.deck, "选择要移除的卡牌", (cardId, indexInDeck) => {
                    if(gameStore.gold >= item.price) {
                        gameStore.spendGold(item.price);
                        
                        const currentDeck = battleStore.deck;
                        currentDeck.splice(indexInDeck, 1);
                        battleStore.setDeck(currentDeck);
                        
                        events.emit('toast', "移除成功");
                        item.sold = true;
                        UI.closeDeckModal();
                        UI.renderShop(this.shopData);
                        events.emit('update-ui');
                    }
                });
                return; // 提前返回，等待回调刷新
            }
        }
        
        UI.renderShop(this.shopData);
        events.emit('update-ui');
    },

    leaveShop() {
        this.mapSelect();
    },

        startLevel(type, forceEnemyKeys = null) {
            try {
                window.battle.reset();
                window.battle.allies.forEach(a => { if(a.role==='cellist') a.block = 8; });
                if(gameStore.relics.includes('baton')) window.battle.manaData.current++;
    
                let enemiesToSpawn = [];
                let hpMult = 1;
                
                // 强制指定敌人 (Debug模式 / 包含多敌人支持)
                if (forceEnemyKeys) {
                    const keys = Array.isArray(forceEnemyKeys) ? forceEnemyKeys : [forceEnemyKeys];
                    keys.forEach(key => {
                        if (ENEMIES[key]) {
                            enemiesToSpawn.push({ data: ENEMIES[key], key });
                        }
                    });
                    
                    type = (type === 'debug') ? 'battle' : type; 
                    
                    // 简单的 BGM 映射 (取第一个敌人)
                    const firstKey = keys[0];
                    events.emit('stop-bgm');
                    if (firstKey === 'silence') events.emit('play-bgm', 'assets/BGM/Scythian Suite.mp3');
                    else if (firstKey === 'shihengwuzhe') events.emit('play-bgm', 'assets/BGM/Shostakovich_String Quartet.mp3');
                    else events.emit('play-bgm', 'assets/BGM/Bruckner.mp3');
                }
                else if (type === 'boss') { 
                    enemiesToSpawn.push({ data: ENEMIES.silence, key: 'silence' });
                    hpMult = 3; 
                    events.emit('play-bgm', 'assets/BGM/Scythian Suite.mp3'); 
                }
                else if (type === 'elite') { 
                    const elitePool = ['discord', 'shihengwuzhe'];
                    const key = elitePool[Math.floor(Math.random() * elitePool.length)];
                    enemiesToSpawn.push({ data: ENEMIES[key], key });
                    hpMult = 1.8; 
                    events.emit('stop-bgm'); 
                    if (key === 'shihengwuzhe') events.emit('play-bgm', 'assets/BGM/Shostakovich_String Quartet.mp3');
                    else if (key === 'discord') events.emit('play-bgm', 'assets/BGM/Mahler - Symphony.mp3');
                }
                else { 
                    const normalPool = ['noise', 'bayinhe', 'changshiban'];
                    const key = normalPool[Math.floor(Math.random() * normalPool.length)];
                    enemiesToSpawn.push({ data: ENEMIES[key], key });
                    hpMult = 1; 
                    events.emit('stop-bgm'); 
                    if (key === 'changshiban') events.emit('play-bgm', 'assets/BGM/bin ich nun frei.m4a');
                    else events.emit('play-bgm', 'assets/BGM/Bruckner.mp3'); 
                }
    
                const enemyList = enemiesToSpawn.map(item => {
                    const e = item.data;
                    const hpBase = (30 + gameStore.level * 8) * hpMult;
                    return { 
                        type: type, name: e.name, sprite: e.sprite,
                        hp: Math.floor(hpBase * e.hpScale), 
                        maxHp: Math.floor(hpBase * e.hpScale), 
                        block: 0, 
                        intent: {type:'atk', val:0}, stunned:false, buffs:{vuln:0, res:0, str:0}, acts: e.act 
                    };
                });
    
                battleStore.setEnemies(enemyList);
    
                if (typeof window.battle.planEnemy === 'function') {
                    window.battle.planEnemy();
                } else {
                    throw new Error("window.battle.planEnemy is missing!");
                }
    
                UI.switchScene('scene-battle');
                window.battle.phase = 'PREPARE';
                events.emit('render-battlefield');
                events.emit('update-ui');
                document.getElementById('prep-ui').style.display = 'block';
                document.getElementById('hand').style.display = 'none';
                document.getElementById('btn-end').style.display = 'none';
                document.getElementById('party-container').classList.add('interactive');
            } catch (e) {
                console.error("Start Level Error:", e);
                events.emit('toast', "进入战斗失败，请查看控制台");
            }
        },
    recruit(key) {
        if(gameStore.partyRoles.includes(key)) return;
        gameStore.recruitMember(key);
        const r = ROLES[key];
        
        window.battle.manaData.max += 1;
        window.battle.manaData.draw += 1;
        
        // 应用新队员被动
        if(key === 'violinist') window.battle.manaData.draw += 1;

        const currentAllies = battleStore.allies;
        currentAllies.push(this.createAlly(key));
        battleStore.setAllies(currentAllies);
        
        // Update deck via store
        const currentDeck = battleStore.deck;
        currentDeck.push(...r.deck);
        battleStore.setDeck(currentDeck);
        
        if(key === 'vocalist') window.battle.allies.forEach(a => a.maxHp += 15);

        this.checkDuo();
        events.emit('toast', `${r.name} 加入! 手牌上限+1`);
        setTimeout(() => this.mapSelect(), 1000); 
        gameStore.nextLevel();
    },

    checkDuo() {
        DUO_CARDS.forEach(d => {
            const hasAll = d.req.every(r => gameStore.partyRoles.includes(r));
            if(hasAll) {   
                // 提示
            }
        });
    },

    showCamp() {
        UI.switchScene('scene-camp');
    },

    getSmartRewards() {
        const validCards = DUO_CARDS.filter(c => {
            return c.req.every(r => gameStore.partyRoles.includes(r));
        }).map(c => c.id);
        
        if (validCards.length === 0) return []; 

        const rewards = [];
        const pool = [...validCards];
        for(let i=0; i<3; i++) {
            if(pool.length === 0) break;
            const randIdx = Math.floor(Math.random() * pool.length);
            rewards.push(pool[randIdx]);
            pool.splice(randIdx, 1);
        }
        return rewards;
    },

    campAction(type) {
        if(type === 'heal') {
            window.battle.allies.forEach(a => { 
                if(a.dead) { a.dead = false; a.hp = Math.floor(a.maxHp * 0.3); } 
                else { a.hp = Math.min(a.maxHp, a.hp + Math.floor(a.maxHp * 0.3)); } 
            });
            events.emit('toast', `休整完成`);
        } else if (type === 'card') {
            UI.switchScene('scene-reward'); 
            UI.renderRewards('new'); 
            return; 
        } else if (type === 'upgrade') {
            let uniqueIds = [...new Set([...battleStore.deck])];
            let picks = [];
            if(uniqueIds.length > 0) {
                for(let i=0; i<2; i++) {
                    if(uniqueIds.length === 0) break;
                    const idx = Math.floor(Math.random() * uniqueIds.length);
                    const id = uniqueIds[idx];
                    
                    // 检查等级上限 5
                    if (gameStore.getCardLevel(id) >= 5) {
                        uniqueIds.splice(idx, 1);
                        i--; // 重试
                        continue;
                    }

                    gameStore.upgradeCard(id);
                    const level = gameStore.getCardLevel(id);
                    picks.push(CARDS[id].name + (level>0 ? `+${level}` : ''));
                    uniqueIds.splice(idx, 1);
                }
                if (picks.length > 0) events.emit('toast', `技艺精进: ${picks.join(', ')}`);
                else events.emit('toast', "所有技能已达化境 (Max 5)");
            }
        } else if (type === 'relic') {
            const allKeys = Object.keys(RELICS);
            const available = allKeys.filter(k => !gameStore.relics.includes(k));
            if(available.length > 0) {
                const rKey = available[Math.floor(Math.random() * available.length)];
                gameStore.addRelic(rKey);
                events.emit('toast', `获得圣物: ${RELICS[rKey].name}`);
                // Note: sheet_music handled in store
            } else {
                window.battle.allies.forEach(a => { a.maxHp += 10; a.hp += 10; });
                events.emit('toast', "获得: 天使之羽 (全属性提升)");
            }
        }
        
        setTimeout(() => {
            gameStore.nextLevel();
            this.mapSelect();
        }, 1200);
    },
    
    finishReward() {
        gameStore.nextLevel();
        this.mapSelect();
    },

    showDeck() {
        const isInBattle = document.getElementById('scene-battle').classList.contains('active');
        let fullDeck = [];
        if (isInBattle) {
            fullDeck = [...battleStore.deck, ...battleStore.hand, ...battleStore.discard];
        } else {
            fullDeck = battleStore.deck;
        }
        UI.showDeckModal(fullDeck, `当前卡组 (${fullDeck.length})`);
    },

    closeDeck() {
        UI.closeDeckModal();
    },
    
    previewDeck(roleKey, type) {
        const r = ROLES[roleKey];
        let cardList = [];
        if (type === 'start') {
            cardList = [...COMMON_DECK, ...r.deck];
        } else {
            cardList = [...r.deck];
        }
        UI.showDeckModal(cardList, `${r.name} - 技能预览`);
    },

    // ================= 开发者模式 =================
    debugEnemiesQueue: [],

    openDebugMenu() {
        UI.switchScene('scene-debug');
        
        // 确保有基本的 Store 状态 (如果没点过开始直接进 Debug)
        if(gameStore.partyRoles.length === 0) {
            gameStore.initGame('pianist');
            battleStore.reset();
            battleStore.setAllies([ this.createAlly('pianist') ]);
            const r = ROLES['pianist'];
            battleStore.setDeck([...COMMON_DECK, ...r.deck]);
        }

        this.renderDebugUI();
    },

    renderDebugUI() {
        // 渲染我方当前队伍
        const partyList = document.getElementById('debug-party-list');
        partyList.innerHTML = '';
        gameStore.partyRoles.forEach(roleKey => {
            const r = ROLES[roleKey];
            const d = document.createElement('div');
            d.className = 'relic'; // 复用圆形图标样式
            d.style.width = '50px'; d.style.height = '50px'; d.style.fontSize = '1.5em';
            d.innerHTML = `<img src="${r.sprite}" style="width:100%;height:100%;object-fit:contain;filter:brightness(1.5);">`;
            d.title = r.name;
            partyList.appendChild(d);
        });

        // 渲染角色池
        const rolePool = document.getElementById('debug-role-pool');
        rolePool.innerHTML = '';
        Object.keys(ROLES).forEach(key => {
            if (gameStore.partyRoles.includes(key)) return;
            const r = ROLES[key];
            const btn = document.createElement('button');
            btn.className = 'top-btn';
            btn.style.fontSize = '0.8em';
            btn.innerText = `+ ${r.name}`;
            btn.onclick = () => { this.debugAddRole(key); };
            rolePool.appendChild(btn);
        });

        // 渲染待战敌人队列
        const queueEl = document.getElementById('debug-enemy-queue');
        queueEl.innerHTML = '';
        this.debugEnemiesQueue.forEach((enemyKey, idx) => {
            const e = ENEMIES[enemyKey];
            const d = document.createElement('div');
            d.className = 'relic';
            d.style.borderColor = '#e67e22';
            d.innerHTML = `<img src="${e.sprite}" style="width:80%;height:80%;object-fit:contain;">`;
            d.onclick = () => { this.debugEnemiesQueue.splice(idx, 1); this.renderDebugUI(); };
            queueEl.appendChild(d);
        });

        // 渲染敌人候选池
        const enemyPool = document.getElementById('debug-enemy-pool');
        enemyPool.innerHTML = '';
        Object.keys(ENEMIES).forEach(key => {
            const e = ENEMIES[key];
            const btn = document.createElement('div');
            btn.className = 'char-card';
            btn.style.width = '100px'; btn.style.height = '120px'; btn.style.padding = '5px';
            btn.innerHTML = `
                <img src="${e.sprite}" style="height:60px; object-fit:contain;">
                <div style="font-size:0.7em; margin-top:5px;">${e.name}</div>
            `;
            btn.onclick = () => { this.debugEnemiesQueue.push(key); this.renderDebugUI(); };
            enemyPool.appendChild(btn);
        });
    },

    debugAddRole(key) {
        if (gameStore.partyRoles.length >= 4) {
            events.emit('toast', "队伍已满 (上限4人)");
            return;
        }
        gameStore.recruitMember(key);
        const r = ROLES[key];
        
        // 更新战斗 Store 中的队友
        const currentAllies = battleStore.allies;
        currentAllies.push(this.createAlly(key));
        battleStore.setAllies(currentAllies);
        
        // 更新卡组
        const currentDeck = battleStore.deck;
        currentDeck.push(...r.deck);
        battleStore.setDeck(currentDeck);
        
        this.renderDebugUI();
    },

    debugClearParty() {
        gameStore.clearParty();
        battleStore.setAllies([]);
        battleStore.setDeck([]);
        this.renderDebugUI();
    },

    debugStartBattle() {
        if (gameStore.partyRoles.length === 0) {
            events.emit('toast', "请先添加至少一名演奏者");
            return;
        }
        if (this.debugEnemiesQueue.length === 0) {
            events.emit('toast', "请先添加至少一个敌人");
            return;
        }

        // 调用改造后的 startLevel
        this.startLevel('debug', this.debugEnemiesQueue);
    }
};