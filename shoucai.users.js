// ==UserScript==
// @name         技术博客农场·高性能优化版(Observer+面板收起)
// @namespace    http://tampermonkey.net/
// @version      15.2
// @description  Mutation无轮询成熟检测、守护弹窗静默隐藏、自动收种双倍、好友自动浇水统计、面板一键折叠收起
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function () {
    'use strict';

    // ========== 常量配置区 ==========
    const AUTO_INTERVAL = 10 * 60 * 1000; // 好友自动轮询间隔 10分钟
    const CLICK_DELAY_SHORT = 200;
    const FRIEND_LOAD_DELAY = 1000;
    const BACK_HOME_DELAY = 800;

    GM_addStyle(`
        #farmTools {
            position: fixed; right: 10px; top: 100px;
            z-index: 999999; background: white;
            padding: 12px; border-radius: 10px;
            box-shadow: 0 0 10px #00000030; width: 180px;
            transition: all 0.3s ease;
        }
        /* 面板收起样式 */
        #farmTools.fold-panel {
            width: 42px !important;
            height: 42px !important;
            overflow: hidden;
            padding:0;
        }
        #farmTools.fold-panel > div:not(#foldBtnWrap),
        #farmTools.fold-panel .farmBtn,
        #farmTools.fold-panel #autoTips,
        #farmTools.fold-panel #waterCountTips {
            display:none !important;
        }
        #foldBtnWrap{
            text-align:center;
        }
        #foldBtn{
            width:36px;height:36px;
            border:none;border-radius:50%;
            background:#555;color:#fff;
            cursor:pointer;
            font-weight:bold;
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
        /* 优化：守护弹窗自动隐藏样式，杜绝弹窗闪烁 */
        .hideGuardDlg {
            opacity:0 !important;visibility:hidden !important;pointer-events:none !important;
        }
    `);

    // 延时函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ====================== 守护弹窗处理（优化：CSS隐藏+双关闭兜底） ======================
    function closeGuardDialog() {
        let closeCount = 0;
        // 守护弹窗外层遮罩
        const dlgWrap = document.querySelector('.el-overlay-dialog');
        if(dlgWrap) dlgWrap.closest('.el-overlay')?.classList.add('hideGuardDlg');
        // 关闭按钮
        const closeIcon = document.querySelector('.el-dialog__headerbtn');
        if (closeIcon) { closeIcon.click(); closeCount++; }
        // 确认按钮
        const confirmBtn = document.querySelector('.fp-pg-result-close');
        if (confirmBtn) { confirmBtn.click(); closeCount++; }
        if(closeCount > 0) console.log('🛡️ 守护弹窗自动静默关闭');
        return closeCount;
    }

    // 返回我的地块
    async function backMyLand() {
        closeGuardDialog();
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
    let totalWaterCount = 0;
    let checkRunning = false;
    let ripeObserver = null; // 成熟地块监听实例
    let isPanelFold = false; // 面板收起标记

    // 工具面板（新增收起按钮）
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div id="foldBtnWrap">
            <button id="foldBtn">−</button>
        </div>
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场工具</div>
        <button class="farmBtn" id="autoCheckLand">开启成熟自动收种双倍</button>
        <button class="farmBtn" id="autoAll">开启10分钟自动轮询</button>
        <div id="autoTips">当前状态：已关闭</div>
        <div id="waterCountTips">累计浇水：0 次</div>
    `;
    document.body.appendChild(panel);

    // 【面板收起/展开逻辑】
    const foldBtn = document.getElementById('foldBtn');
    foldBtn.onclick = ()=>{
        isPanelFold = !isPanelFold;
        panel.classList.toggle('fold-panel', isPanelFold);
        foldBtn.innerText = isPanelFold ? "+" : "−";
    };

    function updateAutoTip(text) {
        document.getElementById('autoTips').innerText = `当前状态：${text}`;
    }
    function updateWaterCount() {
        document.getElementById('waterCountTips').innerText = `累计浇水：${totalWaterCount} 次`;
    }

    // 批量点击
    async function batchClick(selector, delayMs, isCountWater = false) {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
            btn.click();
            if (isCountWater) totalWaterCount++;
            await delay(delayMs);
            closeGuardDialog();
        }
        return btns.length;
    }

    // 好友自动遍历
    async function runStealAndWater() {
        try {
            const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
            if (friends.length === 0) {
                console.log('【自动任务】暂无好友列表');
                await backMyLand();
                return;
            }
            console.log(`【自动任务】开始遍历 ${friends.length} 位好友`);
            for (let i = 0; i < friends.length; i++) {
                closeGuardDialog();
                friends[i].click();
                await delay(FRIEND_LOAD_DELAY);
                closeGuardDialog();
                await batchClick('.fp-btn.steal', CLICK_DELAY_SHORT);
                await batchClick('.fp-plot.thirsty .fp-btn.primary', CLICK_DELAY_SHORT, true);
                updateWaterCount();
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
            }
            console.log('【自动任务】本轮好友偷菜浇水执行完毕');
            await backMyLand();
        } catch (e) {
            console.error("自动任务异常：", e);
            await backMyLand();
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

    // ======================【优化核心】Mutation监听成熟地块，替换3秒setInterval轮询 ======================
    async function autoHarvestAndPlant() {
        closeGuardDialog();
        const ripePlots = document.querySelectorAll('.fp-plot.ripe');
        if (ripePlots.length === 0) return;
        console.log(`🥬 检测到${ripePlots.length}块成熟土地，执行自动收菜`);
        const vipBtns = document.querySelectorAll('button.fp-btn.vip');
        // 1一键收菜
        if(vipBtns[0] && !vipBtns[0].disabled){
            vipBtns[0].click();
            await delay(800);
            closeGuardDialog();
        }
        // 2一键种香荚兰
        if(vipBtns.length >=2 && !vipBtns[1].disabled){
            vipBtns[1].click();
            await delay(800);
            closeGuardDialog();
            const vanillaSeed = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '香荚兰');
            if(vanillaSeed){
                const useSeedBtn = vanillaSeed.querySelector('.fp-btn.primary.sm');
                if(useSeedBtn) useSeedBtn.click();
            }
            await delay(700);
            closeGuardDialog();
        }
        //3一键双倍
        if(vipBtns.length >=3 && !vipBtns[2].disabled){
            console.log('✨ 自动执行一键双倍经验');
            vipBtns[2].click();
            await delay(500);
            closeGuardDialog();
        }
    }

    // 开启成熟DOM监听
    function startAutoCheckLand() {
        if(checkRunning) return;
        checkRunning = true;
        document.getElementById('autoCheckLand').innerText = '🌿 关闭成熟自动收种双倍';
        // 创建观察者，监测地块class变化
        ripeObserver = new MutationObserver(mut=>{
            let needRun = false;
            for(let item of mut){
                // class变化出现ripe成熟标识
                if(item.target.classList.contains('ripe')) needRun = true;
                // 新增成熟地块DOM
                for(let n of item.addedNodes){
                    if(n.classList?.contains('ripe')) needRun = true;
                }
            }
            if(needRun) autoHarvestAndPlant();
        });
        ripeObserver.observe(document.documentElement,{
            attributes:true,attributeFilter:["class"],
            childList:true,subtree:true
        });
        console.log("✅ Mutation监听已启用：地块成熟瞬间自动触发收种");
        // 启动瞬间兜底扫描一次
        autoHarvestAndPlant();
    }
    // 关闭监听
    function stopAutoCheckLand() {
        if(!checkRunning) return;
        checkRunning = false;
        document.getElementById('autoCheckLand').innerText = '🌿 开启成熟自动收种双倍';
        if(ripeObserver){
            ripeObserver.disconnect();
            ripeObserver = null;
        }
        console.log("❌ 关闭成熟自动收菜种植双倍");
    }

    // 开关绑定
    document.getElementById('autoCheckLand').onclick = ()=>{
        checkRunning ? stopAutoCheckLand() : startAutoCheckLand();
    };

})();
