import { PATHS } from './constants.js';

export const ROLES = {
    pianist: { 
        id:'pianist', name:"幻奏裁决者", hp:60, sprite: PATHS.roles + "pianist.png", deck:[1, 19, 30], buff:"灵感上限 +1",
        hooks: {
            onInitBattle: (context) => {
                context.battle.manaData.max += 1;
            }
        }
    },
    violinist: { 
        id:'violinist', name:"银弦圣徒", hp:50, sprite: PATHS.roles + "violinist.png", deck:[5, 20, 31], buff:"手牌上限 +1",
        hooks: {
            onInitBattle: (context) => {
                context.battle.manaData.draw += 1;
            }
        }
    },
    vocalist: { 
        id:'vocalist', name:"镇魂吟唱者", hp:45, sprite: PATHS.roles + "vocalist.png", deck:[8,9,10], buff:"回合结束回 5 HP",
        hooks: {
            onEnemyTurnStart: async (context) => {
                // 敌人行动前回血
                context.battle.healAll(5);
            }
        }
    },
    cellist: { 
        id:'cellist', name:"沉音守望者", hp:75, sprite: PATHS.roles + "cellist.png", deck:[11,12,13], buff:"初始获得 8 护盾",
        hooks: {
            onBattleStart: async (context) => {
                const me = context.battle.allies.find(a => a.role === 'cellist');
                if (me) me.block += 8;
            }
        }
    },
    brass: { 
        id:'brass', name:"破晓号手", hp:70, sprite: PATHS.roles + "brass.png", deck:[14,15,16], buff:"高费卡(>=2)额外+5伤害",
        hooks: {
            modifyDamage: (val, context) => {
                const { card } = context;
                if (card && card.cost >= 2 && card.type === 'atk') {
                    return val + 5;
                }
                return val;
            }
        }
    },
    flutist: { 
        id:'flutist', name:"灵风行者", hp:45, sprite: PATHS.roles + "flutist.png", deck:[24, 25, 26], buff:"每回合第一张牌变为无消耗",
        hooks: {
            modifyCardCost: (cost, context) => {
                const { battle } = context;
                if (!battle.firstCardPlayed) return 0;
                return cost;
            }
        }
    },
    percussionist: { 
        id:'percussionist', name:"雷霆震击者", hp:70, sprite: PATHS.roles + "percussionist.png", deck:[27, 28, 29], buff:"攻击伤害 +2",
        hooks: {
            modifyDamage: (val, context) => {
                const { card } = context;
                if (card && card.type === 'atk') {
                    return val + 2;
                }
                return val;
            }
        }
    },
    conductor: { 
        id:'conductor', name:"灵魂织律者", hp:55, sprite: PATHS.roles + "conductor.png", deck:[21, 22, 23], buff:"合奏牌消耗 -1",
        hooks: {
            modifyCardCost: (cost, context) => {
                const { card } = context;
                if (card.type === 'duo' || card.type === 'trio') {
                    return Math.max(0, cost - 1);
                }
                return cost;
            }
        }
    }
};