// ==UserScript==
// @name         技术博客农场·偷菜浇水专用版(带浇水计数器)
// @namespace    http://tampermonkey.net/
// @version      14.5
// @description  偷菜、浇水、10分钟自动轮询 + 自动浇水累计计数器
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ========== 常量配置区 ==========
    const AUTO_INTERVAL = 10 * 60 * 1000; // 自动轮询间隔 10分钟
    const CLICK_DELAY_SHORT = 200;        // 短延时
    const FRIEND_LOAD_DELAY = 1000;       // 好友页面加载延时

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
        .farmBtn:disabled { opacity: 0.6; cursor: not-allowed; }
        #steal { background: #e67e22; }
        #water { background: #3498db; }
        #autoAll { background: #e74c3c; }
        #autoTips, #waterCountTips {
            font-size: 12px; color: #666; text-align:center;
            margin:6px 0;
        }
    `);

    // 延时函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 全局状态
    let autoTimer = null;
    let autoRunning = false;
    let totalWaterCount = 0; // 自动轮询浇水总计数器

    // 工具面板（新增浇水计数行）
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场工具</div>
        <button class="farmBtn" id="steal">🤲 一键偷好友菜</button>
        <button class="farmBtn" id="water">💧 一键帮浇水</button>
        <button class="farmBtn" id="autoAll">🚀 开启10分钟自动轮询</button>
        <div id="autoTips">当前状态：已关闭</div>
        <div id="waterCountTips">累计浇水：0 次</div>
    `;
    document.body.appendChild(panel);

    // 更新自动状态文本
    function updateAutoTip(text) {
        document.getElementById('autoTips').innerText = `当前状态：${text}`;
    }

    // 更新浇水计数显示
    function updateWaterCount() {
        document.getElementById('waterCountTips').innerText = `累计浇水：${totalWaterCount} 次`;
    }

    // 通用批量点击（带延时 + 计数判断）
    async function batchClick(selector, delayMs, isCountWater = false) {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
            btn.click();
            // 仅自动浇水时累加计数
            if (isCountWater) totalWaterCount++;
            await delay(delayMs);
        }
        return btns.length;
    }

    // 一键浇水（手动浇水 不计入自动计数器）
    document.getElementById('water').onclick = async function () {
        this.disabled = true;
        try {
            await batchClick('.fp-plot.thirsty .fp-btn.primary', CLICK_DELAY_SHORT);
        } catch (e) {
            console.error("浇水异常：", e);
        } finally {
            this.disabled = false;
        }
    };

    // 一键偷菜
    document.getElementById('steal').onclick = async function () {
        this.disabled = true;
        try {
            const len = await batchClick('.fp-btn.steal', CLICK_DELAY_SHORT);
            alert(`🤲 偷菜完成！共偷 ${len} 块`);
        } catch (e) {
            console.error("偷菜异常：", e);
        } finally {
            this.disabled = false;
        }
    };

    // 自动执行：遍历好友偷菜+浇水（浇水计入计数器）
    async function runStealAndWater() {
        try {
            const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
            if (friends.length === 0) {
                console.log('【自动任务】暂无好友列表');
                return;
            }
            console.log(`【自动任务】开始遍历 ${friends.length} 位好友`);
            for (let i = 0; i < friends.length; i++) {
                friends[i].click();
                await delay(FRIEND_LOAD_DELAY);
                // 偷菜
                await batchClick('.fp-btn.steal', CLICK_DELAY_SHORT);
                // 浇水：开启计数
                await batchClick('.fp-plot.thirsty .fp-btn.primary', CLICK_DELAY_SHORT, true);
                // 实时刷新页面计数
                updateWaterCount();
                await delay(CLICK_DELAY_SHORT);
            }
            console.log('【自动任务】本轮好友偷菜浇水执行完毕');
        } catch (e) {
            console.error("自动任务异常：", e);
        } finally {
            if (autoRunning) {
                autoTimer = setTimeout(runStealAndWater, AUTO_INTERVAL);
            }
        }
    }

    // 自动轮询启停
    document.getElementById('autoAll').onclick = function () {
        if (!autoRunning) {
            if (!confirm('🚀 确定开启【10分钟自动偷菜浇水轮询】？\n再次点击按钮可关闭')) return;
            autoRunning = true;
            this.innerText = '🚀 关闭自动轮询';
            updateAutoTip('运行中(每10分钟执行)');
            // 开启自动时重置计数器
            totalWaterCount = 0;
            updateWaterCount();
            runStealAndWater();
        } else {
            autoRunning = false;
            clearTimeout(autoTimer);
            autoTimer = null;
            this.innerText = '🚀 开启10分钟自动轮询';
            updateAutoTip('已关闭');
            alert(`✅ 已停止自动轮询，本轮总计浇水：${totalWaterCount} 次`);
        }
    };
})();
