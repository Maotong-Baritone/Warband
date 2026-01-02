import { CARDS } from '../data/cards.js';
import { gameStore } from '../store/GameStore.js';
import { battleStore } from '../store/BattleStore.js';
import { BaseUI } from './BaseUI.js';

export const RewardRenderer = {
    renderRewards(mode = 'new') {
        const el = document.getElementById('reward-list'); 
        if(!el) return;
        el.innerHTML='';
        if (mode === 'new') {
            document.getElementById('reward-title').innerText = "领悟新乐谱";
            document.getElementById('reward-text').innerText = "选择一张加入牌组 (若已有则强化)";
            const keys = window.game.getSmartRewards(); 
            for(let k of keys) {
                const c = CARDS[k];
                const d = document.createElement('div'); d.className='char-card'; d.style.height='250px';
                const isOwned = battleStore.deck.includes(parseInt(k));
                let desc = c.desc;
                if(c.val !== undefined) desc = desc.replace('{val}', c.val);
                let actionText = isOwned ? `<span style="color:#2ecc71">★ 突破 (全局+1)</span>` : `<span style="color:#f0c040">✨ 新获取</span>`;
                let currentLv = gameStore.getCardLevel(k);
                let suffix = currentLv > 0 ? ` +${currentLv}` : '';
                d.innerHTML = `
                    <img src="${c.img}" class="char-img" onerror="this.src=''">
                    <div class="char-info">
                        <b>${c.name}${suffix}</b>
                        <div style="margin:5px 0;">${actionText}</div>
                        <div class="card-desc"><span>${desc}</span></div>
                    </div>`;
                d.onclick = () => { 
                    if (isOwned) {
                        if (gameStore.getCardLevel(k) >= 5) {
                            BaseUI.toast(`${c.name} 已达等级上限!`);
                            return;
                        }
                        gameStore.upgradeCard(k);
                        BaseUI.toast(`${c.name} 突破成功!`);
                    } else {
                        const currentDeck = battleStore.deck;
                        currentDeck.push(parseInt(k));
                        battleStore.setDeck(currentDeck);
                        BaseUI.toast(`习得: ${c.name}`);
                    }
                    window.game.finishReward(); 
                };
                el.appendChild(d);
            }
        }
    },

    renderUpgradeRewards(goldGain = 0) {
        const el = document.getElementById('reward-list'); 
        if(!el) return;
        el.innerHTML='';
        document.getElementById('reward-title').innerText = "战火淬炼";
        document.getElementById('reward-text').innerHTML = `获得金币: <img src="assets/UI/gold_icon.png" class="gold-icon-small"> <span style="color:#f0c040; font-weight:bold;">${goldGain}</span><br>选择一种技艺进行【钻研】(上限等级 5)`;
        
        // 过滤掉已满级的卡牌
        const uniqueIds = [...new Set(battleStore.deck)].filter(id => gameStore.getCardLevel(id) < 5);
        
        if (uniqueIds.length === 0) {
            el.innerHTML = "<div style='color:#888'>所有技艺已达化境</div>";
            return;
        }
        const pool = [...uniqueIds];
        const picks = [];
        for(let i=0; i<3; i++) {
                if(pool.length === 0) break;
                const randIdx = Math.floor(Math.random() * pool.length);
                picks.push(pool[randIdx]);
                pool.splice(randIdx, 1);
        }
        picks.forEach(id => {
            const c = CARDS[id];
            const d = document.createElement('div'); d.className = 'char-card'; d.style.height='250px';
            const currentLv = gameStore.getCardLevel(id);
            const nextLv = currentLv + 1;
            let displayVal = c.val;
            let displayDesc = c.desc;
            
            // 变奏
            if (c.eff === 'variation') {
                const bonus = 50 + (10 * nextLv);
                displayDesc = displayDesc.replace('50%', `${bonus}%`);
            }
            // 功能牌 (预览下一级)
            if (c.eff === 'polyphony') {
                const drawCount = 2 + Math.floor((nextLv + 1)/2);
                const manaGain = 1 + Math.floor(nextLv/2);
                displayDesc = displayDesc.replace('{draw}', `<span class="highlight-val">${drawCount}</span>`)
                                         .replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'upbeat') {
                const manaGain = 1 + Math.floor(nextLv/2);
                displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'breath') {
                const manaGain = 2 + nextLv;
                displayDesc = displayDesc.replace('{mana}', `<span class="highlight-val">${manaGain}</span>`);
            }
            if (c.eff === 'weaken') {
                const strLoss = 2 + nextLv;
                displayDesc = displayDesc.replace('{str}', `<span class="highlight-val">${strLoss}</span>`);
            }
            
            if(c.val !== undefined) {
                const nextVal = Math.ceil(c.val * (1 + 0.5 * nextLv));
                displayDesc = displayDesc.replace('{val}', `<span class="highlight-val">${nextVal}</span>`);
            }
            d.innerHTML = `
                <img src="${c.img}" class="char-img" onerror="this.src=''">
                <div class="char-info">
                    <b style="color:${currentLv>0?'#2ecc71':'#eee'}">${c.name} ${currentLv>0?'+'+currentLv:''}</b>
                    <div style="font-size:2em; color:#f0c040; margin:2px 0;">⮕ +${nextLv}</div>
                    <div class="card-desc"><span>${displayDesc}</span></div>
                </div>`;
            d.onclick = () => { 
                gameStore.upgradeCard(id);
                BaseUI.toast(`${c.name} 钻研成功!`);
                window.game.finishReward(); 
            };
            el.appendChild(d);
        });
    }
};
