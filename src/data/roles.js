import { PATHS } from './constants.js';

export const ROLES = {
    pianist: { id:'pianist', name:"幻奏裁决者", hp:60, sprite: PATHS.roles + "pianist.png", deck:[1, 19, 30], buff:"灵感上限 +1" },
    violinist: { id:'violinist', name:"银弦圣徒", hp:50, sprite: PATHS.roles + "violinist.png", deck:[5, 20, 31], buff:"手牌上限 +1" },
    vocalist: { id:'vocalist', name:"镇魂吟唱者", hp:45, sprite: PATHS.roles + "vocalist.png", deck:[8,9,10], buff:"回合结束回 5 HP" },
    cellist: { id:'cellist', name:"沉音守望者", hp:75, sprite: PATHS.roles + "cellist.png", deck:[11,12,13], buff:"初始获得 8 护盾" },
    brass: { id:'brass', name:"破晓号手", hp:70, sprite: PATHS.roles + "brass.png", deck:[14,15,16], buff:"高费卡(>=2)额外+5伤害" },
    flutist: { id:'flutist', name:"灵风行者", hp:45, sprite: PATHS.roles + "flutist.png", deck:[24, 25, 26], buff:"每回合第一张牌变为无消耗" },
    percussionist: { id:'percussionist', name:"雷霆震击者", hp:70, sprite: PATHS.roles + "percussionist.png", deck:[27, 28, 29], buff:"攻击伤害 +2" },
    conductor: { id:'conductor', name:"灵魂织律者", hp:55, sprite: PATHS.roles + "conductor.png", deck:[21, 22, 23], buff:"合奏牌消耗 -1" }
};
