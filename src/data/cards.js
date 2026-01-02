import { PATHS } from './constants.js';
import { gameStore } from '../store/GameStore.js';
import { StatusManager } from '../mechanics/StatusManager.js'; // Assuming cards.js is in src/data/ and store is in src/store/
// Need to adjust import path to be '../store/GameStore.js' relative to 'src/data/'

// 注意：这里的函数逻辑暂时保留，后续会重构为纯数据
export const DUO_CARDS = [
    { id: 101, name:"冬之旅", cost:1, req:['pianist', 'vocalist'], val:12, desc:"{val} 伤害 + 冰冻。", img:PATHS.cards + 'dongzhilv.png', type:'duo', 
      effects: [
          { type: 'dmg', val: 12, scale: true, vfx: 'ice' },
          { type: 'toast', msg: "寒冬降临..." },
          { type: 'status', id: 'stunned', msg: "敌人被冰冻!" }
      ]
    },
    { id: 102, name:"克鲁采", cost:0, req:['pianist', 'violinist'], val:6, desc:"狂暴 {val} 伤害 x 4 次。", img:PATHS.cards + 'kelucai.png', type:'duo', 
      effects: [
          { type: 'dmg', val: 6, scale: true, hits: 4, interval: 150, vfx: 'slash' }
      ]
    },
    { id: 103, name:"绿树成荫", cost:1, req:['violinist', 'vocalist'], val:15, desc:"全员回 {val} HP + 5 盾。", img:PATHS.cards + 'lvshuchengyin.png', type:'duo', 
      effects: [
          { type: 'heal', val: 15, scale: true, target: 'all', vfx: 'heal' },
          { type: 'block', val: 5, scale: true, target: 'all' },
          { type: 'toast', msg: "神圣宁静" }
      ]
    },
    { id: 104, name:"弦乐柔板", cost:1, req:['violinist', 'cellist'], val:30, desc:"前排获得 {val} 护盾并反伤。", img:PATHS.cards + 'adagio.png', type:'duo', 
      effects: [
          { type: 'block', val: 30, scale: true, target: 'front', vfx: 'shield' },
          { type: 'custom', fn: (b, c, val, mult, targetIdx) => { let f=b.getFrontAlly(); if(f) b.dmgEnemy(f.block, false, targetIdx); } }
      ]
    },
    { id: 105, name:"狂欢节", cost:2, req:['pianist', 'cellist'], val:8, desc:"随机 {val} 伤害 x 5 次。", img:PATHS.cards + 'carnival.png', type:'duo', 
      effects: [
          { type: 'dmg', val: 8, scale: true, hits: 5, interval: 120, vfx: 'heavy_hit' }
      ]
    },
    { id: 106, name:"悲歌", cost:2, req:['pianist', 'vocalist', 'cellist'], val:30, desc:"{val} 真实伤害 + 全员回血。", img:PATHS.cards + 'elegie.png', type:'trio', 
      effects: [
          { type: 'dmg', val: 30, scale: true, vfx: 'soundwave' },
          { type: 'heal', val: 20, scale: true, target: 'all', vfx: 'heal' }
      ]
    }
];

export const CARDS = {
    // Pianist
    1: { name:"热情", cost:2, type:'atk', val:16, tag:'atk', img:PATHS.cards + 'reqing.png', desc:"{val} 伤害", owner:'pianist',
         effects: [{ type: 'dmg', val: 16, scale: true, vfx: 'heavy_hit' }] 
    },
    19: { name:"复调展开", cost:1, type:'skill', val:0, tag:'buff', eff:'polyphony', img:PATHS.cards + 'fudiao.png', desc:"抽 {draw} 张牌，若有非攻击牌回 {mana} 费", owner:'pianist',
          effects: [{ type: 'custom', fn: async (b, c, val, mult) => {
              const level = gameStore.getCardLevel(19);
              // Level 0: Draw 2, Mana 1
              // Level 1: Draw 3, Mana 1
              // Level 2: Draw 3, Mana 2
              // Level 3: Draw 4, Mana 2 ...
              let drawCount = 2 + Math.floor((level + 1) / 2);
              let manaGain = 1 + Math.floor(level / 2);
              
              const drawn = await b.drawCards(drawCount);
              if(drawn.some(did => window.CARDS[did].type !== 'atk')) {
                  b.manaData.current += manaGain;
                  window.UI.spawnManaParticle(`char-${c.role}`, manaGain); // VFX
                  window.UI.floatText(`+${manaGain} 灵感`, `char-${c.role}`, '#4dabf7');
              }
          }}]
    },
    30: { name:"尾声", cost:1, type:'atk', val:6, tag:'atk', eff:'hand_scale', img:PATHS.cards + 'weisheng.png', desc:"{val} 伤害 (每张手牌+3伤害)", owner:'pianist',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              // val 已经是 6 * mult
              // 我们需要 (6 + hand*3) * mult = 6*mult + hand*3*mult
              // 或者更简单的：val + (hand * 3 * mult)
              let bonus = Math.ceil(b.hand.length * 3 * mult);
              b.dmgEnemy(val + bonus, false, targetIdx);
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              window.UI.spawnVFX('heavy_hit', targetId);
          }}]
    },
    
    // Common
    2: { name:"不协和", cost:1, type:'debuff', val:5, tag:'atk', img:PATHS.cards + 'buxiehe.png', desc:"{val} 伤害 + 易伤", owner:'common',
         effects: [
             { type: 'dmg', val: 5, scale: true, vfx: 'dissonance' },
             { type: 'status', id: 'vuln', val: 1, delay: 350 }
         ]
    },
    3: { name:"休止符", cost:1, type:'def', val:7, tag:'def', img:PATHS.cards + 'xiuzhifu.png', desc:"前排获得 {val} 护盾", owner:'common',
         effects: [{ type: 'block', val: 7, scale: true, vfx: 'shield' }]
    },
    4: { name:"颤音", cost:0, type:'atk', val:5, tag:'atk', img:PATHS.cards + 'chanyin.png', desc:"{val} 伤害, 抽1牌", owner:'common',
         effects: [
             { type: 'dmg', val: 5, scale: true, vfx: 'heavy_hit' },
             { type: 'draw', val: 1 }
         ]
    },
    6: { name:"独奏", cost:2, type:'atk', val:14, tag:'atk', img:PATHS.cards + 'duzou.png', desc:"{val} 穿透伤害", owner:'common',
         effects: [{ type: 'dmg', val: 14, scale: true, pierce: true, vfx: 'slash' }]
    },
    7: { name:"急板", cost:0, type:'atk', val:4, tag:'atk', img:PATHS.cards + 'jiban.png', desc:"{val} 伤害,回1费", owner:'common',
         effects: [
             { type: 'dmg', val: 4, scale: true, vfx: 'slash' },
             { type: 'mana', val: 1 }
         ]
    },
    17: { name:"渐强", cost:1, type:'atk', val:6, tag:'atk', eff:'crescendo', img:PATHS.cards + 'jianqiang.png', desc:"{val} 伤害(随本场攻击次数成长)", owner:'common',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              // val 是 6 * mult
              // 我们需要 (6 + stacks) * mult = val + stacks * mult
              let bonus = Math.ceil(b.crescendoStacks * mult);
              b.dmgEnemy(val + bonus, false, targetIdx);
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              window.UI.spawnVFX('soundwave', targetId);
          }}]
    },
    18: { name:"变奏", cost:1, type:'skill', val:0, tag:'buff', eff:'variation', img:PATHS.cards + 'bianzou.png', desc:"下一张牌效果 +50%", owner:'common',
          effects: [{ type: 'custom', fn: (b, c, val, mult) => {
              const level = gameStore.getCardLevel(18);
              b.variationBonus = 0.5 + (0.1 * level);
              window.UI.toast(`下一张牌效果 +${Math.round(b.variationBonus*100)}%`);
              window.UI.spawnVFX('heal', `char-${c.role}`);
          }}]
    },

    // Violinist
    5: { name:"运弓", cost:1, type:'atk', val:6, hits:2, tag:'atk', img:PATHS.cards + 'yungong.png', desc:"{val} 伤害 x2", owner:'violinist',
         effects: [{ type: 'dmg', val: 6, scale: true, hits: 2, vfx: 'slash' }]
    },
    20: { name:"双音", cost:1, type:'atk', val:4, tag:'atk', img:PATHS.cards + 'shuangyin.png', desc:"造成 3 + 负面状态层数次 {val} 点伤害", owner:'violinist',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              const target = b.enemies[targetIdx];
              if (!target) return;
              const debuffCount = (StatusManager.getStack(target, 'vuln') > 0 ? 1 : 0) + (StatusManager.hasStatus(target, 'stunned') ? 1 : 0);
              let hits = 3 + debuffCount;
              if (gameStore.relics.includes('liszt_bullet')) hits++;
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              for(let i=0; i<hits; i++) {
                  b.tm.add(() => {
                      b.dmgEnemy(val, false, targetIdx); // val 已经是 4 * mult
                      window.UI.spawnVFX('slash', targetId);
                  }, i * 150);
              }
          }}]
    },
    31: { name:"拨奏", cost:0, type:'atk', val:3, tag:'atk', img:PATHS.cards + 'bozou.png', desc:"{val} 伤害，施加 2 层易伤", owner:'violinist',
          effects: [
              { type: 'dmg', val: 3, scale: true, vfx: 'slash' },
              { type: 'status', id: 'vuln', val: 2, msg: '易伤+2', delay: 350 }
          ]
    },

    // Vocalist
    8: { name:"尖啸", cost:1, type:'atk', val:10, tag:'atk', eff:'screech', img:PATHS.cards + 'jianxiao.png', desc:"{val} 伤害 + 1层共鸣", owner:'vocalist',
         effects: [
             { type: 'dmg', val: 10, scale: true, vfx: 'soundwave' },
             { type: 'status', id: 'res', val: 1, msg: '共鸣+1', delay: 350 }
         ]
    },
    9: { name:"共鸣", cost:1, type:'buff', val:3, tag:'buff', img:PATHS.cards + 'gongming.png', desc:"{val} 层共鸣 (全体)", owner:'vocalist',
         effects: [
             { type: 'status', id: 'res', val: 3, target: 'all', scale: true, vfx: 'dissonance' }
         ]
    },
    10: { name:"咏叹调", cost:2, type:'spec', val:10, tag:'atk', img:PATHS.cards + 'yongtandiao.png', desc:"引爆共鸣(层数x{val})", owner:'vocalist',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              const target = b.enemies[targetIdx];
              if (!target) return;
              // val 已经是 10 * mult
              let resStacks = StatusManager.getStack(target, 'res');
              let dmg = resStacks * val;
              b.dmgEnemy(dmg, false, targetIdx);
              StatusManager.removeStatus(target, 'res');
              window.UI.log(`[引爆] 消耗 ${target.name} 共鸣造成 ${dmg} 伤害`, 'dmg');
              window.UI.shake();
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              window.UI.spawnVFX('soundwave', targetId);
          }}]
    },

    // Cellist
    11: { name:"低吟", cost:1, type:'def', val:12, tag:'def', img:PATHS.cards + 'diyin.png', desc:"前排获得 {val} 护盾", owner:'cellist',
          effects: [{ type: 'block', val: 12, scale: true, vfx: 'shield' }]
    },
    12: { name:"重奏", cost:2, type:'spec', val:100, tag:'atk', img:PATHS.cards + 'chongzou.png', desc:"造成等同于护盾 {val}% 的伤害", owner:'cellist',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              let dmg = Math.ceil(c.block * mult); // 100% 护盾值 * 倍率
              b.dmgEnemy(dmg, false, targetIdx);
              window.UI.shake();
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              window.UI.spawnVFX('heavy_hit', targetId);
          }}]
    },
    13: { name:"琴弦壁垒", cost:1, type:'def', val:5, tag:'def', img:PATHS.cards + 'qinxian.png', desc:"获得 {val} 护盾，抽一张牌", owner:'cellist',
          effects: [
              { type: 'block', val: 5, scale: true, vfx: 'shield' },
              { type: 'draw', val: 1 }
          ]
    },

    // Brass
    14: { name:"震荡号角", cost:1, type:'atk', val:8, tag:'atk', img:PATHS.cards + 'zhendanghaojiao.png', desc:"{val} 伤害，施加 2 层易伤", owner:'brass',
          effects: [
              { type: 'dmg', val: 8, scale: true, vfx: 'soundwave' },
              { type: 'status', id: 'vuln', val: 2, delay: 350 }
          ]
    },
    15: { name:"高爆音符", cost:2, type:'atk', val:18, tag:'atk', img:PATHS.cards + 'gaobaoyinfu.png', desc:"{val} 爆发伤害 (AOE)", owner:'brass',
          effects: [{ type: 'dmg', val: 18, scale: true, vfx: 'heavy_hit' }]
    },
    16: { name:"毁灭交响", cost:3, type:'atk', val:35, tag:'atk', img:PATHS.cards + 'huimiejiaoxiang.png', desc:"{val} 毁灭性打击", owner:'brass',
          effects: [{ type: 'dmg', val: 35, scale: true, vfx: 'heavy_hit' }] // removed catastrophe logic for simplicity, just big dmg
    },

    // Conductor
    21: { name:"起拍", cost:0, type:'skill', val:0, tag:'buff', eff:'upbeat', img:PATHS.cards + 'qipai.png', desc:"获得 {mana} 灵感，抽1张牌", owner:'conductor',
          effects: [{ type: 'custom', fn: async (b, c, val, mult) => {
              const level = gameStore.getCardLevel(21);
              let manaGain = 1 + Math.floor(level / 2);
              b.manaData.current += manaGain;
              window.UI.spawnManaParticle(`char-${c.role}`, manaGain); // VFX
              window.UI.floatText(`+${manaGain} 灵感`, `char-${c.role}`, '#4dabf7');
              await b.drawCards(1);
              window.UI.spawnVFX('conductor', `char-${c.role}`);
              if (level > 0) {
                  let t = b.getFrontAlly();
                  if(t) t.block += 4;
              }
          }}]
    },
    22: { name:"缄默", cost:1, type:'atk', val:8, tag:'atk', eff:'weaken', img:PATHS.cards + 'jianmo.png', desc:"{val} 伤害，本回合敌人力量 -{str}", owner:'conductor',
          effects: [
              { type: 'dmg', val: 8, scale: true, vfx: 'dissonance' },
              { type: 'custom', fn: (b, c, val, mult, targetIdx) => {
                  const target = b.enemies[targetIdx];
                  if (!target) return;
                  const level = gameStore.getCardLevel(22);
                  const debuffVal = 2 + level;
                  StatusManager.addStatus(target, 'temp_str_down', debuffVal);
                  const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
                  window.UI.floatText(`虚弱 ${debuffVal}`, targetId, '#bdc3c7');
              }}
          ]
    },
    23: { name:"大合奏", cost:2, type:'atk', val:15, tag:'atk', eff:'tutti', img:PATHS.cards + 'dahezou.png', desc:"{val} 伤害，全员获得 8 点护盾", owner:'conductor',
          effects: [
              { type: 'dmg', val: 15, scale: true, vfx: 'soundwave' },
              { type: 'block', val: 8, scale: true, target: 'all' }
          ]
    },

    // Flutist
    24: { name:"花舌", cost:0, type:'atk', val:3, tag:'atk', img:PATHS.cards + 'huashe.png', desc:"{val} 伤害 (次数=本回合已耗灵感)", owner:'flutist',
          effects: [{ type: 'custom', fn: (b, c, val, mult, targetIdx) => {
              let hits = Math.max(1, b.manaSpentTurn);
              if (gameStore.relics.includes('liszt_bullet')) hits++;
              const targetId = (targetIdx === 0 ? 'sprite-enemy' : `sprite-enemy-${targetIdx}`);
              for(let i=0; i<hits; i++) {
                  b.tm.add(() => {
                      b.dmgEnemy(val, false, targetIdx); // val 已经是 3 * mult
                      window.UI.spawnVFX('Multi-Thrust', targetId);
                  }, i * 150);
              }
          }}]
    },
    25: { name:"气息控制", cost:1, type:'skill', val:0, tag:'buff', eff:'breath', img:PATHS.cards + 'qixikongzhi.png', desc:"获得 {mana} 点灵感", owner:'flutist',
          effects: [{ type: 'custom', fn: async (b, c, val, mult) => {
              const level = gameStore.getCardLevel(25);
              let manaGain = 2 + level;
              b.manaData.current += manaGain;
              window.UI.spawnManaParticle(`char-${c.role}`, manaGain); // VFX
              window.UI.floatText(`+${manaGain} 灵感`, `char-${c.role}`, '#4dabf7');
              window.UI.spawnVFX('conductor', `char-${c.role}`);
              if (level > 0) await b.drawCards(1);
          }}]
    },
    26: { name:"穿透音", cost:1, type:'atk', val:8, tag:'atk', img:PATHS.cards + 'chuantouyin.png', desc:"{val} 穿透伤害，且抽 1 张牌", owner:'flutist',
          effects: [
              { type: 'dmg', val: 8, scale: true, pierce: true, vfx: 'soundwave' },
              { type: 'draw', val: 1 }
          ]
    },

    // Percussionist
    27: { name:"滚奏", cost:1, type:'atk', val:4, hits:4, tag:'atk', img:PATHS.cards + 'gunzou.png', desc:"{val} 伤害 x4", owner:'percussionist',
          effects: [{ type: 'dmg', val: 4, scale: true, hits: 4, vfx: 'heavy_hit' }]
    },
    28: { name:"炸镲", cost:2, type:'atk', val:10, tag:'atk', eff:'stun', img:PATHS.cards + 'zhacha.png', desc:"{val} 伤害，击晕敌人(跳过回合)", owner:'percussionist',
          effects: [
              { type: 'dmg', val: 10, scale: true, vfx: 'heavy_hit' },
              { type: 'status', id: 'stunned', msg: "敌人被击晕!", vfx: 'Heavy_Rending', delay: 350 }
          ]
    },
    29: { name:"定音", cost:1, type:'def', val:10, tag:'def', img:PATHS.cards + 'dingyin.png', desc:"前排获得 {val} 护盾，下回合保留护盾", owner:'percussionist',
          effects: [
              { type: 'block', val: 10, scale: true, vfx: 'shield' },
              { type: 'custom', fn: (b, c, val, mult) => {
                  let t = b.getFrontAlly();
                  if(t) t.retainBlock = true;
              }}
          ]
    },

    // Duo/Trio mappings
    101: DUO_CARDS[0],
    102: DUO_CARDS[1],
    103: DUO_CARDS[2],
    104: DUO_CARDS[3],
    105: DUO_CARDS[4],
    106: DUO_CARDS[5]
};