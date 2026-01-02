import { events } from './eventBus.js';
import { gameStore } from './store/GameStore.js';
import { UI } from './ui.js';

/**
 * EffectProcessor 负责处理具体的卡牌效果逻辑。
 * 它将 battle 上下文与具体的效果实现解耦。
 */
export const EffectProcessor = {
    // 效果处理函数注册表
    handlers: {
        'dmg': async (context, eff, val, caster) => {
            let hits = eff.hits || 1;
            // 圣物：李斯特的子弹 (多段攻击次数+1)
            if (hits > 1 && gameStore.relics.includes('liszt_bullet')) hits += 1;
            
            const interval = eff.interval || 150;
            for(let i=0; i<hits; i++) {
                context.dmgEnemy(val, eff.pierce);
                if (eff.vfx) events.emit('spawn-vfx', { type: eff.vfx, targetId: 'sprite-enemy' });
                // 如果是多段攻击，且不是最后一下，需要等待间隔
                if (i < hits - 1) await window.wait(interval);
            }
        },

        'heal': async (context, eff, val, caster) => {
            if (eff.target === 'all') {
                context.healAll(val);
            } else {
                context.healPlayer(val);
            }
            if (eff.vfx) events.emit('spawn-vfx', { type: eff.vfx, targetId: 'party-container' });
        },

        'block': async (context, eff, val, caster) => {
            if (eff.target === 'all') {
                context.addBlockAll(val);
            } else {
                const t = context.getFrontAlly();
                if(t) {
                    t.block += val;
                    events.emit('log', { msg: `[护盾] ${t.name} 获得 ${val} 护盾`, type: 'block' });
                    events.emit('play-sound', 'assets/BGM/shield.wav');
                    events.emit('float-text', { text: `护盾+${val}`, targetId: `char-${t.role}`, color: '#3498db' });
                    if (eff.vfx) events.emit('spawn-vfx', { type: eff.vfx, targetId: `char-${t.role}` });
                }
            }
        },

        'draw': async (context, eff, val, caster) => {
            await context.drawCards(val);
        },

        'mana': async (context, eff, val, caster) => {
            context.manaData.current += val;
            let targetId = 'party-container';
            if (caster) targetId = `char-${caster.role}`;
            
            // 触发粒子特效
            UI.spawnManaParticle(targetId, val);
            
            events.emit('float-text', { text: `+${val} 灵感`, targetId, color: '#4dabf7' });
        },

        'status': async (context, eff, val, caster) => {
            if (eff.id === 'stunned') {
                context.enemy.stunned = true;
                events.emit('toast', eff.msg || "敌人被击晕!");
            } else if (eff.id === 'vuln') {
                context.enemy.buffs.vuln += val;
                events.emit('float-text', { text: `易伤+${val}`, targetId: 'sprite-enemy', color: '#e67e22' });
                events.emit('log', { msg: `[Debuff] 敌人被施加 ${val} 层易伤`, type: 'debuff' });
            } else if (eff.id === 'res') {
                context.enemy.buffs.res += val;
                events.emit('float-text', { text: `共鸣+${val}`, targetId: 'sprite-enemy', color: '#9b59b6' });
                events.emit('log', { msg: `[Buff] 敌人共鸣 +${val}`, type: 'buff' });
            } else if (eff.id === 'str') {
                context.enemy.buffs.str += val;
                let color = val > 0 ? '#e74c3c' : '#bdc3c7';
                events.emit('float-text', { text: `力量 ${val>0?'+':''}${val}`, targetId: 'sprite-enemy', color });
            }
            if (eff.msg && eff.id !== 'stunned') events.emit('toast', eff.msg);
        },

        'vfx': async (context, eff, val, caster) => {
            let targetId = 'sprite-enemy';
            if (eff.target === 'self' && caster) targetId = `char-${caster.role}`;
            if (eff.target === 'front') {
                const f = context.getFrontAlly();
                if(f) targetId = `char-${f.role}`;
            }
            if (eff.target === 'all') targetId = 'party-container';
            events.emit('spawn-vfx', { type: eff.id, targetId });
        },

        'toast': async (context, eff, val, caster) => {
            events.emit('toast', eff.msg);
        },

        'custom': async (context, eff, val, caster) => {
            // custom 效果通常包含一个 fn 函数
            // 注意：这里我们传入了原始的 context (battle对象) 以及一些辅助参数
            // mult 参数在 execute 入口处处理，这里 custom 的 val 已经是计算过的值，
            // 但有些 custom 逻辑可能需要原始倍率（比如变奏），
            // 这是一个权衡。为了保持兼容性，我们假设 custom.fn 签名不变。
            // 现在的调用签名是 fn(battle, caster, val, mult)
            // 我们需要从外部传入 mult
            if (typeof eff.fn === 'function') {
                await eff.fn(context, caster, val, eff._tempMult || 1);
            }
        }
    },

    /**
     * 执行效果的主入口
     * @param {Object} context - 战斗上下文 (window.battle)
     * @param {Object} eff - 效果配置对象
     * @param {Object} caster - 施法者对象
     * @param {number} finalVal - 经过计算后的最终数值 (base * mult)
     * @param {number} mult - 原始倍率 (用于 custom 函数等特殊需求)
     */
    async execute(context, eff, caster, finalVal, mult) {
        const handler = this.handlers[eff.type];
        if (handler) {
            // 为了让 custom 能拿到 mult，我们将 mult 挂载到 eff 临时属性上，或者直接传参
            // 上面的 handlers.custom 是固定的 (context, eff, val, caster) 签名
            // 我们可以稍微 hack 一下，把 mult 传给 custom handler
            if (eff.type === 'custom') eff._tempMult = mult;
            
            await handler(context, eff, finalVal, caster);
        } else {
            console.warn(`EffectProcessor: Unknown effect type '${eff.type}'`);
        }
    }
};
