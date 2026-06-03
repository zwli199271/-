// ==UserScript==
// @name         技术博客农场·自动收种双倍版(自动跳过守护+遍历完返回我的地块)
// @namespace    http://tampermonkey.net/
// @version      15.0
// @description  移除手动偷浇水、10分钟好友自动轮询+自动关守护弹窗+遍历完毕返回我的地块+浇水统计+成熟自动收菜→香荚兰→一键双倍
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
    const CHECK_INTERVAL = 3000;          // 自家土地成熟检测间隔3秒
    const BACK_HOME_DELAY = 800;          // 返回我的地块等待延时

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
        #autoAll { background: #e74c3c; }
        #autoCheckLand {background:#009688;}
        #autoTips, #waterCountTips {
            font-size: 12px; color: #666; text-align:center;
            margin:6px 0;
        }
    `);

    // 延时函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========= 新增：关闭守护弹窗公用函数 =========
    function closeGuardDialog() {
        let closeCount = 0;
        // 1.点右上角X关闭按钮
        const closeIcon = document.querySelector('.el-dialog__headerbtn');
        if (closeIcon) {
            closeIcon.click();
            closeCount++;
        }
        // 2.点弹窗内【确认】按钮兜底
        const confirmBtn = document.querySelector('.fp-pg-result-close');
        if (confirmBtn) {
            confirmBtn.click();
            closeCount++;
        }
        if(closeCount > 0) console.log('🛡️ 检测到守护弹窗，自动关闭');
        return closeCount;
    }

    // ========= 返回我的地块函数 =========
    async function backMyLand() {
        closeGuardDialog();
        // 根据span文字匹配：我的地块
        const backBtn = Array.from(document.querySelectorAll('.fp-nav-btn')).find(item=>{
            const txt = item.querySelector('.fp-nb-text')?.textContent.trim();
            return txt === '我的地块';
        });
        if(backBtn){
            backBtn.click();
            console.log('🏠 全部好友遍历完毕，返回【我的地块】');
            await delay(BACK_HOME_DELAY);
        }
    }

    // 全局状态
    let autoTimer = null;
    let autoRunning = false;
    let totalWaterCount = 0; // 自动轮询浇水总计数器
    let autoHarvestPlantTimer = null;
    let checkRunning = false;

    // 工具面板
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场工具</div>
        <button class="farmBtn" id="autoCheckLand">🌿 开启成熟自动收种双倍</button>
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
            closeGuardDialog(); // 每次点击后检查弹窗
        }
        return btns.length;
    }

    // 自动执行：遍历好友偷菜+浇水【循环检测守护弹窗】
    async function runStealAndWater() {
        try {
            const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
            if (friends.length === 0) {
                console.log('【自动任务】暂无好友列表');
                await backMyLand(); // 无好友也返回主页
                return;
            }
            console.log(`【自动任务】开始遍历 ${friends.length} 位好友`);
            for (let i = 0; i < friends.length; i++) {
                closeGuardDialog(); // 访问好友前先清弹窗
                friends[i].click();
                await delay(FRIEND_LOAD_DELAY);
                closeGuardDialog(); // 进入好友农场后清弹窗

                // 偷菜
                await batchClick('.fp-btn.steal', CLICK_DELAY_SHORT);
                closeGuardDialog();
                // 浇水：开启计数
                await batchClick('.fp-plot.thirsty .fp-btn.primary', CLICK_DELAY_SHORT, true);
                closeGuardDialog();

                // 实时刷新页面计数
                updateWaterCount();
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
            }
            console.log('【自动任务】本轮好友偷菜浇水执行完毕');
            // =====全部好友遍历结束，返回我的地块=====
            await backMyLand();
        } catch (e) {
            console.error("自动任务异常：", e);
            await backMyLand(); // 异常兜底返回自家地块
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

    // ========== 自家地块成熟自动收菜+种香荚兰+一键双倍 ==========
    // 启动地块循环监听
    function startAutoCheckLand() {
        if(autoHarvestPlantTimer) return;
        autoHarvestPlantTimer = setInterval(autoHarvestAndPlant, CHECK_INTERVAL);
        console.log("✅ 已开启成熟自动收菜+种香荚兰+自动双倍监听");
    }

    // 停止地块循环监听
    function stopAutoCheckLand() {
        clearInterval(autoHarvestPlantTimer);
        autoHarvestPlantTimer = null;
        console.log("❌ 关闭成熟自动收菜种植双倍");
    }

    // 核心流程：收菜→种香荚兰→一键双倍
    async function autoHarvestAndPlant() {
        closeGuardDialog(); // 自家土地检测前也清弹窗
        const ripePlots = document.querySelectorAll('.fp-plot.ripe');
        if (ripePlots.length === 0) return;

        console.log(`🥬 检测到${ripePlots.length}块成熟土地，执行自动收菜`);

        const vipBtns = document.querySelectorAll('button.fp-btn.vip');
        // 1.一键收菜 第1个
        if(vipBtns[0] && !vipBtns[0].disabled){
            vipBtns[0].click();
            await delay(1200);
            closeGuardDialog();
        }

        // 2.一键种菜 第2个
        if(vipBtns.length >=2 && !vipBtns[1].disabled){
            vipBtns[1].click();
            await delay(800);
            closeGuardDialog();
            // 选香荚兰播种
            const vanillaSeed = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '香荚兰');
            if(vanillaSeed){
                const useSeedBtn = vanillaSeed.querySelector('.fp-btn.primary.sm');
                if(useSeedBtn) useSeedBtn.click();
            }
            await delay(700);
            closeGuardDialog();
        }

        // 3.一键双倍 第三个 vip按钮
        if(vipBtns.length >=3 && !vipBtns[2].disabled){
            console.log('✨ 自动执行一键双倍经验');
            vipBtns[2].click();
            await delay(500);
            closeGuardDialog();
        }
    }

    // 自动收种开关点击事件
    document.getElementById('autoCheckLand').onclick = ()=>{
        if(!checkRunning){
            checkRunning = true;
            document.getElementById('autoCheckLand').innerText = '🌿 关闭成熟自动收种双倍';
            startAutoCheckLand();
        }else{
            checkRunning = false;
            document.getElementById('autoCheckLand').innerText = '🌿 开启成熟自动收种双倍';
            stopAutoCheckLand();
        }
    };

})();
