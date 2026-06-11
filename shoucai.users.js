// ==UserScript==
// @name         技术博客农场·高性能优化版(Observer+面板收起+加载更多好友+仅好友遍历自动跳过战斗弹窗+无声保活防后台检测)
// @namespace    http://tampermonkey.net/
// @version      15.11
// @description  Mutation无轮询成熟检测、自动加载全部分页好友、好友遍历期间守护+战斗弹窗静默隐藏、自动收种双倍、好友浇水+轮询次数双统计、面板一键折叠，内置无声保活音频防止后台冻结，非好友阶段不处理战斗弹窗，修复MouseEvent报错
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
    const LOAD_MORE_DELAY = 1200; // 加载更多好友等待延时

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
        #farmTools.fold-panel #statTips {
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
        #autoTips, #statTips {
            font-size: 12px; color: #666; text-align:center;
            margin:6px 0;
        }
        /* 原有守护弹窗隐藏 */
        .hideGuardDlg {
            opacity:0 !important;visibility:hidden !important;pointer-events:none !important;
        }
        /* 战斗弹窗隐藏样式 */
        .qpet-hide-battle-overlay {
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
        }
        .qpet-hide-battle-overlay .battle-stage-dialog,
        .qpet-hide-battle-overlay .battle-dialog {
            display: none !important;
        }
    `);

    // 延时函数
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ====================== 无声后台保活音频模块（自动启动，无静音按钮） ======================
    let bgSilentAudio = null;
    // 空白wav base64 无声音频，静音循环保活，规避后台休眠检测
    function createSilentKeepAliveAudio() {
        if (bgSilentAudio) return;
        const silentSrc = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAA==";
        bgSilentAudio = new Audio(silentSrc);
        bgSilentAudio.loop = true;
        bgSilentAudio.muted = true;
        bgSilentAudio.volume = 0;
        const playAudio = () => {
            bgSilentAudio.play().then(() => {
                console.log("🔇 无声保活音频运行中，防止后台标签冻结");
                document.removeEventListener('click', playAudio);
            }).catch(()=>{});
        };
        // 浏览器自动播放策略限制，页面任意点击后自动激活音频
        document.addEventListener('click', playAudio);
        // 尝试自动播放
        bgSilentAudio.play().catch(()=>{});
    }

    // 模拟ESC按键
    function pressEscape() {
        const evt = new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true});
        document.dispatchEvent(evt);
    }

    // 【修复】改用原生el.click()，移除手动MouseEvent构造，消除view报错
    function clickElement(el){
        if(!el)return false;
        el.click();
        return true;
    }

    // 隐藏战斗遮罩
    function hideBattleOverlay(dialog){
        const overlay = dialog.closest('.el-overlay.el-modal-dialog');
        if(overlay) overlay.classList.add('qpet-hide-battle-overlay');
    }
    // 处理战斗开局弹窗battle-stage-dialog
    function handleStageDialog(dialog){
        hideBattleOverlay(dialog);
        const skipBtn = dialog.querySelector('.playing-skip-btn');
        if(clickElement(skipBtn))return;
        pressEscape();
    }
    // 处理战斗详情弹窗battle-dialog
    function handleDetailDialog(dialog){
        hideBattleOverlay(dialog);
        const closeBtn = dialog.querySelector('.el-dialog__headerbtn');
        if(clickElement(closeBtn))return;
        pressEscape();
        setTimeout(pressEscape,80);
    }
    // 单弹窗处理（带150ms防重复节流）
    function processBattleDialog(dialog){
        if(!(dialog instanceof HTMLElement))return;
        const now = Date.now();
        const last = Number(dialog.dataset.qpetLastHandledAt||0);
        if(now-last<150)return;
        dialog.dataset.qpetLastHandledAt = String(now);
        if(dialog.matches('.battle-stage-dialog')) handleStageDialog(dialog);
        if(dialog.matches('.battle-dialog:not(.battle-stage-dialog)')) handleDetailDialog(dialog);
    }
    // 全局扫描已有战斗弹窗
    function scanAllBattleDlg(){
        document.querySelectorAll('.battle-stage-dialog,.battle-dialog').forEach(processBattleDialog);
    }

    // ====================== 守护弹窗关闭函数（不再主动处理战斗弹窗） ======================
    function closeGuardDialog() {
        let closeCount = 0;
        // 仅处理农场守护弹窗
        const dlgWrap = document.querySelector('.el-overlay-dialog');
        if(dlgWrap) dlgWrap.closest('.el-overlay')?.classList.add('hideGuardDlg');
        const closeIcon = document.querySelector('.el-dialog__headerbtn');
        if (closeIcon) { clickElement(closeIcon); closeCount++; }
        const confirmBtn = document.querySelector('.fp-pg-result-close');
        if (confirmBtn) { clickElement(confirmBtn); closeCount++; }
        if(closeCount > 0) console.log('🛡️ 守护弹窗自动静默关闭');
        return closeCount;
    }

    // 自动加载全部分页好友
    async function loadAllMoreFriends() {
        let loadMoreBtn;
        let loopCount = 0;
        const maxLoop = 20; // 最多循环20次防止死循环
        while(loopCount < maxLoop){
            closeGuardDialog();
            loadMoreBtn = document.querySelector('.fp-load-more-btn');
            if(!loadMoreBtn || loadMoreBtn.offsetParent === null) break;
            console.log(`📥 发现加载更多好友按钮，第${loopCount+1}次加载`);
            clickElement(loadMoreBtn);
            await delay(LOAD_MORE_DELAY);
            loopCount++;
        }
        console.log(`✅ 好友列表加载完成，共执行${loopCount}次分页加载`);
    }

    // 返回我的地块 + 销毁战斗弹窗监听
    async function backMyLand() {
        closeGuardDialog();
        // 好友遍历结束，销毁战斗弹窗监听
        if(battleDlgObserver){
            battleDlgObserver.disconnect();
            battleDlgObserver = null;
            console.log("⚔️ 好友遍历完成，关闭战斗弹窗监听");
        }
        const backBtn = Array.from(document.querySelectorAll('.fp-nav-btn')).find(item=>{
            const txt = item.querySelector('.fp-nb-text')?.textContent.trim();
            return txt === '我的地块';
        });
        if(backBtn){
            clickElement(backBtn);
            console.log('🏠 全部好友遍历完毕，返回【我的地块】');
            await delay(BACK_HOME_DELAY);
        }
    }

    // 全局状态
    let autoTimer = null;
    let autoRunning = false;
    let totalWaterCount = 0;    // 累计浇水次数
    let totalRoundCount = 0;    // 自动轮询完成次数
    let checkRunning = false;
    let ripeObserver = null; // 成熟地块监听实例
    let isPanelFold = false; // 面板收起标记
    let battleDlgObserver = null; // 仅好友遍历启用的战斗弹窗监听

    // 工具面板（修改统计文字容器id）
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
        <div id="statTips">累计浇水：0 次 | 已完成轮询：0 轮</div>
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
    // 同时更新浇水+轮询统计
    function updateStatInfo() {
        document.getElementById('statTips').innerText = `累计浇水：${totalWaterCount} 次 | 已完成轮询：${totalRoundCount} 轮`;
    }

    // 批量点击
    async function batchClick(selector, delayMs, isCountWater = false) {
        const btns = document.querySelectorAll(selector);
        for (const btn of btns) {
            clickElement(btn);
            if (isCountWater) totalWaterCount++;
            await delay(delayMs);
            closeGuardDialog();
            // 好友操作中实时清理战斗弹窗
            if(battleDlgObserver) scanAllBattleDlg();
        }
        return btns.length;
    }

    // 初始化战斗弹窗监听（仅好友遍历调用）
    function initBattleDialogObserver(){
        if(battleDlgObserver) return;
        scanAllBattleDlg();
        battleDlgObserver = new MutationObserver(muts=>{
            for(let m of muts){
                for(let node of m.addedNodes){
                    if(!(node instanceof HTMLElement))continue;
                    if(node.matches('.battle-stage-dialog,.battle-dialog')) processBattleDialog(node);
                    node.querySelectorAll?.('.battle-stage-dialog,.battle-dialog').forEach(processBattleDialog);
                }
            }
        });
        battleDlgObserver.observe(document.documentElement,{childList:true,subtree:true});
        console.log("⚔️ 开始好友遍历，启用战斗弹窗自动拦截监听");
    }

    // 好友自动遍历
    async function runStealAndWater() {
        try {
            // 进入好友流程，启动战斗弹窗监听
            initBattleDialogObserver();
            // 第一步：自动加载全部分页好友
            await loadAllMoreFriends();

            const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
            if (friends.length === 0) {
                console.log('【自动任务】暂无好友列表');
                await backMyLand();
                return;
            }
            console.log(`【自动任务】开始遍历 ${friends.length} 位好友`);
            for (let i = 0; i < friends.length; i++) {
                closeGuardDialog();
                clickElement(friends[i]);
                await delay(FRIEND_LOAD_DELAY);
                closeGuardDialog();
                await batchClick('.fp-btn.steal', CLICK_DELAY_SHORT);
                await batchClick('.fp-plot.thirsty .fp-btn.primary', CLICK_DELAY_SHORT, true);
                updateStatInfo();
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
            }
            console.log('【自动任务】本轮好友偷菜浇水执行完毕');
            // 一轮完整遍历完成，轮询计数+1
            totalRoundCount++;
            updateStatInfo();
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
            if (!confirm('🚀 确定开启【10分钟自动偷菜浇水轮询】？\n自动加载全部分页好友，遍历好友期间自动关闭战斗弹窗，返回地块后停止监听')) return;
            autoRunning = true;
            this.innerText = '🚀 关闭自动轮询';
            updateAutoTip('运行中(每10分钟执行)');
            // 开启轮询重置统计
            totalWaterCount = 0;
            totalRoundCount = 0;
            updateStatInfo();
            runStealAndWater();
        } else {
            autoRunning = false;
            clearTimeout(autoTimer);
            autoTimer = null;
            // 停止轮询时销毁战斗监听
            if(battleDlgObserver){
                battleDlgObserver.disconnect();
                battleDlgObserver = null;
            }
            this.innerText = '🚀 开启10分钟自动轮询';
            updateAutoTip('已关闭');
            alert(`✅ 已停止自动轮询\n本轮总计浇水：${totalWaterCount} 次\n完成轮询：${totalRoundCount} 轮`);
        }
    };

    // ======================【优化核心】Mutation监听成熟地块 ======================
    async function autoHarvestAndPlant() {
        closeGuardDialog();
        // 本地收菜不监听战斗弹窗，不处理战斗弹窗
        const ripePlots = document.querySelectorAll('.fp-plot.ripe');
        if (ripePlots.length === 0) return;
        console.log(`🥬 检测到${ripePlots.length}块成熟土地，执行自动收菜`);
        const vipBtns = document.querySelectorAll('button.fp-btn.vip');
        // 1一键收菜
        if(vipBtns[0] && !vipBtns[0].disabled){
            clickElement(vipBtns[0]);
            await delay(800);
            closeGuardDialog();
        }
        // 2一键种香荚兰
        if(vipBtns.length >=2 && !vipBtns[1].disabled){
            clickElement(vipBtns[1]);
            await delay(800);
            closeGuardDialog();
            const vanillaSeed = Array.from(document.querySelectorAll('.fp-seed-card'))
                .find(card => card.querySelector('.fp-sc-name')?.textContent.trim() === '香荚兰');
            if(vanillaSeed){
                const useSeedBtn = vanillaSeed.querySelector('.fp-btn.primary.sm');
                if(useSeedBtn) clickElement(useSeedBtn);
            }
            await delay(700);
            closeGuardDialog();
        }
        //3一键双倍
        if(vipBtns.length >=3 && !vipBtns[2].disabled){
            console.log('✨ 自动执行一键双倍经验');
            clickElement(vipBtns[2]);
            await delay(500);
            closeGuardDialog();
        }
    }

    // 开启成熟DOM监听
    function startAutoCheckLand() {
        if(checkRunning) return;
        checkRunning = true;
        document.getElementById('autoCheckLand').innerText = '🌿 关闭成熟自动收种双倍';
        ripeObserver = new MutationObserver(mut=>{
            let needRun = false;
            for(let item of mut){
                if(item.target.classList.contains('ripe')) needRun = true;
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

    // 脚本初始化：启动无声保活音频
    createSilentKeepAliveAudio();

})();
