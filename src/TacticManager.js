import { events } from './eventBus.js';
import { battleStore } from './store/BattleStore.js';

export const TacticManager = {
    selectedIdx: -1,
    handleClick(idx) {
        if(battleStore.phase !== 'PREPARE') return;
        if(this.selectedIdx === -1) {
            this.selectedIdx = idx; events.emit('highlight-unit', { idx, active: true });
        } else if(this.selectedIdx === idx) {
            events.emit('highlight-unit', { idx, active: false }); this.selectedIdx = -1;
        } else {
            this.swap(this.selectedIdx, idx);
            events.emit('highlight-unit', { idx: this.selectedIdx, active: false }); this.selectedIdx = -1;
        }
    },
    swap(from, to) {
        // Swap logic directly manipulating store arrays (via reference or setter)
        const allies = [...battleStore.allies];
        const temp = allies[from]; 
        allies[from] = allies[to]; 
        allies[to] = temp;
        battleStore.setAllies(allies);
        events.emit('render-battlefield');
    }
};
