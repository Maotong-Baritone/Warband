// src/mechanics/StatusManager.js
import { STATUSES } from '../data/statuses.js';
import { events } from '../eventBus.js';
import { battleStore } from '../store/BattleStore.js';

/**
 * 通用状态管理器
 * 负责统一处理状态的增删改查、以及钩子触发
 */
export const StatusManager = {
    
    // --- 基础操作 ---

    /**
     * 获取某单位的特定状态层数
     * @param {Object} target - 战斗单位 (ally 或 enemy)
     * @param {string} statusId - 状态ID
     * @returns {number} 层数 (0 表示无)
     */
    getStack(target, statusId) {
        if (!target || !target.status) return 0;
        const s = target.status.find(s => s.id === statusId);
        return s ? s.amount : 0;
    },

    /**
     * 检查是否有某个状态
     */
    hasStatus(target, statusId) {
        return this.getStack(target, statusId) > 0;
    },

    /**
     * 添加状态
     * @param {Object} target 
     * @param {string} statusId 
     * @param {number} amount 
     */
    addStatus(target, statusId, amount = 1) {
        if (!target) return;
        if (!target.status) target.status = []; // 确保数组存在

        const def = STATUSES[statusId];
        if (!def) {
            console.warn(`Unknown status: ${statusId}`);
            return;
        }

        let s = target.status.find(item => item.id === statusId);
        
        if (s) {
            // 已存在，叠加
            if (def.canStack !== false) {
                s.amount += amount;
            } else {
                // 不可叠加的通常刷新，或者维持 1
                s.amount = 1; 
            }
        } else {
            // 新增
            target.status.push({ id: statusId, amount: amount });
        }

        // 视觉反馈
        this._notifyUpdate();
        // 只有新增或层数显著变化时才飘字，防止刷屏？这里先简单处理
        // UI层可以通过监听 store 变化来处理，这里也可以发事件
    },

    /**
     * 减少状态层数
     */
    reduceStatus(target, statusId, amount = 1) {
        if (!target || !target.status) return;
        
        const idx = target.status.findIndex(s => s.id === statusId);
        if (idx === -1) return;

        const s = target.status[idx];
        s.amount -= amount;

        if (s.amount <= 0) {
            target.status.splice(idx, 1);
        }
        
        this._notifyUpdate();
    },

    /**
     * 移除状态
     */
    removeStatus(target, statusId) {
        if (!target || !target.status) return;
        target.status = target.status.filter(s => s.id !== statusId);
        this._notifyUpdate();
    },

    // --- 钩子处理 (Hooks) ---

    /**
     * 计算受到伤害时的修正 (Defense Modifier)
     * e.g. 易伤、格挡
     * @param {Object} target - 受击者
     * @param {number} baseDmg - 原始伤害
     * @param {Object} source - 攻击来源
     * @returns {number} 修正后伤害
     */
    applyIncomingDamageMods(target, baseDmg, source) {
        if (!target || !target.status) return baseDmg;
        
        let finalDmg = baseDmg;
        
        // 遍历受击者所有状态，看有没有修改受击伤害的
        target.status.forEach(s => {
            const def = STATUSES[s.id];
            if (def && def.onReceiveDamage) {
                finalDmg = def.onReceiveDamage(this, finalDmg, target, source);
            }
        });

        return finalDmg;
    },

    /**
     * 计算造成伤害时的修正 (Attack Modifier)
     * e.g. 力量、虚弱
     * @param {Object} source - 攻击者
     * @param {number} baseDmg - 原始伤害
     * @param {Object} target - 目标
     * @returns {number} 修正后伤害
     */
    applyOutgoingDamageMods(source, baseDmg, target) {
        if (!source || !source.status) return baseDmg;

        let finalDmg = baseDmg;

        source.status.forEach(s => {
            const def = STATUSES[s.id];
            if (def && def.onDealDamage) {
                finalDmg = def.onDealDamage(this, finalDmg, source, target);
            }
        });

        return Math.max(0, finalDmg); // 伤害不能为负
    },

    /**
     * 回合开始时的处理
     * @param {Object} target 
     */
    processTurnStart(target) {
        if (!target || !target.status) return;
        // 使用副本遍历，防止在回调中删除状态导致循环出错
        [...target.status].forEach(s => {
            const def = STATUSES[s.id];
            if (def && def.onTurnStart) {
                def.onTurnStart(this, target, s);
            }
        });
    },

    /**
     * 回合结束时的处理 (如易伤衰减)
     * @param {Object} target 
     */
    processTurnEnd(target) {
        if (!target || !target.status) return;
        [...target.status].forEach(s => {
            const def = STATUSES[s.id];
            if (def && def.onTurnEnd) {
                def.onTurnEnd(this, target, s);
            }
        });
    },

    _notifyUpdate() {
        // 通知 UI 更新 (重绘状态栏)
        // 目前 battleStore 是通过 proxy 监听的，如果我们直接修改了 array 内部对象
        // 可能需要手动触发 battleStore 的 notify。
        // 由于我们这里直接操作了 target.status (引用)，Store 可能感知不到深层变化
        // 所以我们需要触发一个强制更新
        events.emit('update-ui');
    }
};
