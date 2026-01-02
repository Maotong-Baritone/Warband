import { CARDS } from '../data/cards.js';
import { RELICS } from '../data/relics.js';

export const ShopRenderer = {
    render(shopData) {
        const cGrid = document.getElementById('shop-cards'); if(cGrid) cGrid.innerHTML = '';
        const rGrid = document.getElementById('shop-relics'); if(rGrid) rGrid.innerHTML = '';
        const sGrid = document.getElementById('shop-services'); if(sGrid) sGrid.innerHTML = '';

        if(cGrid) {
            const cardSectionTitle = cGrid.parentElement.querySelector('h3');
            if(cardSectionTitle) cardSectionTitle.innerHTML = '<img src="assets/UI/upgrade_icon.png" class="icon-title"> 技艺磨炼 <span style="font-size:0.6em;color:#2ecc71">(强化)</span>';
            shopData.cards.forEach((item, idx) => {
                const c = CARDS[item.id];
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                const currentLv = item.level; const nextLv = currentLv + 1;
                d.innerHTML = `
                    <div style="position:relative; width:80px; height:80px;">
                        <img src="${c.img}" style="width:100%; height:100%; object-fit:contain;">
                        <div style="position:absolute; bottom:0; right:0; background:#2ecc71; color:#000; font-size:0.8em; padding:2px 4px; border-radius:4px; font-weight:bold;">Lv.${currentLv} -> ${nextLv}</div>
                    </div>
                    <div class="shop-item-name">${c.name}</div>
                    <div class="shop-item-desc" style="color:#2ecc71">点击强化</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('cards', idx);
                cGrid.appendChild(d);
            });
        }

        if(rGrid) {
            const relicSectionTitle = rGrid.parentElement.querySelector('h3');
            if(relicSectionTitle) relicSectionTitle.innerHTML = '<img src="assets/UI/mystery_relic_icon.png" class="icon-title"> 传世圣物';
            shopData.relics.forEach((item, idx) => {
                const r = RELICS[item.key];
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                d.innerHTML = `
                    <div style="position:relative; width:80px; height:80px; display:flex; align-items:center; justify-content:center;">
                        <img src="assets/UI/mystery_relic_icon.png" style="width:100%; height:100%; position:absolute; opacity:0.3;">
                        <span style="font-size:2.5em; position:relative; z-index:2;">${r.icon}</span>
                    </div>
                    <div class="shop-item-name">${r.name}</div>
                    <div class="shop-item-desc">${r.desc}</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('relics', idx);
                rGrid.appendChild(d);
            });
        }

        if(sGrid) {
            shopData.services.forEach((item, idx) => {
                const d = document.createElement('div');
                d.className = 'shop-item' + (item.sold ? ' sold' : '');
                d.innerHTML = `
                    <div style="width:80px; height:80px;"><img src="${item.icon}" style="width:100%; height:100%; object-fit:contain;"></div>
                    <div class="shop-item-name">${item.name}</div>
                    <div class="shop-item-desc">${item.desc}</div>
                    <div class="shop-price"><img src="assets/UI/gold_icon.png" class="gold-icon-small"> ${item.price}</div>
                `;
                d.onclick = () => window.game.buyItem('services', idx);
                sGrid.appendChild(d);
            });
        }
    }
};
