import { events } from './eventBus.js';
import { EffectProcessor } from './EffectProcessor.js';
import { gameStore } from './store/GameStore.js';
import { battleStore } from './store/BattleStore.js';
import { TimerManager } from './utils/TimerManager.js';
import { TacticManager } from './TacticManager.js';
import { UI } from './ui.js';
import { CARDS } from './data/cards.js';

// ================= 战术管理器 =================
// Moved to src/TacticManager.js

// ================= 战斗系统 =================
export const battle = {
    // --- State Proxies (The Magic) ---
    // These getters ensure that legacy code (and UI) reading 'window.battle.enemy' 
    // actually gets the data from the store.
    get allies() { return battleStore.allies; },
    get enemies() { return battleStore.enemies; },
    get enemy() { return battleStore.enemies[0]; }, // Compatibility for single enemy logic
    get manaData() { return battleStore.mana; }, // Map manaData -> store.mana
    get playerDeck() { return battleStore.deck; },
    set playerDeck(val) { battleStore.setDeck(val); }, // Setter for initialization assignments
    get hand() { return battleStore.hand; },
    set hand(val) { battleStore.setHand(val); },
    get discard() { return battleStore.discard; },
    set discard(val) { battleStore.setDiscard(val); },
    
    get phase() { return battleStore.phase; },
    set phase(val) { battleStore.setPhase(val); },
    
    get turnCount() { return battleStore.turnCount; },
    get selectedCard() { return battleStore.state.selectedCardIdx; },
    set selectedCard(val) { battleStore.selectCard(val); },
    
    // Direct state access for specific logic (proxying store state)
    get attacksPlayed() { return battleStore.state.attacksPlayed; },
    set attacksPlayed(val) { battleStore.state.attacksPlayed = val; }, // Not ideal but allowed for now
    
    get crescendoStacks() { return battleStore.state.crescendoStacks; },
    get variationBonus() { return battleStore.state.variationBonus; },
    set variationBonus(val) { battleStore.state.variationBonus = val; },
    
    get manaSpentTurn() { return battleStore.state.manaSpentTurn; },
    get firstCardPlayed() { return battleStore.state.firstCardPlayed; },
    
    get tempStrDebuff() { return battleStore.state.tempStrDebuff; },
    set tempStrDebuff(val) { battleStore.state.tempStrDebuff = val; },

    // Relic proxies
    get lastCardType() { return battleStore.state.relicState.lastCardType; },
    set lastCardType(val) { battleStore.state.relicState.lastCardType = val; },
    get bachCounter() { return battleStore.state.relicState.bachCounter; },
    set bachCounter(val) { battleStore.state.relicState.bachCounter = val; },
    get mozartTriggered() { return battleStore.state.relicState.mozartTriggered; },
    set mozartTriggered(val) { battleStore.state.relicState.mozartTriggered = val; },

    tm: new TimerManager(),

    reset() {
        this.tm.clearAll();
        events.emit('clear-log');
        battleStore.reset();
    },

    getFrontAlly() { 
        for (let i = this.allies.length - 1; i >= 0; i--) {
            if (!this.allies[i].dead) return this.allies[i];
        }
        return null;
    },


    getCardCost(cardId) {
        const card = CARDS[cardId];
        if (!card) return 0;
        let cost = card.cost;
        
        // Flutist Passive: First card each turn costs 0
        if (!this.firstCardPlayed && gameStore.partyRoles.includes('flutist')) {
            return 0;
        }
        
        // Paganini's Broken String: First Attack costs -1
        if (!this.firstCardPlayed && card.type === 'atk' && gameStore.relics.includes('paganini_string')) {
            cost = Math.max(0, cost - 1);
        }

        // Conductor Passive: Duo/Trio cards cost -1
        if ((card.type === 'duo' || card.type === 'trio') && gameStore.partyRoles.includes('conductor')) {
            cost = Math.max(0, cost - 1);
        }
        return cost;
    },

    isCardPlayable(card) {
        if(card.type === 'duo' || card.type === 'trio') {
            return card.req.every(r => { const a = this.allies.find(al => al.role === r); return a && !a.dead; });
        } else if (card.owner && card.owner !== 'common') {
            const a = this.allies.find(al => al.role === card.owner);
            return a && !a.dead;
        }
        return true; 
    },

    startActualBattle() {
        document.getElementById('prep-ui').style.display = 'none';
        document.getElementById('hand').style.display = 'flex';
        document.getElementById('btn-end').style.display = 'block';
        document.getElementById('party-container').classList.remove('interactive');
        TacticManager.selectedIdx = -1; 
        events.emit('render-battlefield');
        this.startTurn();
    },

    async startTurn() {
        battleStore.setProcessing(true); // 锁定
        battleStore.setPhase('PLAYER');
        battleStore.nextTurn(); // Increments turnCount, resets stats
        
        // --- 护盾衰减逻辑 (移至此处，确保在敌人攻击之后结算) ---
        // 仅在第 2 回合及以后执行衰减（第 1 回合为初始状态，不衰减）
        if (this.turnCount > 1) {
            this.allies.forEach(a => {
                let keep = gameStore.relics.includes('tuning_fork') ? 10 : 0;
                if (a.retainBlock) { 
                    keep = a.block; 
                    a.retainBlock = false; 
                }
                a.block = Math.max(0, Math.floor(a.block/2), Math.min(a.block, keep));
            });
        }

        events.emit('log', { msg: `=== 第 ${this.turnCount} 回合 ===`, type: 'turn' });

        battleStore.resetMana();
        if (this.turnCount === 1 && gameStore.relics.includes('baton')) {
            battleStore.modifyMana(1);
            events.emit('toast', "指挥棒: 灵感+1");
        }

        document.getElementById('btn-end').disabled = true; // 初始禁用，等待抽牌结束
        await this.drawCards(this.manaData.draw);
        
        battleStore.setProcessing(false); // 解锁
        document.getElementById('btn-end').disabled = false;
        events.emit('update-ui');
    },

    async drawCards(n) {
        const drawn = [];
        // Need to work with store arrays. We get copies/references from the proxy.
        // Since proxy returns the actual array reference from store.state, mutation works 
        // but we should be careful. Ideally we use setters.
        let currentDeck = this.playerDeck;
        let currentDiscard = this.discard;
        let currentHand = this.hand;

        for(let i=0; i<n; i++) {
            if(!currentDeck.length) {
                if(!currentDiscard.length) break;
                // Reshuffle
                currentDeck = currentDiscard.sort(()=>Math.random()-0.5);
                currentDiscard = [];
                // Update store
                battleStore.setDeck(currentDeck);
                battleStore.setDiscard(currentDiscard);
            }
            const c = currentDeck.pop();
            currentHand.push(c);
            drawn.push(c);
            
            // 逐张更新 Store，触发 UI 逐张渲染
            battleStore.setHand(currentHand);
            // 播放抽牌音效 (可选)
            // events.emit('play-sound', 'assets/BGM/page-flip.mp3'); 
            
            // 暂停一小会，制造视觉间隔
            await window.wait(150);
        }
        return drawn;
    },

    selectCard(idx) {
        if(this.phase !== 'PLAYER') return;
        const id = this.hand[idx];
        const cardData = window.CARDS[id];
        if(!this.isCardPlayable(cardData)) { events.emit('toast', "角色已阵亡!"); return; }
        
        const cost = this.getCardCost(id);
        if(this.manaData.current < cost) { events.emit('toast', "灵感不足"); return; }
        
        // 如果是需要指向的卡牌 (攻击/Debuff/特殊单体)，进入选中模式，等待点击目标
        if(cardData.type === 'atk' || cardData.type === 'debuff' || cardData.type === 'spec' || cardData.eff === 'boom' || cardData.eff === 'bash') {
            if(this.selectedCard === idx) this.deselect(); else { this.selectedCard = idx; events.emit('update-ui'); }
        } else { 
            // 不需要指向的卡牌 (AOE, Buff, Draw等)，直接打出
            this.playCard(idx, 0); 
        }
    },

    targetEnemy(idx) { 
        if (this.selectedCard === -1) return;
        const id = this.hand[this.selectedCard];
        const card = window.CARDS[id];

        // 1. 如果 UI 传了明确的 idx (点击触发)
        if (typeof idx === 'number') {
            const target = this.enemies[idx];
            if (!target || target.hp <= 0) {
                events.emit('toast', "目标已倒下");
                return;
            }
            this.playCard(this.selectedCard, idx);
        } else {
            // 2. 如果没传 (从悬停状态获取)
            const hoverIdx = document.body.getAttribute('data-hover-enemy-idx');
            if (hoverIdx !== null) {
                const hIdx = parseInt(hoverIdx);
                const target = this.enemies[hIdx];
                if (target && target.hp > 0) {
                    this.playCard(this.selectedCard, hIdx);
                    return;
                }
            }
            
            // 3. 兜底/重定向逻辑 (针对不需要精准指向的卡牌)
            if (card.tag === 'aoe' || card.type === 'skill' || card.type === 'power') {
                this.playCard(this.selectedCard, 0);
            } else {
                // 单体攻击：尝试寻找第一个活着的敌人
                const firstAliveIdx = this.enemies.findIndex(e => e.hp > 0);
                if (firstAliveIdx !== -1) {
                    this.playCard(this.selectedCard, firstAliveIdx);
                } else {
                    this.deselect();
                }
            }
        }
    },

    async playCard(idx, targetIdx = 0) {
        if (battleStore.state.processing) return; // 双重保险
        battleStore.setProcessing(true); // 锁定

        const id = this.hand[idx];
        const card = window.CARDS[id];
        
        const cost = this.getCardCost(id);
        
        // 视觉反馈：如果是灵风行者的被动生效
        if (!this.firstCardPlayed && gameStore.partyRoles.includes('flutist') && card.cost > 0) {
            events.emit('float-text', { text: "灵风：0费出牌", targetId: `hand`, color: '#4dabf7' });
        }

        // Use Store to record play stats
        battleStore.recordCardPlay(card, cost);
        
        // --- 触发卡牌打出动画 ---
        // 在逻辑移除前通知 UI 播放动画，让 UI 克隆一个残影去飞
        events.emit('animate-card-play', { card, handIndex: idx });

        // --- 特殊逻辑预处理 ---
        // 尾声：需要在弃牌前计算手牌数（包含自身）
        let bonusVal = 0;
        if (card.eff === 'hand_scale') {
            // 计算当前手牌数（包含这张牌本身，因为还没弃掉）
            bonusVal = this.hand.length * 3; 
        }

        // Move card from Hand to Discard
        const h = this.hand;
        h.splice(idx, 1); 
        battleStore.setHand(h);
        
        const d = this.discard;
        d.push(id);
        battleStore.setDiscard(d);

        this.deselect();
        
        events.emit('log', { msg: `打出: <b>${card.name}</b>`, type: 'card' });

        // 音效提前播放
        if (card.eff === 'stun') events.emit('play-sound', 'assets/特大鼓重击.mp3');
        if (card.eff === 'catastrophe' || card.name === '毁灭交响') events.emit('play-sound', 'assets/巨大轰鸣爆炸.mp3');
        if (card.name === '休止符' || card.name === '起拍') events.emit('play-sound', 'assets/BGM/accordion-attack.wav');
        if (card.name === '变奏' || card.name === '拨奏') events.emit('play-sound', 'assets/BGM/unsheathed-blade.ogg');
        if (card.name === '急板' || card.name === '运弓') events.emit('play-sound', 'assets/BGM/sword-01.wav');
        if (card.name === '震荡号角' || card.name === '高爆音符') events.emit('play-sound', 'assets/BGM/shipboard_railgun.mp3');
        if (card.name === '热情' || card.name === '尾声') events.emit('play-sound', 'assets/BGM/horror-piano-chord.mp3');
        if (card.name === '不协和') events.emit('play-sound', 'assets/BGM/violin-scare.wav');
        if (card.name === '低吟' || card.name === '重奏' || card.name === '琴弦壁垒') events.emit('play-sound', 'assets/BGM/piano-string-glissando-low-a.wav');

        let triggers = 1;
        // 检测任何带 atk 标签的牌
        // Note: attacksPlayed is already updated in recordCardPlay, but logic here checks if it was 0 BEFORE play
        // Wait, recordCardPlay updates it instantly. 
        // We need to check if this was the *first* attack.
        // Actually, attacksPlayed increments. If current is 1, it means this was the first.
        if (card.tag === 'atk' && gameStore.relics.includes('metronome') && this.attacksPlayed === 1) {
            triggers = 2;
            events.emit('toast', "节拍器: 双重奏!");
        }
        
        if (card.tag === 'atk') {
            if (gameStore.relics.includes('rosin')) {
                // 如果是单体，给目标。如果是 AOE，给所有人
                if (card.tag === 'aoe') {
                    this.enemies.forEach(e => e.buffs.vuln += 1);
                } else {
                    const e = this.enemies[targetIdx];
                    if (e) e.buffs.vuln += 1;
                }
            }
        }

        let caster = this.allies.find(a => a.role === card.owner);
        if(!caster) caster = this.getFrontAlly();

        // --- 播放角色动作动画 (攻击/技能) ---
        if (caster) {
            const charEl = document.getElementById(`char-${caster.role}`);
            if (charEl) {
                const sprite = charEl.querySelector('.musician-sprite');
                if (sprite) {
                    let animToPlay = null;
                    let duration = 0;

                    // 1. 专属卡牌逻辑 (Exclusive Card)
                    if (card.owner === caster.role) {
                        // Brass: 仅攻击牌播放攻击动画
                        if (caster.role === 'brass' && card.type === 'atk') {
                            animToPlay = 'anim-brass-atk';
                            duration = 800;
                        }
                        // Cellist: 所有专属牌 (低吟、重奏、琴弦壁垒) 播放强化动画
                        else if (caster.role === 'cellist') {
                            animToPlay = 'anim-cellist-buff';
                            duration = 1200;
                        }
                    }

                    // 2. 通用攻击逻辑 (Fallback)
                    // 如果没有触发专属动画，且是攻击牌，播放通用攻击动作
                    if (!animToPlay && card.type === 'atk') {
                        animToPlay = 'anim-generic-atk';
                        duration = 300;
                    }

                    // 执行动画
                    if (animToPlay) {
                        // 先移除所有可能的动画类，防止冲突
                        sprite.classList.remove('anim-brass-atk', 'anim-generic-atk', 'anim-cellist-buff');
                        
                        // 暂时移除呼吸动画，防止冲突和时序问题
                        sprite.classList.remove('idle-breathe');
                        
                        void sprite.offsetWidth; // 强制重绘
                        sprite.classList.add(animToPlay);
                        
                        // 动画结束后清理并恢复呼吸
                        setTimeout(() => {
                            sprite.classList.remove(animToPlay);
                            sprite.classList.add('idle-breathe');
                        }, duration);
                    }
                }
            }
        }

        const level = gameStore.cardLevels[id] || 0;
        let mult = 1 + (0.5 * level);
        
        // 变奏效果：数值加成 (基础50% + 强化)
        if (this.variationBonus > 0) {
            mult += this.variationBonus;
            events.emit('float-text', { text: `变奏 +${Math.round(this.variationBonus*100)}%!`, targetId: `char-${caster.role}`, color: '#f0c040' });
            this.variationBonus = 0; // 消耗效果
        }

        let val = card.val;
        
        // 贝多芬的失聪耳蜗：HP < 30% 伤害翻倍
        if (gameStore.relics.includes('beethoven_ear') && caster.hp < caster.maxHp * 0.3 && card.type === 'atk') {
            val *= 2;
            events.emit('float-text', { text: "命运咆哮!", targetId: `char-${caster.role}`, color: '#e74c3c' });
        }

        // 渐强：基础伤害 + 战斗中累计层数
        if (card.eff === 'crescendo') {
            val += this.crescendoStacks;
        }

        // Brass Passive: High cost cards deal +5 damage
        if (card.cost >= 2 && gameStore.partyRoles.includes('brass') && card.type === 'atk') {
            val += 5;
        }
        
        // Percussionist Passive: All attacks deal +2 damage
        if (card.type === 'atk' && gameStore.partyRoles.includes('percussionist')) {
            val += 2;
        }

        if(val > 0) val = Math.ceil(val * mult);

        // 执行多次
        // 为了确保 processing 锁在所有异步动画完成后才解开，我们需要重构这里的逻辑
        // 我们需要等待所有的 executeCardEffect 完成
        
        const executionPromises = [];
        for(let t=0; t<triggers; t++) {
             // 我们给每次触发加一个微小的延时，让它们依次发生，但我们需要把 Promise 存起来
             const p = new Promise(resolve => {
                 setTimeout(async () => {
                     await this.executeCardEffect(card, caster, val, mult, bonusVal, targetIdx);
                     resolve();
                 }, t * 300);
             });
             executionPromises.push(p);
        }
        
        // 等待所有触发完成
        // 注意：这里的 setTimeout 并发模型比较简单，Promise.all 可能不会按严格顺序等待内部动画
        // 但 executeCardEffect 内部是 await 的。
        // 为了简单起见，我们等待最长的一个 Promise 链
        
        await Promise.all(executionPromises);

        // 帕格尼尼的断弦：首张攻击自伤
        if (this.attacksPlayed === 1 && gameStore.relics.includes('paganini_string') && card.type === 'atk') {
            caster.hp -= 2;
            events.emit('float-text', { text: "-2", targetId: `char-${caster.role}`, color: '#888' });
            if (caster.hp <= 0) { caster.hp=0; caster.dead=true; }
        }

        // 巴赫的赋格透镜
        if (gameStore.relics.includes('bach_lens')) {
            if (this.lastCardType === card.type) {
                this.bachCounter++;
                if (this.bachCounter >= 3) {
                    await this.drawCards(1); // Ensure draw is awaited
                    this.manaData.current++;
                    events.emit('toast', "赋格透镜: 完美对位!");
                    this.bachCounter = 0; // 重置还是保留？通常重置
                }
            } else {
                this.lastCardType = card.type;
                this.bachCounter = 1;
            }
        }
        
        battleStore.setProcessing(false); // 解锁
        events.emit('update-ui');
    },

    async executeCardEffect(card, caster, val, mult, bonusVal = 0, targetIdx = 0) {
        // 纯数据驱动逻辑 (Data-Driven)
        if (card.effects && Array.isArray(card.effects)) {
            for (const effect of card.effects) {
                await this.processEffect(effect, caster, mult, val, bonusVal, targetIdx);
            }
        } else {
            console.warn(`Card ${card.name} (ID: ${card.id}) has no effects configuration.`);
        }
        events.emit('update-ui');
    },

    async processEffect(eff, caster, mult, cardVal, bonusVal, targetIdx) {
        // 计算数值
        let val = eff.val !== undefined ? eff.val : cardVal;
        
        // 缩放逻辑
        if (eff.scale) {
            if (eff.val !== undefined) {
                // 如果是效果内置数值，需要乘倍率
                val = Math.ceil(val * mult);
            } else {
                // 如果是继承卡牌数值，它已经被 playCard 乘过一次了，不再乘
                val = cardVal; 
                if (bonusVal > 0) val += bonusVal;
            }
        }

        // 统一处理延迟 (Delay)
        if (eff.delay) {
            await window.wait(eff.delay);
        }

        // AOE 逻辑支持
        if (eff.target === 'all') {
            if (eff.type === 'dmg' || eff.type === 'status') {
                for (let i = 0; i < this.enemies.length; i++) {
                    if (this.enemies[i].hp > 0) {
                        const copy = {...eff, _tempTargetIdx: i};
                        await EffectProcessor.execute(this, copy, caster, val, mult);
                    }
                }
                return;
            }
        }

        // 正常单体逻辑
        eff._tempTargetIdx = targetIdx;
        await EffectProcessor.execute(this, eff, caster, val, mult);
    },

    dmgEnemy(val, isPierce = false, targetIdx = 0) {
        if(this.phase === 'VICTORY') return;
        const target = this.enemies[targetIdx];
        if (!target || target.hp <= 0) return;

        // 易伤计算
        if (target.buffs.vuln > 0) {
            val = Math.floor(val * 1.5);
        }

        let dmg = val;
        // 护盾抵消逻辑 (非穿透伤害)
        if (!isPierce && target.block > 0) {
            let blocked = Math.min(target.block, dmg);
            target.block -= blocked;
            dmg -= blocked;
            if(blocked > 0) events.emit('float-text', { text: "格挡", targetId: (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`), color: '#3498db' });
        }

        target.hp = Math.max(0, target.hp - dmg);
        if(dmg > 0) {
            events.emit('float-text', { text: `-${dmg}`, targetId: (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`), color: '#ff6b6b' });
            events.emit('log', { msg: `对 ${target.name} 造成 ${dmg} 伤害`, type: 'dmg' });
        }
        if(dmg > 10) events.emit('shake');
        
        // 死亡检测与动画标记
        if (target.hp <= 0 && !target.dead) {
            target.dead = true;
            target.isDying = true; // 开启死亡动画标记
            // 动画结束后，将 isDying 设为 false，防止重绘时重复播放
            setTimeout(() => {
                target.isDying = false;
                events.emit('update-ui'); // 再次触发 UI 切换到 dead-static
            }, 1200);
        }

        events.emit('update-ui');
        if(this.enemies.every(e => e.hp <= 0)) this.win();
    },

    healAll(val) {
        this.allies.forEach(a => { if(!a.dead) { a.hp = Math.min(a.maxHp, a.hp + val); events.emit('float-text', { text: `+${val}`, targetId: `char-${a.role}`, color: '#2ecc71' }); } });
        events.emit('log', { msg: `[治疗] 全员恢复 ${val} HP`, type: 'heal' });
        events.emit('update-ui');
    },
    
    healPlayer(val) {
        let target = this.allies.filter(a=>!a.dead).sort((a,b)=>(a.hp/a.maxHp)-(b.hp/b.maxHp))[0];
        if(target) { 
            target.hp = Math.min(target.maxHp, target.hp + val); 
            events.emit('float-text', { text: `+${val}`, targetId: `char-${target.role}`, color: '#2ecc71' }); 
            events.emit('log', { msg: `[治疗] ${target.name} 恢复 ${val} HP`, type: 'heal' });
        }
        events.emit('update-ui');
    },

    addBlockAll(val) { 
        this.allies.forEach(a => { if(!a.dead) a.block += val; }); 
        events.emit('log', { msg: `[护盾] 全员获得 ${val} 护盾`, type: 'block' });
        events.emit('play-sound', 'assets/BGM/shield.wav');
        events.emit('update-ui'); 
    },

    win() {
        this.phase = 'VICTORY'; // Keep local setter triggering store setter via proxy
        this.tm.clearAll();
        events.emit('stop-bgm'); 
        events.emit('play-sound', 'assets/BGM/victory.wav'); 
        
        // Merge piles
        const deck = this.playerDeck.concat(this.hand, this.discard);
        battleStore.setDeck(deck);
        battleStore.setHand([]);
        battleStore.setDiscard([]);

        // 金币奖励计算
        let goldGain = 20 + Math.floor(Math.random() * 10); // 普通: 20-30
        if (this.enemy.type === 'elite') goldGain = 50 + Math.floor(Math.random() * 15);
        if (this.enemy.type === 'boss') goldGain = 100;
        
        gameStore.addGold(goldGain);
        
        // 如果是 Boss 战胜利，清空地图数据以便生成下一章
        if (this.enemy.type === 'boss') {
            window.game.mapGraph = [];
        }

        if(gameStore.level % 5 === 0) events.emit('toast', "BOSS 击破! 完美演出!");
        setTimeout(() => {
            if (this.enemy.type === 'battle') {
                UI.switchScene('scene-reward');
                // 传递金币信息给 UI
                UI.renderUpgradeRewards(goldGain);
            } else {
                events.emit('toast', `获得金币: ${goldGain}`);
                // 非战斗节点(虽然这里是win所以肯定刚打完)
                // 精英战后直接给奖励 (圣物)
                if (this.enemy.type === 'elite') window.game.campAction('relic');
                // Boss 战后也给奖励 (圣物)
                else if (this.enemy.type === 'boss') window.game.campAction('relic');
            }
        }, 1000);
    },

    endTurn() {
        if (battleStore.state.processing) return; // 如果正在播放动画，禁止结束回合
        
        this.phase = 'ENEMY_TURN';
        document.getElementById('btn-end').disabled = true;
        
        const d = this.discard.concat(this.hand);
        battleStore.setDiscard(d);
        battleStore.setHand([]);
        
        events.emit('update-ui');
        this.tm.add(() => this.enemyAction(), 800);
    },

    async enemyAction() {
        if(this.phase === 'VICTORY') return;
        
        if(gameStore.partyRoles.includes('vocalist')) this.healAll(5);

        // 遍历所有存活敌人依次行动
        for (let i = 0; i < this.enemies.length; i++) {
            const enemy = this.enemies[i];
            if (enemy.hp <= 0) continue;

            // 敌人行动开始：重置当前敌人护盾
            enemy.block = 0;
            
            const spriteId = (i === 0 ? 'sprite-enemy' : `sprite-enemy-${i}`);
            const eSprite = document.getElementById(spriteId);

            if (!enemy.stunned) {
                let intentType = enemy.intent.type;
                let intentVal = enemy.intent.val;

                // --- 攻击类行动 ---
                if(intentType === 'atk' || intentType === 'atk_heavy' || intentType === 'atk_vuln') {
                    
                    if(eSprite) {
                        let animClass = 'anim-enemy-atk';
                        if (enemy.name === "失律卫士") animClass = 'anim-knight-attack';
                        if (enemy.name === "失衡舞者") animClass = 'anim-dancer-attack';
                        if (enemy.name === "寂静指挥家") animClass = 'anim-demon-cast';
                        if (enemy.name === "恶意八音盒") animClass = 'anim-bayinhe-attack';
                        if (enemy.name === "杂音唱诗班") animClass = 'anim-choir-attack';
                        if (enemy.name === "杂音微粒") animClass = 'anim-slime-atk';
                        
                        const targetUnit = this.getFrontAlly();
                        const tEl = targetUnit ? document.getElementById(`char-${targetUnit.role}`) : null;
                        if (tEl) {
                            const eRect = eSprite.getBoundingClientRect();
                            const tRect = tEl.getBoundingClientRect();
                            const dist = (tRect.left - eRect.left) + 60; 
                            eSprite.style.setProperty('--attack-dist', `${dist}px`);
                        }

                        eSprite.classList.remove('anim-knight-attack', 'anim-dancer-attack', 'anim-demon-cast', 'anim-bayinhe-attack', 'anim-choir-attack', 'anim-enemy-atk', 'anim-slime-atk');
                        eSprite.classList.remove('enemy-idle-breathe');
                        void eSprite.offsetWidth; 
                        eSprite.classList.add(animClass);
                        
                        // 动画结束后清理并恢复呼吸
                        const animDuration = (enemy.name === "寂静指挥家" || enemy.name === "恶意八音盒") ? 1500 : 1200;
                        setTimeout(() => {
                            eSprite.classList.remove(animClass);
                            eSprite.classList.add('enemy-idle-breathe');
                        }, animDuration);

                        if (enemy.name === "失律卫士") events.emit('play-sound', 'assets/BGM/monster.wav');
                    }

                    // 结算延迟 (匹配关键帧)
                    let hitDelay = 600;
                    if (enemy.name === "失律卫士") hitDelay = 710;
                    if (enemy.name === "失衡舞者") hitDelay = 450;
                    if (enemy.name === "寂静指挥家") hitDelay = 750;
                    if (enemy.name === "恶意八音盒") hitDelay = 750;
                    if (enemy.name === "杂音唱诗班") hitDelay = 480;
                    if (enemy.name === "杂音微粒") hitDelay = 600;

                    await window.wait(hitDelay);
                    
                    if(this.phase === 'VICTORY') return;

                    let dmg = parseInt(intentVal) + parseInt(enemy.buffs.str || 0);
                    let target = this.getFrontAlly();
                    
                    if(target) {
                        // 播放特定敌人的音效和受击特效
                        if (enemy.name === "杂音唱诗班") {
                            events.emit('spawn-vfx', { type: 'Psychic_Shriek', targetId: spriteId });
                            events.emit('play-sound', 'assets/BGM/attack-cannibal-beast.wav');
                        }
                        if (enemy.name === "杂音微粒") {
                            events.emit('spawn-vfx', { type: 'heavy_hit', targetId: `char-${target.role}` });
                            events.emit('play-sound', 'assets/BGM/shadowboss_attack.wav');
                        }
                        if (enemy.name === "失律卫士") {
                            events.emit('spawn-vfx', { type: 'Heavy_Rending', targetId: `char-${target.role}` });
                            events.emit('spawn-vfx', { type: 'Blood_Splatter', targetId: `char-${target.role}` });
                        }
                        if (enemy.name === "失衡舞者") {
                            events.emit('spawn-vfx', { type: 'Sharp_Slash', targetId: `char-${target.role}` });
                            events.emit('spawn-vfx', { type: 'Blood_Splatter', targetId: `char-${target.role}` });
                        }
                        if (enemy.name === "寂静指挥家") {
                            events.emit('spawn-vfx', { type: 'Boss_wave', targetId: `char-${target.role}` });
                            events.emit('play-sound', 'assets/BGM/nastyattack.wav');
                        }
                        if (enemy.name === "恶意八音盒") {
                            events.emit('spawn-vfx', { type: 'Heavy_Rending', targetId: `char-${target.role}` });
                            events.emit('spawn-vfx', { type: 'Blood_Splatter', targetId: `char-${target.role}` }); 
                        }

                        const tSprite = document.getElementById(`char-${target.role}`);
                        if(tSprite) {
                            tSprite.classList.remove('anim-ally-hit');
                            void tSprite.offsetWidth;
                            tSprite.classList.add('anim-ally-hit');
                        }

                        if(target.block > 0) { 
                            let b = Math.min(target.block, dmg); 
                            target.block -= b; 
                            dmg -= b; 
                        }
                        
                        if(dmg > 0) {
                            target.hp = Math.max(0, target.hp - dmg);
                            events.emit('float-text', { text: `-${dmg}`, targetId: `char-${target.role}`, color: '#cc0000' });
                            events.emit('log', { msg: `${enemy.name} 攻击 ${target.name} 造成 ${dmg} 伤害`, type: 'enemy' });
                            events.emit('shake'); 
                            
                            if(target.hp <= 0) { 
                                target.hp = 0; target.dead = true; target.block = 0; 
                                events.emit('toast', `${target.name} 倒下了!`); 
                                if (gameStore.relics.includes('mozart_quill') && !this.mozartTriggered) {
                                    this.dmgEnemy(30, true, i); 
                                    this.mozartTriggered = true;
                                }
                                if (this.allies.every(a => a.dead)) { this.lose(); return; }
                            }
                        } else {
                            events.emit('float-text', { text: "格挡!", targetId: `char-${target.role}`, color: '#3498db' });
                        }
                    }
                    // 等待动画余波
                    await window.wait(600);
                } 
                // --- 非攻击类行动 ---
                else {
                    let waitTime = 800;
                    if (intentType === 'def' || intentType === 'def_block') {
                        let blockVal = (intentType === 'def_block') ? Math.floor(enemy.maxHp * 0.25) : Math.floor(enemy.maxHp * 0.1);
                        enemy.block += blockVal;
                        events.emit('float-text', { text: `护盾+${blockVal}`, targetId: spriteId, color: '#3498db' });
                        
                        if (enemy.name === "失律卫士" && eSprite) {
                            eSprite.classList.remove('anim-knight-defend', 'enemy-idle-breathe');
                            void eSprite.offsetWidth; 
                            eSprite.classList.add('anim-knight-defend');
                            events.emit('play-sound', 'assets/BGM/shield.wav');
                            setTimeout(() => {
                                eSprite.classList.remove('anim-knight-defend');
                                eSprite.classList.add('enemy-idle-breathe');
                            }, 1200);
                            waitTime = 1300;
                        }
                    } else if (intentType === 'buff' || intentType === 'buff_str') {
                        let strGain = (intentType === 'buff_str') ? 3 : 2;
                        enemy.buffs.str += strGain;
                        events.emit('float-text', { text: `力量+${strGain}`, targetId: spriteId, color: '#e74c3c' });
                        
                        if (enemy.name === "寂静指挥家" && eSprite) {
                            eSprite.classList.remove('anim-demon-buff', 'enemy-idle-breathe');
                            void eSprite.offsetWidth; 
                            eSprite.classList.add('anim-demon-buff');
                            events.emit('play-sound', 'assets/BGM/piano-string-glissando-low-a.wav'); 
                            setTimeout(() => {
                                eSprite.classList.remove('anim-demon-buff');
                                eSprite.classList.add('enemy-idle-breathe');
                            }, 1500);
                            waitTime = 1600;
                        }
                        if (enemy.name === "恶意八音盒" && eSprite) {
                            eSprite.classList.remove('anim-bayinhe-buff', 'enemy-idle-breathe');
                            void eSprite.offsetWidth; 
                            eSprite.classList.add('anim-bayinhe-buff');
                            events.emit('play-sound', 'assets/BGM/monster.wav');
                            setTimeout(() => {
                                eSprite.classList.remove('anim-bayinhe-buff');
                                eSprite.classList.add('enemy-idle-breathe');
                            }, 1200);
                            waitTime = 1300;
                        }
                    } else if (intentType === 'debuff') {
                        enemy.buffs.vuln = 0;
                        events.emit('float-text', { text: "净化", targetId: spriteId, color: '#fff' });
                        if (enemy.name === "寂静指挥家" && eSprite) {
                            eSprite.classList.remove('anim-demon-buff', 'enemy-idle-breathe');
                            void eSprite.offsetWidth; 
                            eSprite.classList.add('anim-demon-buff');
                            events.emit('play-sound', 'assets/BGM/piano-string-glissando-low-a.wav'); 
                            setTimeout(() => {
                                eSprite.classList.remove('anim-demon-buff');
                                eSprite.classList.add('enemy-idle-breathe');
                            }, 1500);
                            waitTime = 1600;
                        }
                    }
                    await window.wait(waitTime);
                }
            } else {
                events.emit('toast', `${enemy.name} 被冰冻!`);
                enemy.stunned = false;
                await window.wait(800);
            }
            events.emit('update-ui');
            await window.wait(400); // 敌人间的行动间隔
        }

        // 所有人行动完后
        this.enemies.forEach(e => {
            if(e.buffs.vuln > 0) e.buffs.vuln--;
        });
        
        if (this.tempStrDebuff > 0) {
            this.enemies.forEach(e => e.buffs.str += this.tempStrDebuff);
            this.tempStrDebuff = 0;
        }

        this.planEnemy();
        await window.wait(600);
        this.startTurn();
    },

    lose() {
        this.phase = 'DEFEAT';
        this.tm.clearAll();
        events.emit('stop-bgm');
        events.emit('play-sound', 'assets/BGM/horror-piano-chord.mp3'); 
        events.emit('toast', "乐章终结... 演出失败");
        
        setTimeout(() => {
            UI.switchScene('scene-menu');
        }, 2000);
    },

    planEnemy() {
        this.enemies.forEach(enemy => {
            if (enemy.hp <= 0) return;
            
            let base = 5 + Math.floor(gameStore.level * 1.5);
            const originalActs = enemy.acts || ['atk'];
            let acts = [...originalActs];
            
            // AI 智能修正 (Boss/Elite 特有逻辑)
            if (enemy.name === "寂静指挥家") {
                if (enemy.buffs.vuln === 0) acts = acts.filter(a => a !== 'debuff');
            }
            if (enemy.name === "恶意八音盒") {
                if ((enemy.buffs.str || 0) >= 6) acts = acts.filter(a => a !== 'buff_str');
            }
            
            if (acts.length === 0) acts = ['atk'];
            const act = acts[Math.floor(Math.random() * acts.length)];
            
            // 赋值意图
            const intents = {
                'atk': { type:'atk', val:base, icon:'assets/UI/attack.png' },
                'def': { type:'def', val:0, icon:'assets/UI/Defend.png' },
                'buff': { type:'buff', val:0, icon:'assets/UI/Mana.png' },
                'debuff': { type:'debuff', val:0, icon:'assets/UI/Debuff.png' },
                'atk_heavy': { type:'atk_heavy', val:Math.floor(base * 1.5), icon:'assets/UI/attack.png' },
                'atk_vuln': { type:'atk_vuln', val:Math.floor(base * 0.8), icon:'assets/UI/Debuff.png' },
                'buff_str': { type:'buff_str', val:0, icon:'assets/UI/Mana.png' },
                'def_block': { type:'def_block', val:0, icon:'assets/UI/Defend.png' }
            };
            
            enemy.intent = intents[act] || intents['atk'];
        });
    },

    deselect() { this.selectedCard = -1; events.emit('update-ui'); }
};