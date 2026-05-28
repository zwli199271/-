// ==UserScript==
// @name         技术博客农场·全自动偷菜浇水版
// @namespace    http://tampermonkey.net/
// @version      7.0
// @description  一键遍历所有好友，自动进入农场 + 偷菜 + 浇水，无菜可偷/无地可浇自动跳过
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    GM_addStyle(`
        #farmTools {
            position: fixed;
            right: 10px; top: 100px;
            z-index: 999999;
            background: white;
            padding: 12px;
            border-radius: 10px;
            box-shadow: 0 0 10px #00000030;
            width: 180px;
        }
        .farmBtn {
            width: 100%;
            padding: 8px;
            margin: 4px 0;
            border: none;
            border-radius: 6px;
            color: white;
            font-weight: bold;
            cursor: pointer;
        }
        #steal { background: #e67e22; }
        #water { background: #3498db; }
        #autoAll { background: #e74c3c; }
    `);

    // 创建工具面板
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场一键工具</div>
        <button class="farmBtn" id="steal">🤲 一键偷好友菜</button>
        <button class="farmBtn" id="water">💧 一键帮浇水</button>
        <button class="farmBtn" id="autoAll">🚀 全自动偷菜浇水</button>
    `;
    document.body.appendChild(panel);

    // 1. 一键浇水
    document.getElementById('water').onclick = () => {
        const btns = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary');
        let count = 0;
        btns.forEach(btn => {
            btn.click();
            count++;
        });
    };

    // 2. 一键偷菜
    document.getElementById('steal').onclick = () => {
        const stealBtns = document.querySelectorAll('.fp-btn.steal');
        let count = 0;
        stealBtns.forEach(btn => {
            btn.click();
            count++;
        });
        alert(`🤲 偷菜完成！共偷 ${count} 块`);
    };

    // 3. 全自动：遍历好友列表 → 进入农场 → 偷菜 + 浇水 → 无操作自动跳过
    document.getElementById('autoAll').onclick = async () => {
        if (!confirm('🚀 开始全自动偷菜浇水？\n会自动遍历所有好友农场执行操作')) return;

        const friendButtons = document.querySelectorAll('.fp-friend .fp-steal-cta');
        if (friendButtons.length === 0) {
            alert('未找到任何好友！');
            return;
        }

        alert(`找到 ${friendButtons.length} 位好友，开始全自动操作～`);

        for (let i = 0; i < friendButtons.length; i++) {
            const btn = friendButtons[i];
            btn.click();
            console.log(`正在进入第 ${i+1}/${friendButtons.length} 位好友农场`);

            await new Promise(resolve => setTimeout(resolve, 2000));

            // 智能检测：没有可偷、可浇的地块 → 直接跳过
            const hasSteal = document.querySelectorAll('.fp-btn.steal').length > 0;
            const hasWater = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary').length > 0;

            if (!hasSteal && !hasWater) {
                console.log('✅ 无菜可偷、无地可浇，自动跳过该好友');
                continue;
            }

            // 执行偷菜
            if (hasSteal) {
                document.querySelectorAll('.fp-btn.steal').forEach(b => b.click());
            }
            // 执行浇水
            if (hasWater) {
                document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary').forEach(b => b.click());
            }

            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        alert('✅ 所有好友农场处理完毕！');
    };

})();
