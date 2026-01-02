// src/data/statuses.js
import { PATHS } from './constants.js';

export const STATUSES = {
    // 1. 易伤 (Vulnerable): 受到的伤害增加 50%
    'vuln': {
        name: '易伤',
        type: 'debuff',
        icon: 'assets/UI/Vulnerable.png', // 暂时沿用，建议统一路径
        desc: (val) => `受到的伤害增加 50%。持续 ${val} 回合。`,
        canStack: true, // 层数叠加
        onTurnEnd: (manager, target, stack) => {
            // 回合结束层数 -1
            manager.reduceStatus(target, 'vuln', 1);
        },
        // 钩子：当受到伤害时
        onReceiveDamage: (manager, val, target, source) => {
            return Math.floor(val * 1.5);
        }
    },

    // 2. 力量 (Strength): 造成的伤害增加
    'str': {
        name: '力量',
        type: 'buff',
        icon: 'assets/UI/Mana.png', // 暂时复用图标，需替换
        desc: (val) => `攻击伤害增加 ${val} 点。`,
        canStack: true,
        // 钩子：当造成伤害时
        onDealDamage: (manager, val, source, target) => {
            return val + manager.getStack(source, 'str');
        }
    },

    // 3. 共鸣 (Resonance): 标记，无被动效果，等待引爆
    'res': {
        name: '共鸣',
        type: 'buff',
        icon: 'assets/UI/Debuff.png', // 暂时复用
        desc: (val) => `共鸣层数: ${val}。可被特定技能引爆。`,
        canStack: true,
        // 无特殊自动逻辑，永久存在直到被消耗
    },
    
    // 4. 眩晕 (Stun): 无法行动
    'stunned': {
        name: '眩晕',
        type: 'debuff',
        icon: 'assets/UI/Debuff.png', // 需替换
        desc: (val) => `本回合无法行动。`,
        canStack: false, // 只有是与否
        onTurnStart: (manager, target) => {
            // 眩晕逻辑通常在 AI 决策层判断，或者在这里直接跳过行动
            // 这里我们只负责自动移除（如果设计为 1 回合）
            // 目前逻辑是生效一次后移除
            manager.removeStatus(target, 'stunned');
        }
    },

    // 新增：临时力量削弱 (用于 Conductor 的缄默)
    'temp_str_down': {
        name: '虚弱',
        type: 'debuff',
        icon: 'assets/UI/Debuff.png', // 需替换
        desc: (val) => `本回合攻击力减少 ${val}。`,
        canStack: true,
        onDealDamage: (manager, val, source, target) => {
            return val - manager.getStack(source, 'temp_str_down');
        },
        onTurnEnd: (manager, target, stack) => {
            manager.removeStatus(target, 'temp_str_down'); // 回合结束自动消失
        }
    }
};
