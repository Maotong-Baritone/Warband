import { PATHS } from './constants.js';

export const ENEMIES = {
    noise: { name: "杂音微粒", sprite: PATHS.enemies + "slime.png", hpScale: 1, scale: 0.85, act: ['atk'] },
    discord: { name: "失律卫士", sprite: PATHS.enemies + "knight.png", hpScale: 1.5, scale: 1.0, act: ['atk', 'atk', 'atk', 'def'] }, 
    silence: { name: "寂静指挥家", sprite: PATHS.enemies + "demon.png", hpScale: 2.5, scale: 1.3, act: ['atk', 'atk', 'buff', 'debuff'] },
    bayinhe: { name: "恶意八音盒", sprite: PATHS.enemies + "bayinhe.png", hpScale: 1.2, scale: 0.85, act: ['buff_str', 'buff_str', 'atk_heavy'] },
    changshiban: { name: "杂音唱诗班", sprite: PATHS.enemies + "changshiban.png", hpScale: 1.8, scale: 0.85, act: ['atk_vuln', 'atk', 'atk_vuln'] },
    shihengwuzhe: { name: "失衡舞者", sprite: PATHS.enemies + "shihengwuzhe.png", hpScale: 2.0, scale: 1.1, act: ['atk_heavy', 'atk_heavy', 'def_block'] }
};
