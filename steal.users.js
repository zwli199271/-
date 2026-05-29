// ==UserScript==
// @name         技术博客农场·全自动偷菜浇水版
// @namespace    http://tampermonkey.net/
// @version      13.0
// @description  白天种茉莉 | 晚上种松露 | 一键双倍 | 一键收获 | 全自动偷菜浇水
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
    `);

    // 延迟函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 工具面板
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场一键工具</div>
        <button class="farmBtn" id="plantDay">🌞 白天种植(茉莉)</button>
        <button class="farmBtn" id="plantNight">🌙 晚上种植(松露)</button>
        <button class="farmBtn" id="harvestAll">🌾 一键收获</button>
        <button class="farmBtn" id="doubleExp">✨ 一键双倍经验</button>
        <button class="farmBtn" id="steal">🤲 一键偷好友菜</button>
        <button class="farmBtn" id="water">💧 一键帮浇水</button>
        <button class="farmBtn" id="autoAll">🚀 全自动偷菜浇水</button>
    `;
    document.body.appendChild(panel);

    // ==========================================
    // 🌞 白天一键种植：茉莉
    // ==========================================
    document.getElementById('plantDay').onclick = async () => {
        const emptyPlots = document.querySelectorAll('.fp-plot.empty .fp-btn.primary');
        if (emptyPlots.length === 0) { alert('🌞 暂无空地可种植！'); return; }
        let count = 0;
        alert(`🌞 开始批量种植【茉莉】，共 ${emptyPlots.length} 块空地`);

        for (const plotBtn of emptyPlots) {
            plotBtn.click();
            await delay(800);

            const seedBtn = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '茉莉')
                ?.querySelector('.fp-btn.primary.sm');

            if (seedBtn) { seedBtn.click(); count++; await delay(600); }
        }
        alert(`🌞 种植完成！共种下 ${count} 块茉莉`);
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
        //alert(`🌙 种植完成！共种下 ${count} 块松露`);
    };

    // ==========================================
    // 🌾 一键收获（新增）
    // ==========================================
    document.getElementById('harvestAll').onclick = async () => {
        // 匹配成熟地块 + 收获按钮
        const harvestBtns = document.querySelectorAll('.fp-plot.ripe .fp-plot-actions .fp-btn.success');
        if (harvestBtns.length === 0) {
            alert('🌾 暂无成熟作物可收获！');
            return;
        }
        let count = 0;
        //alert(`🌾 开始收获，共 ${harvestBtns.length} 块成熟地块`);

        for (const btn of harvestBtns) {
            btn.click();
            count++;
            await delay(400);
        }
        //alert(`🌾 收获完成！共收获 ${count} 块作物`);
    };

    // ==========================================
    // ✨ 一键双倍经验卡
    // ==========================================
    document.getElementById('doubleExp').onclick = async () => {
        const plots = document.querySelectorAll('.fp-plot');
        if (plots.length === 0) { alert('✨ 未找到土地！'); return; }

        let count = 0;
        //alert(`✨ 开始为所有土地使用双倍经验卡（共 ${plots.length} 块）`);

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
        //alert(`🤲 偷菜完成！共偷 ${list.length} 块`);
    };

    // ==========================================
    // 🚀 全自动遍历好友偷菜+浇水
    // ==========================================
    document.getElementById('autoAll').onclick = async () => {
        if (!confirm('🚀 开始全自动偷菜浇水？')) return;
        const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
        if (friends.length === 0) { alert('未找到好友！'); return; }

        alert(`找到 ${friends.length} 位好友，开始执行～`);

        for (let i = 0; i < friends.length; i++) {
            friends[i].click();
            await delay(2200);

            const hasSteal = document.querySelectorAll('.fp-btn.steal').length > 0;
            const hasWater = document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary').length > 0;

            if (hasSteal) document.querySelectorAll('.fp-btn.steal').forEach(b => b.click());
            if (hasWater) document.querySelectorAll('.fp-plot.thirsty .fp-btn.primary').forEach(b => b.click());
            await delay(1000);
        }
        //alert('✅ 全部好友处理完毕！');
    };

})();
