import { ROLES } from '../data/roles.js';
import { gameStore } from '../store/GameStore.js';

export const MenuRenderer = {
    renderCharSelect(elId, cb) {
        const el = document.getElementById(elId); 
        if(!el) return;
        el.innerHTML = '';
        Object.keys(ROLES).forEach(key => {
            if(elId === 'grid-recruit' && gameStore.partyRoles.includes(key)) return;
            const r = ROLES[key];
            const d = document.createElement('div');
            d.className = 'char-card';
            
            const previewType = elId === 'grid-start' ? 'start' : 'recruit';

            d.innerHTML = `
                <img src="${r.sprite}" class="char-img idle-breathe" onerror="this.style.backgroundColor='#333';this.alt='图片丢失'">
                <div class="char-info">
                    <div style="color:#f0c040;font-weight:bold;font-size:1.2em">${r.name}</div>
                    <div class="bonus-text">
                        <div>❤️ HP: ${r.hp}</div>
                        <div>🌟 ${r.buff}</div>
                    </div>
                    <button class="btn-preview" onclick="window.game.previewDeck('${key}', '${previewType}')">🔍 预览卡组</button>
                </div>`;
            
            d.onclick = (e) => { 
                if(e.target.tagName !== 'BUTTON') {
                    e.stopPropagation(); 
                    if(elId==='grid-recruit') d.classList.add('joined'); 
                    cb(key); 
                }
            };
            el.appendChild(d);
        });
    }
};
