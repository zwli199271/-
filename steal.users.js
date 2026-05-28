// ==UserScript==
// @name         技术博客农场·全自动偷菜浇水版
// @namespace    http://tampermonkey.net/
// @version      6.0
// @description  一键遍历所有好友，自动进入农场 + 偷菜 + 浇水
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
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
        #autoAll { background: #e74c3c; } /* 全自动按钮 */
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

    // 3. 全自动：遍历好友列表 → 进入农场 → 偷菜 → 浇水
    document.getElementById('autoAll').onclick = async () => {
        if (!confirm('🚀 开始全自动偷菜浇水？\n会自动遍历所有好友农场执行操作')) return;

        // 获取所有好友的【去偷菜】按钮
        const friendButtons = document.querySelectorAll('.fp-friend .fp-steal-cta');
        if (friendButtons.length === 0) {
            alert('未找到任何好友！');
            return;
        }

        alert(`找到 ${friendButtons.length} 位好友，开始全自动操作～`);

        // 逐个处理好友
        for (let i = 0; i < friendButtons.length; i++) {
            const btn = friendButtons[i];

            // 点击进入好友农场
            btn.click();
            console.log(`正在进入第 ${i+1}/${friendButtons.length} 位好友农场`);

            // 等待页面加载（800ms 可根据网速调整）
            await new Promise(resolve => setTimeout(resolve, 2000));

            // 自动偷菜
            const stealBtns = document.querySelectorAll('.fp-btn.steal');
            stealBtns.forEach(b => b.click());

            // 自动浇水
            const waterBtns = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary');
            waterBtns.forEach(b => b.click());

            // 等待操作完成
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        alert('✅ 所有好友农场处理完毕！');
    };

})();
