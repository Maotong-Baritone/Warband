import { PATHS } from './constants.js';

export const ENEMIES = {
    noise: { 
        name: "杂音微粒", 
        sprite: PATHS.enemies + "slime.png", 
        hpScale: 1, 
        scale: 0.85, 
        // 旧 acts 保留以防万一，但主要使用 logic
        acts: ['atk'],
        logic: {
            pattern: ['atk'] // 最简单的单一行为
        }
    },
    
    discord: { 
        name: "失律卫士", 
        sprite: PATHS.enemies + "knight.png", 
        hpScale: 1.5, 
        scale: 1.0, 
        logic: {
            // 固定循环：3次攻击 -> 1次防御
            pattern: ['atk', 'atk', 'atk', 'def'] 
        }
    }, 
    
    silence: { 
        name: "寂静指挥家", 
        sprite: PATHS.enemies + "demon.png", 
        hpScale: 2.5, 
        scale: 1.3, 
        logic: {
            rules: [
                // 规则 1: 如果玩家没有易伤(这里简化为如果BOSS自己没易伤就先不用净化/Debuff?)
                // 原逻辑: if (enemy.buffs.vuln === 0) acts = acts.filter(a => a !== 'debuff');
                // 这意味着: 如果我有易伤，我大概率会净化(debuff action in code cleared vuln).
                // 让我们转译为: 条件 "debuff_vuln > 0" -> 优先 "debuff" (净化)
                { condition: "debuff_vuln > 0", action: "debuff" } 
            ],
            // 默认循环
            pattern: ['atk', 'atk', 'buff']
        },
        actions: {
            // 自定义动作覆盖
            'buff': { type: 'buff', val: 0, icon: 'assets/UI/Mana.png' }, // Buff = 加强
            'debuff': { type: 'debuff', val: 0, icon: 'assets/UI/Debuff.png' } // Debuff = 净化自身
        }
    },
    
    bayinhe: { 
        name: "恶意八音盒", 
        sprite: PATHS.enemies + "bayinhe.png", 
        hpScale: 1.2, 
        scale: 0.85, 
        logic: {
            rules: [
                // 原逻辑: if (str >= 6) 不再 buff_str
                // 转译: 如果 str >= 6，强制重击
                { condition: "buff_str >= 6", action: "atk_heavy" }
            ],
            // 默认循环: 加力量 -> 加力量 -> 重击
            pattern: ['buff_str', 'buff_str', 'atk_heavy']
        }
    },
    
    changshiban: { 
        name: "杂音唱诗班", 
        sprite: PATHS.enemies + "changshiban.png", 
        hpScale: 1.8, 
        scale: 0.85, 
        logic: {
            pattern: ['atk_vuln', 'atk', 'atk_vuln']
        }
    },
    
    shihengwuzhe: { 
        name: "失衡舞者", 
        sprite: PATHS.enemies + "shihengwuzhe.png", 
        hpScale: 2.0, 
        scale: 1.1, 
        logic: {
            // 加权随机模式示例 (虽然原版是随机，这里演示一下)
            pattern: [ 
                { 'atk_heavy': 0.7, 'def_block': 0.3 }, 
                { 'atk_heavy': 0.7, 'def_block': 0.3 } 
            ]
            // 或者直接简单的循环，原版是随机 act pool
            // pattern: ['atk_heavy', 'atk_heavy', 'def_block']
        }
    }
};