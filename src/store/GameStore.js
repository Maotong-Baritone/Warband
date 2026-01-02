import { events } from '../eventBus.js';
import { ROLES } from '../data/roles.js';

class GameStore {
    constructor() {
        // 核心状态数据
        this.state = {
            gold: 100,
            level: 1,
            partyRoles: [],  // 存储角色ID字符串 ['pianist', 'violinist']
            relics: [],      // 存储遗物ID
            cardLevels: {},  // 存储卡牌强化等级 { cardId: level }
        };
    }

    // --- Getters (获取数据) ---
    get gold() { return this.state.gold; }
    get level() { return this.state.level; }
    get partyRoles() { return [...this.state.partyRoles]; }
    get relics() { return [...this.state.relics]; }
    get cardLevels() { return { ...this.state.cardLevels }; }

    // --- Actions (修改数据) ---
    
    // 初始化/重置游戏
    initGame(leaderKey) {
        this.state.gold = 100;
        this.state.level = 1;
        this.state.partyRoles = [leaderKey];
        this.state.relics = [];
        this.state.cardLevels = {};
        this.notifyChange('init');
    }

    addGold(amount) {
        this.state.gold += amount;
        this.notifyChange('gold');
    }

    spendGold(amount) {
        if (this.state.gold >= amount) {
            this.state.gold -= amount;
            this.notifyChange('gold');
            return true;
        }
        return false;
    }

    nextLevel() {
        this.state.level++;
        this.notifyChange('level');
    }

    addRelic(relicKey) {
        if (!this.state.relics.includes(relicKey)) {
            this.state.relics.push(relicKey);
            this.notifyChange('relics');
            
            // 特殊遗物逻辑: 古老乐谱
            if (relicKey === 'sheet_music') {
                this.upgradeAllCards();
            }
        }
    }

    recruitMember(roleKey) {
        if (!this.state.partyRoles.includes(roleKey)) {
            this.state.partyRoles.push(roleKey);
            this.notifyChange('party');
            return true;
        }
        return false;
    }

    upgradeCard(cardId) {
        const current = this.state.cardLevels[cardId] || 0;
        if (current < 5) {
            this.state.cardLevels[cardId] = current + 1;
            this.notifyChange('cards');
            return true;
        }
        return false;
    }

    upgradeAllCards() {
        Object.keys(this.state.cardLevels).forEach(k => {
            this.state.cardLevels[k]++;
        });
        this.notifyChange('cards');
    }
    
    getCardLevel(cardId) {
        return this.state.cardLevels[cardId] || 0;
    }

    // --- Helper ---
    notifyChange(type) {
        // 发出通用 UI 更新事件，同时也发出特定数据变化的事件（为未来做准备）
        events.emit('update-ui'); 
        events.emit(`store-change:${type}`, this.state);
        console.log(`[GameStore] State changed: ${type}`, this.state);
    }
}

// 导出单例
export const gameStore = new GameStore();
