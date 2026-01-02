import './utils.js';

// Data Imports
import { PATHS, COMMON_DECK } from './data/constants.js';
import { ROLES } from './data/roles.js';
import { ENEMIES } from './data/enemies.js';
import { RELICS } from './data/relics.js';
import { CARDS, DUO_CARDS } from './data/cards.js';

// Mount Data to Window (Legacy Compatibility)
window.PATHS = PATHS;
window.COMMON_DECK = COMMON_DECK;
window.ROLES = ROLES;
window.ENEMIES = ENEMIES;
window.RELICS = RELICS;
window.CARDS = CARDS;
window.DUO_CARDS = DUO_CARDS;

// Logic Imports
import './ui.js';
import './battle.js';
import './game.js';

// Wait for DOM to be ready and scripts to load
document.addEventListener('DOMContentLoaded', () => {
    // Attach event listeners that were previously inline
    const startBtn = document.getElementById('btn-start-game');
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            if (window.game) {
                window.game.start();
            } else {
                console.error("Game object not initialized!");
            }
        });
    }
});