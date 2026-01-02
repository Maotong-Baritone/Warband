export const MapRenderer = {
    render(mapGraph, currentPos) {
        if (!mapGraph || mapGraph.length === 0) {
            console.warn("MapGraph is empty!");
            return;
        }
        
        const cLayer = parseInt(currentPos.layer);
        const cIndex = parseInt(currentPos.index);

        const nodeContainer = document.getElementById('map-nodes');
        const svgContainer = document.getElementById('map-lines');
        if(!nodeContainer || !svgContainer) return;
        
        nodeContainer.innerHTML = '';
        svgContainer.innerHTML = ''; 

        mapGraph.forEach((layerNodes, layerIdx) => {
            const layerDiv = document.createElement('div');
            layerDiv.className = 'map-layer';
            layerDiv.id = `layer-${layerIdx}`;
            
            layerNodes.forEach((node, nodeIdx) => {
                const nDiv = document.createElement('div');
                nDiv.className = 'map-node-v2';
                nDiv.id = `node-${layerIdx}-${nodeIdx}`;
                
                let state = 'locked';
                if (cLayer === -1) {
                    if (layerIdx === 0) state = 'reachable';
                } else {
                    if (layerIdx < cLayer) state = 'passed';
                    else if (layerIdx === cLayer) {
                        if (nodeIdx === cIndex) state = 'current';
                        else state = 'locked'; 
                    }
                    else if (layerIdx === cLayer + 1) {
                        const currNodeData = mapGraph[cLayer]?.[cIndex];
                        if (currNodeData && currNodeData.next && currNodeData.next.includes(nodeIdx)) {
                            state = 'reachable';
                        }
                    }
                }
                
                nDiv.classList.add(state);
                if (node.type === 'boss') nDiv.classList.add('boss');

                let icon = 'assets/UI/Battle.png';
                if(node.type === 'elite') icon = 'assets/UI/Elite.png';
                if(node.type === 'camp') icon = 'assets/UI/camp.png';
                if(node.type === 'recruit') icon = 'assets/UI/Recruit.png';
                if(node.type === 'shop') icon = 'assets/UI/shop_icon.png';
                if(node.type === 'boss') icon = 'assets/UI/BossBattle.png';
                if(node.type === 'start') icon = 'assets/UI/common_button.png'; 

                nDiv.innerHTML = `<img src="${icon}"><div class="node-name">${node.name}</div>`;
                
                if (state === 'reachable') {
                    nDiv.onclick = () => window.game.enterNode(node.type, layerIdx, nodeIdx);
                }
                
                layerDiv.appendChild(nDiv);
            });
            nodeContainer.appendChild(layerDiv);
        });

        // 延迟画线，确保 DOM 布局完成
        setTimeout(() => {
            const containerRect = document.getElementById('map-container')?.getBoundingClientRect();
            if (!containerRect) return;
            
            mapGraph.forEach((layerNodes, layerIdx) => {
                if (layerIdx >= mapGraph.length - 1) return; 
                layerNodes.forEach((node, nodeIdx) => {
                    const startEl = document.getElementById(`node-${layerIdx}-${nodeIdx}`);
                    if (!startEl) return;
                    const startRect = startEl.getBoundingClientRect();
                    if (startRect.width === 0) return; 

                    const startX = startRect.left - containerRect.left + startRect.width/2;
                    const startY = startRect.top - containerRect.top + startRect.height/2;

                    node.next.forEach(targetIdx => {
                        const endEl = document.getElementById(`node-${layerIdx+1}-${targetIdx}`);
                        if (!endEl) return;
                        const endRect = endEl.getBoundingClientRect();
                        const endX = endRect.left - containerRect.left + endRect.width/2;
                        const endY = endRect.top - containerRect.top + endRect.height/2;
                        
                        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                        line.setAttribute('x1', startX); line.setAttribute('y1', startY);
                        line.setAttribute('x2', endX); line.setAttribute('y2', endY);
                        line.setAttribute('stroke', '#555'); line.setAttribute('stroke-width', '2');
                        svgContainer.appendChild(line);
                    });
                });
            });
            
            // 自动滚动
            const scrollArea = document.getElementById('map-scroll-area');
            if (cLayer === -1 && scrollArea) {
                scrollArea.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                const currentLayerEl = document.getElementById(`layer-${cLayer}`);
                if(scrollArea && currentLayerEl) {
                    const offset = currentLayerEl.offsetLeft - scrollArea.clientWidth / 2 + currentLayerEl.clientWidth / 2;
                    scrollArea.scrollTo({ left: offset, behavior: 'smooth' });
                }
            }
        }, 100);
    }
};
