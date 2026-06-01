// ==UserScript==
// @name         技术博客农场·全自动偷菜浇水版
// @namespace    http://tampermonkey.net/
// @version      14.2
// @description  白天种金麦 | 晚上种松露 | 一键双倍 | 一键收获 | 全自动偷菜浇水 + 10分钟定时轮询
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    GM_addStyle(`
        #farmTools {
            position: fixed; right: 10px; top: 100px;
            z-index: 999999; background: white;
            padding: 12px; border-radius: 10px;
            box-shadow: 0 0 10px #00000030; width: 180px;
        }
        .farmBtn {
            width: 100%; padding: 8px; margin: 4px 0;
            border: none; border-radius: 6px;
            color: white; font-weight: bold; cursor: pointer;
        }
        #plantDay { background: #f39c12; }
        #plantNight { background: #8e44ad; }
        #doubleExp { background: #27ae60; }
        #harvestAll { background: #16a085; }
        #steal { background: #e67e22; }
        #water { background: #3498db; }
        #autoAll { background: #e74c3c; }
        #autoTips {
            font-size: 12px; color: #666; text-align:center;
            margin:6px 0;
        }
    `);

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== 定时任务全局变量 10分钟 = 600000ms ==========
    const AUTO_INTERVAL = 600000; 
    let autoTimer = null;
    let autoRunning = false;

    // 工具面板
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场一键工具</div>
        <button class="farmBtn" id="plantDay">🌞 白天种植(金麦)</button>
        <button class="farmBtn" id="plantNight">🌙 晚上种植(松露)</button>
        <button class="farmBtn" id="harvestAll">🌾 一键收获</button>
        <button class="farmBtn" id="doubleExp">✨ 一键双倍经验</button>
        <button class="farmBtn" id="steal">🤲 一键偷好友菜</button>
        <button class="farmBtn" id="water">💧 一键帮浇水</button>
        <button class="farmBtn" id="autoAll">🚀 开启10分钟自动轮询</button>
        <div id="autoTips">当前状态：已关闭</div>
    `;
    document.body.appendChild(panel);

    // 更新自动状态文本
    function updateAutoTip(text) {
        document.getElementById('autoTips').innerText = `当前状态：${text}`;
    }

    // ==========================================
    // 🌞 白天一键种植：金麦
    // ==========================================
    document.getElementById('plantDay').onclick = async () => {
        const emptyPlots = document.querySelectorAll('.fp-plot.empty .fp-btn.primary');
        if (emptyPlots.length === 0) { alert('🌞 暂无空地可种植！'); return; }
        let count = 0;
        alert(`🌞 开始批量种植【金麦】，共 ${emptyPlots.length} 块空地`);

        for (const plotBtn of emptyPlots) {
            plotBtn.click();
            await delay(800);

            const seedBtn = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '金麦')
                ?.querySelector('.fp-btn.primary.sm');

            if (seedBtn) { seedBtn.click(); count++; await delay(600); }
        }
        alert(`🌞 种植完成！共种下 ${count} 块金麦`);
    };

    // ==========================================
    // 🌙 晚上一键种植：松露
    // ==========================================
    document.getElementById('plantNight').onclick = async () => {
        const emptyPlots = document.querySelectorAll('.fp-plot.empty .fp-btn.primary');
        if (emptyPlots.length === 0) { alert('🌙 暂无空地可种植！'); return; }
        let count = 0;
        alert(`🌙 开始批量种植【松露】，共 ${emptyPlots.length} 块空地`);

        for (const plotBtn of emptyPlots) {
            plotBtn.click();
            await delay(800);

            const seedBtn = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '松露')
                ?.querySelector('.fp-btn.primary.sm');

            if (seedBtn) { seedBtn.click(); count++; await delay(600); }
        }
        alert(`🌙 种植完成！共种下 ${count} 块松露`);
    };

    // ==========================================
    // 🌾 一键收获
    // ==========================================
    document.getElementById('harvestAll').onclick = async () => {
        const harvestBtns = document.querySelectorAll('.fp-plot.ripe .fp-plot-actions .fp-btn.success');
        if (harvestBtns.length === 0) {
            alert('🌾 暂无成熟作物可收获！');
            return;
        }
        let count = 0;
        alert(`🌾 开始收获，共 ${harvestBtns.length} 块成熟地块`);

        for (const btn of harvestBtns) {
            btn.click();
            count++;
        }
        alert(`🌾 收获完成！共收获 ${count} 块作物`);
    };

    // ==========================================
    // ✨ 一键双倍经验卡
    // ==========================================
    document.getElementById('doubleExp').onclick = async () => {
        const plots = document.querySelectorAll('.fp-plot');
        if (plots.length === 0) { alert('✨ 未找到土地！'); return; }

        let count = 0;
        alert(`✨ 开始为所有土地使用双倍经验卡（共 ${plots.length} 块）`);

        for (const plot of plots) {
            const itemBtn = plot.querySelector('.fp-plot-actions .fp-btn.ghost');
            if (!itemBtn) continue;

            itemBtn.click();
            await delay(800);

            const card = Array.from(document.querySelectorAll('.fp-item-card')).find(c =>
                c.querySelector('.fp-ic-name')?.textContent.trim() === '双倍经验卡'
            );
            const useBtn = card?.querySelector('.fp-btn.primary.sm');

            if (useBtn) {
                useBtn.click();
                count++;
                await delay(600);
            }
        }
        alert(`✨ 双倍经验卡使用完成！共生效 ${count} 块土地`);
    };

    // ==========================================
    // 💧 一键浇水
    // ==========================================
    document.getElementById('water').onclick = () => {
        const waterBtns = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary');
        waterBtns.forEach(btn => btn.click());
    };

    // ==========================================
    // 🤲 一键偷菜
    // ==========================================
    document.getElementById('steal').onclick = () => {
        const list = document.querySelectorAll('.fp-btn.steal');
        list.forEach(b => b.click());
        alert(`🤲 偷菜完成！共偷 ${list.length} 块`);
    };

    // ==========================================
    // 核心：单次遍历好友偷菜+浇水（抽离为独立函数，供定时调用）
    // ==========================================
    async function runStealAndWater() {
        const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
        if (friends.length === 0) {
            console.log('暂无好友列表');
            return;
        }
        console.log(`开始遍历 ${friends.length} 位好友`);

        for (let i = 0; i < friends.length; i++) {
            friends[i].click();
            await delay(1000);

            // 偷菜
            const stealBtns = document.querySelectorAll('.fp-btn.steal');
            stealBtns.forEach(b => b.click());

            // 浇水
            const waterBtns = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary');
            waterBtns.forEach(b => b.click());

            await delay(200);
        }
        console.log('本轮好友偷菜浇水执行完毕');
    }

    // ==========================================
    // 🚀 启停 10分钟定时自动轮询
    // ==========================================
    document.getElementById('autoAll').onclick = () => {
        const btn = document.getElementById('autoAll');

        if (!autoRunning) {
            // 开启定时
            if (!confirm('🚀 确定开启【10分钟自动偷菜浇水轮询】？\n再次点击按钮可关闭')) return;
            autoRunning = true;
            btn.innerText = '🚀 关闭自动轮询';
            updateAutoTip('运行中(每10分钟执行)');

            // 立即执行一次，再开启定时
            runStealAndWater();
            autoTimer = setInterval(runStealAndWater, AUTO_INTERVAL);
        } else {
            // 关闭定时
            autoRunning = false;
            clearInterval(autoTimer);
            autoTimer = null;
            btn.innerText = '🚀 开启10分钟自动轮询';
            updateAutoTip('已关闭');
            alert('✅ 已停止10分钟自动轮询');
        }
    };

})();
