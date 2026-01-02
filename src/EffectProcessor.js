import { events } from './eventBus.js';
import { gameStore } from './store/GameStore.js';
import { UI } from './ui.js';
import { StatusManager } from './mechanics/StatusManager.js';
import { HookManager } from './mechanics/HookManager.js';

/**
 * EffectProcessor 负责处理具体的卡牌效果逻辑。
 * 它将 battle 上下文与具体的效果实现解耦。
 */
export const EffectProcessor = {
    // 效果处理函数注册表
    handlers: {
        'dmg': async (context, eff, val, caster) => {
            let hits = eff.hits || 1;
            // 使用 Hook 系统修改攻击段数
            hits = HookManager.processValue('modifyEffectHits', hits, { battle: context, eff });
            
            const targetIdx = eff._tempTargetIdx !== undefined ? eff._tempTargetIdx : 0;
            const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);

            const interval = eff.interval || 150;
            for(let i=0; i<hits; i++) {
                context.dmgEnemy(val, eff.pierce, targetIdx);
                if (eff.vfx) events.emit('spawn-vfx', { type: eff.vfx, targetId });
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
            const targetIdx = eff._tempTargetIdx !== undefined ? eff._tempTargetIdx : 0;
            const target = context.enemies[targetIdx];
            if (!target) return;
            const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);

            if (eff.id === 'stunned') {
                StatusManager.addStatus(target, 'stunned', 1);
                events.emit('toast', eff.msg || `${target.name} 被击晕!`);
            } else {
                // 统一处理所有其他状态 (vuln, res, str, etc.)
                StatusManager.addStatus(target, eff.id, val);
                
                // 飘字反馈
                const isBuff = ['str', 'res', 'str_up'].includes(eff.id); // 简单判断颜色
                let color = isBuff ? '#e74c3c' : '#e67e22'; 
                if(eff.id === 'res') color = '#9b59b6';
                
                let sign = val > 0 ? '+' : '';
                // 尝试获取中文名
                const fromDef = StatusManager.getStack(target, eff.id); // 获取堆叠后的总数用于显示? 不，显示增量
                // 这里我们直接硬编码一些常见的回馈，或者未来由 StatusManager 返回描述
                let name = eff.id;
                if(eff.id === 'vuln') name = '易伤';
                if(eff.id === 'res') name = '共鸣';
                if(eff.id === 'str') name = '力量';
                
                events.emit('float-text', { text: `${name}${sign}${val}`, targetId, color });
                events.emit('log', { msg: `[Status] ${target.name} ${name} ${sign}${val}`, type: isBuff ? 'buff' : 'debuff' });
            }

            if (eff.msg && eff.id !== 'stunned') events.emit('toast', eff.msg);
        },

        'vfx': async (context, eff, val, caster) => {
            const targetIdx = eff._tempTargetIdx !== undefined ? eff._tempTargetIdx : 0;
            let targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
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
            // 现在调用签名扩展为 fn(battle, caster, val, mult, targetIdx)
            if (typeof eff.fn === 'function') {
                const targetIdx = eff._tempTargetIdx !== undefined ? eff._tempTargetIdx : 0;
                await eff.fn(context, caster, val, eff._tempMult || 1, targetIdx);
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
