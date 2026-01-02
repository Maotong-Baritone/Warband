import { events } from '../eventBus.js';
import { StatusManager } from '../mechanics/StatusManager.js';

export const RELICS = {
    metronome: { 
        name: "节拍器", 
        icon: "⏰", 
        desc: "每回合第一张攻击牌打出两次",
        hooks: {
            onCardPlay: async (context) => {
                const { battle, card } = context;
                // 注意：context 需要包含 attacksPlayed (本次是第几次攻击)
                // battle.js 在调用钩子前应该已经更新了 attacksPlayed
                if (card.tag === 'atk' && battle.attacksPlayed === 1) {
                    context.triggers += 1; // 增加触发次数
                    events.emit('toast', "节拍器: 双重奏!");
                }
            }
        }
    },
    rosin: { 
        name: "松香", 
        icon: "🧂", 
        desc: "每次攻击时施加 1 层易伤",
        hooks: {
            onCardPlay: async (context) => {
                const { battle, card, targetIdx } = context;
                if (card.tag === 'atk') {
                    if (card.tag === 'aoe') {
                        battle.enemies.forEach(e => {
                            if (e.hp > 0) StatusManager.addStatus(e, 'vuln', 1);
                        });
                    } else {
                        const target = battle.enemies[targetIdx];
                        if (target && target.hp > 0) {
                            StatusManager.addStatus(target, 'vuln', 1);
                        }
                    }
                }
            }
        }
    },
    baton: { 
        name: "指挥棒", 
        icon: "🪄", 
        desc: "战斗开始时额外获得 1 点灵感",
        hooks: {
            onBattleStart: async (context) => {
                const { battle } = context;
                battle.manaData.current += 1;
                events.emit('toast', "指挥棒: 灵感+1");
            }
        }
    },
    tuning_fork: { 
        name: "音叉", 
        icon: "Y", 
        desc: "回合结束时保留 10 点护盾",
        hooks: {
            // 这个逻辑实际上是在回合开始前的"护盾衰减"阶段介入，或者回合结束阶段
            // 目前 battle.js 逻辑是: startTurn 时 block /= 2
            // 我们可以由 hook 来决定保留多少，或者拦截衰减
            onRetainBlock: (val, context) => {
                return Math.max(val, 10);
            }
        }
    },
    sheet_music: { 
        name: "古老乐谱", 
        icon: "📜", 
        desc: "所有初始卡牌等级+1",
        hooks: {
            // 这个是在获取时生效，不是战斗时。逻辑保留在 Store 里即可，或者在这里定义 onAcquire
            onAcquire: (context) => {
                 context.gameStore.upgradeAllCards();
            }
        }
    },
    beethoven_ear: { 
        name: "贝多芬的失聪耳蜗", 
        icon: "👂", 
        desc: "HP < 30% 时，造成伤害翻倍",
        hooks: {
            modifyDamage: (val, context) => {
                const { caster } = context;
                if (caster && caster.hp < caster.maxHp * 0.3) {
                    events.emit('float-text', { text: "命运咆哮!", targetId: `char-${caster.role}`, color: '#e74c3c' });
                    return val * 2;
                }
                return val;
            }
        }
    },
    paganini_string: { 
        name: "帕格尼尼的断弦", 
        icon: "🎻", 
        desc: "首张攻击牌耗能-1，但自伤 2 点",
        hooks: {
            modifyCardCost: (cost, context) => {
                const { battle, card } = context;
                if (!battle.firstCardPlayed && card.type === 'atk') {
                    return Math.max(0, cost - 1);
                }
                return cost;
            },
            onCardPlay: async (context) => {
                const { battle, card, caster } = context;
                if (battle.attacksPlayed === 1 && card.type === 'atk') {
                    caster.hp -= 2;
                    events.emit('float-text', { text: "-2", targetId: `char-${caster.role}`, color: '#888' });
                    if (caster.hp <= 0) { caster.hp=0; caster.dead=true; }
                }
            }
        }
    },
    mozart_quill: { 
        name: "莫扎特的安魂羽笔", 
        icon: "✒️", 
        desc: "队友濒死时，对敌造成 30 真实伤害",
        hooks: {
            onAllyDeath: async (context) => {
                const { battle, victim } = context;
                // 防止无限触发，battle 需要记录状态，或者 hook 本身带状态
                // 简单处理：直接触发一次伤害
                battle.dmgEnemy(30, true, 0); // 默认打第一个? 或者随机?
                events.emit('toast', "安魂曲触发!");
            }
        }
    },
    bach_lens: { 
        name: "巴赫的赋格透镜", 
        icon: "🔍", 
        desc: "连续打出 3 张同类牌，抽1牌+1费",
        hooks: {
            onAfterCardPlay: async (context) => {
                const { battle, card } = context;
                // 使用 battleStore 的 relicState 来存储临时状态
                // 这里我们假设 battle.relicState 已经暴露
                const state = battle.bachState || { type: null, count: 0 };
                
                if (state.type === card.type) {
                    state.count++;
                    if (state.count >= 3) {
                        await battle.drawCards(1);
                        battle.manaData.current++;
                        events.emit('toast', "赋格透镜: 完美对位!");
                        state.count = 0;
                    }
                } else {
                    state.type = card.type;
                    state.count = 1;
                }
                battle.bachState = state; // Save back
            }
        }
    },
    liszt_bullet: { 
        name: "李斯特的魔弹", 
        icon: "🎹", 
        desc: "所有多段攻击次数 +1",
        hooks: {
            modifyEffectHits: (hits, context) => {
                return hits + 1;
            }
        }
    }
};