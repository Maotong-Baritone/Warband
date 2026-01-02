// src/mechanics/EnemyAI.js
import { StatusManager } from './StatusManager.js';
import { gameStore } from '../store/GameStore.js';

/**
 * EnemyAI - 敌人智能决策系统
 * 负责根据敌人的配置 (behavior) 和当前战场状态，决定下一个意图 (Intent)。
 */
export const EnemyAI = {
    
    /**
     * 为敌人生成下一个意图
     * @param {Object} enemy - 敌人实体
     * @param {Object} battleContext - 战斗上下文 (包含 allies, turnCount 等)
     */
    planIntent(enemy, battleContext) {
        if (enemy.hp <= 0) return { type: 'none' };

        // 1. 获取行为配置
        const logic = enemy.data?.logic || {}; // 假设我们在 enemies.js 里把配置叫 logic
        
        // 2. 状态记忆初始化
        if (!enemy._aiState) {
            enemy._aiState = {
                turnIndex: 0, // 当前在循环模式中的索引
                step: 0       // 总行动次数
            };
        }

        let nextAction = null;

        // 3. 优先级判断 (Priority Rules)
        // 例如：血量低于 30% 必定回血，或者特定阶段转换
        if (logic.rules) {
            for (const rule of logic.rules) {
                if (this.checkCondition(rule.condition, enemy, battleContext)) {
                    nextAction = this.selectAction(rule.action, enemy);
                    break; // 命中高优先级规则，直接返回
                }
            }
        }

        // 4. 如果没有触发特殊规则，执行默认模式 (Pattern)
        if (!nextAction && logic.pattern) {
            // 顺序循环模式 (Sequence)
            const pattern = logic.pattern;
            const idx = enemy._aiState.turnIndex % pattern.length;
            const actionKey = pattern[idx];
            
            nextAction = this.selectAction(actionKey, enemy);
            
            // 更新索引
            enemy._aiState.turnIndex++;
        }

        // 5. 兜底逻辑：完全随机 (如果没配置 pattern)
        if (!nextAction) {
            const acts = enemy.data?.acts || ['atk']; // 兼容旧数据
            const act = acts[Math.floor(Math.random() * acts.length)];
            nextAction = this.getActionDefinition(act, enemy);
        }

        enemy._aiState.step++;
        return nextAction;
    },

    /**
     * 检查条件是否满足
     */
    checkCondition(cond, enemy, context) {
        if (!cond) return true;
        
        // 示例格式: "hp < 0.5"
        if (typeof cond === 'string') {
            const parts = cond.split(' ');
            const type = parts[0];
            const op = parts[1];
            const val = parseFloat(parts[2]);

            let currentVal = 0;
            if (type === 'hp') currentVal = enemy.hp / enemy.maxHp;
            if (type === 'turn') currentVal = context.turnCount;
            if (type === 'buff_str') currentVal = StatusManager.getStack(enemy, 'str');
            if (type === 'debuff_vuln') currentVal = StatusManager.getStack(enemy, 'vuln');

            if (op === '<') return currentVal < val;
            if (op === '>') return currentVal > val;
            if (op === '==') return currentVal === val;
            if (op === '>=') return currentVal >= val;
            if (op === '<=') return currentVal <= val;
        }
        
        // 函数格式
        if (typeof cond === 'function') {
            return cond(enemy, context);
        }

        return false;
    },

    /**
     * 根据 key 选择具体行动，支持加权随机
     * @param {string|Object} actionRef - 动作键名 (e.g., 'atk') 或 权重对象 (e.g., { 'atk': 0.7, 'def': 0.3 })
     */
    selectAction(actionRef, enemy) {
        let key = actionRef;

        // 如果是对象，说明是加权随机
        if (typeof actionRef === 'object' && actionRef !== null) {
            const rand = Math.random();
            let sum = 0;
            for (const k in actionRef) {
                sum += actionRef[k];
                if (rand < sum) {
                    key = k;
                    break;
                }
            }
        }

        return this.getActionDefinition(key, enemy);
    },

    /**
     * 获取动作的具体定义 (数值、图标等)
     */
    getActionDefinition(key, enemy) {
        // 基础数值随等级成长
        const level = gameStore.level || 1;
        const baseDmg = 5 + Math.floor(level * 1.5);
        
        // 定义常用动作模板
        const templates = {
            'atk': { type: 'atk', val: baseDmg, icon: 'assets/UI/attack.png' },
            'atk_heavy': { type: 'atk_heavy', val: Math.floor(baseDmg * 1.5), icon: 'assets/UI/attack.png' },
            'atk_vuln': { type: 'atk_vuln', val: Math.floor(baseDmg * 0.8), icon: 'assets/UI/Debuff.png' },
            'def': { type: 'def', val: 0, icon: 'assets/UI/Defend.png' },
            'def_block': { type: 'def_block', val: 0, icon: 'assets/UI/Defend.png' },
            'buff': { type: 'buff', val: 0, icon: 'assets/UI/Mana.png' },
            'buff_str': { type: 'buff_str', val: 0, icon: 'assets/UI/Mana.png' },
            'debuff': { type: 'debuff', val: 0, icon: 'assets/UI/Debuff.png' },
            'heal': { type: 'heal', val: 0, icon: 'assets/UI/heal_icon.png' }, // 示例
            'stun': { type: 'stun', val: 0, icon: 'assets/UI/Debuff.png' }
        };

        // 优先使用 enemy.data.actions 里的自定义定义 (如果有)
        if (enemy.data && enemy.data.actions && enemy.data.actions[key]) {
            const custom = enemy.data.actions[key];
            // 支持动态数值计算
            let val = custom.val;
            if (typeof val === 'function') val = val(enemy, baseDmg);
            else if (val === undefined) val = templates[key] ? templates[key].val : 0;
            
            return { ...custom, type: custom.type || key, val: val, icon: custom.icon || templates[key]?.icon };
        }

        return templates[key] || templates['atk'];
    }
};
