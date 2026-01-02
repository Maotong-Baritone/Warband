import { events } from '../eventBus.js';

class BattleStore {
    constructor() {
        this.reset();
    }

    reset() {
        // 保留持久化数据
        const keptAllies = this.state ? this.state.allies : [];
        const keptDeck = this.state ? [...this.state.deck, ...this.state.hand, ...this.state.discard] : [];
        
        // 保留 Mana 属性 (Max/Draw)
        const keptManaMax = this.state ? this.state.mana.max : 3;
        const keptManaDraw = this.state ? this.state.mana.draw : 5;
        
        // 洗牌逻辑
        keptDeck.sort(() => Math.random() - 0.5);
        
        // 重置队友状态 (只清护盾)
        keptAllies.forEach(a => a.block = 0);

        this.state = {
            phase: 'IDLE',
            turnCount: 0,
            
            // 资源
            mana: { current: keptManaMax, max: keptManaMax, draw: keptManaDraw },
            
            // 实体 (保留)
            allies: keptAllies,
            enemy: null, 
            
            // 卡牌区 (保留Deck，清空手牌/弃牌)
            deck: keptDeck,
            hand: [],
            discard: [],
            
            // 战斗内临时状态
            selectedCardIdx: -1,
            attacksPlayed: 0,
            manaSpentTurn: 0,
            firstCardPlayed: false,
            processing: false, // 是否正在处理动画/效果
            
            // 特殊Buff/计数器
            variationBonus: 0,
            crescendoStacks: 0,
            tempStrDebuff: 0,
            
            // 圣物相关状态
            relicState: {
                lastCardType: null,
                bachCounter: 0,
                mozartTriggered: false
            }
        };
        this.notify('reset');
    }

    // --- Getters ---
    get phase() { return this.state.phase; }
    get turnCount() { return this.state.turnCount; }
    get mana() { return this.state.mana; }
    get allies() { return this.state.allies; }
    get enemy() { return this.state.enemy; }
    get deck() { return this.state.deck; }
    get hand() { return this.state.hand; }
    get discard() { return this.state.discard; }
    
    // --- Actions ---

    setPhase(p) {
        this.state.phase = p;
        this.notify('phase');
    }

    setAllies(list) {
        this.state.allies = list;
        this.notify('allies');
    }

    setEnemy(e) {
        this.state.enemy = e;
        this.notify('enemy');
    }

    setDeck(cards) {
        this.state.deck = cards;
        this.notify('deck'); // Deck changes usually don't need instant UI update unless viewing deck
    }

    setHand(cards) {
        this.state.hand = cards;
        this.notify('hand');
    }
    
    setDiscard(cards) {
        this.state.discard = cards;
        this.notify('discard');
    }

    // Mana Operations
    resetMana() {
        this.state.mana.current = this.state.mana.max;
        this.notify('mana');
    }
    
    modifyMana(amount) {
        this.state.mana.current += amount;
        this.notify('mana');
    }

    // Turn Logic
    nextTurn() {
        this.state.turnCount++;
        this.state.attacksPlayed = 0;
        this.state.manaSpentTurn = 0;
        this.state.firstCardPlayed = false;
        this.notify('turn');
    }

    // Card Selection
    selectCard(idx) {
        this.state.selectedCardIdx = idx;
        this.notify('selection');
    }

    setProcessing(val) {
        this.state.processing = val;
        this.notify('processing');
    }

    // Stats Updates
    recordCardPlay(card, cost) {
        this.state.mana.current -= cost;
        this.state.manaSpentTurn += cost;
        this.state.firstCardPlayed = true;
        if (card.type === 'atk') this.state.attacksPlayed++;
        if (card.tag === 'atk') {
             // 渐强
             this.state.crescendoStacks++;
        }
        this.notify('card-play');
    }

    // Helper
    notify(type) {
        events.emit('update-ui');
        events.emit(`battle-store:${type}`, this.state);
    }
}

export const battleStore = new BattleStore();
