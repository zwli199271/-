// ==UserScript==
// @name         技术博客农场·高性能优化版(好友先浇水后偷菜+默认全偷+自动启动开关)
// @namespace    http://tampermonkey.net/
// @version      16.8
// @description  Mutation无轮询成熟检测、自动加载全部分页好友、偷取模式一键切换(全偷/仅前20高收益)【默认全偷】、松露仅偷标注可偷满地块、好友单地块先浇水后偷菜、单个好友操作完成后增加停留时间保证操作完整、自家地块支持一键翻地、新增自动启动配置：页面加载完自动开启收种+自动轮询好友、守护+战斗弹窗静默隐藏、自动收种双倍、好友浇水+轮询次数双统计、面板一键折叠，内置无声保活音频防止后台冻结，非好友阶段不处理战斗弹窗，修复MouseEvent报错
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
    const FULL_RIPE_KEYWORD = "可偷满"; // 松露满成熟标识文字
    const SINGLE_FRIEND_WAIT = 500; // 单个好友全部操作完成后停留2秒再切换下一位

    // 作物收益前20白名单，仅偷这些作物
    const TOP20_CROP_LIST = new Set([
        "冬虫夏草",
        "天山雪莲",
        "昙花",
        "永恒之花",
        "龙珠果",
        "幽灵兰",
        "凤凰果",
        "松露",
        "月光草",
        "大王花",
        "冰晶花",
        "黑松露",
        "蓝玫瑰",
        "人参",
        "藏红花",
        "火龙果",
        "雪梨",
        "椰子",
        "杨桃",
        "樱花"
    ]);

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
        #switchStealMode {background:#e67e22; margin-top:4px;}
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
        document.addEventListener('click', playAudio);
        bgSilentAudio.play().catch(()=>{});
    }

    // 模拟ESC按键
    function pressEscape() {
        const evt = new KeyboardEvent('keydown',{key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true});
        document.dispatchEvent(evt);
    }

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
    function handleStageDialog(dialog){
        hideBattleOverlay(dialog);
        const skipBtn = dialog.querySelector('.playing-skip-btn');
        if(clickElement(skipBtn))return;
        pressEscape();
    }
    function handleDetailDialog(dialog){
        hideBattleOverlay(dialog);
        const closeBtn = dialog.querySelector('.el-dialog__headerbtn');
        if(clickElement(closeBtn))return;
        pressEscape();
        setTimeout(pressEscape,80);
    }
    function processBattleDialog(dialog){
        if(!(dialog instanceof HTMLElement))return;
        const now = Date.now();
        const last = Number(dialog.dataset.qpetLastHandledAt||0);
        if(now-last<150)return;
        dialog.dataset.qpetLastHandledAt = String(now);
        if(dialog.matches('.battle-stage-dialog')) handleStageDialog(dialog);
        if(dialog.matches('.battle-dialog:not(.battle-stage-dialog)')) handleDetailDialog(dialog);
    }
    function scanAllBattleDlg(){
        document.querySelectorAll('.battle-stage-dialog,.battle-dialog').forEach(processBattleDialog);
    }

    // ====================== 守护弹窗关闭函数 ======================
    function closeGuardDialog() {
        let closeCount = 0;
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
        const maxLoop = 20;
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
    let totalWaterCount = 0;
    let totalRoundCount = 0;
    let checkRunning = false;
    let ripeObserver = null;
    let isPanelFold = false;
    let battleDlgObserver = null;
    // 需求2：默认全偷模式 false=全部成熟都偷
    let onlyStealTop20 = false;
    // 需求3：自动启动总开关，true=页面加载完自动开启收种+自动轮询好友
    const autoStartScript = true;

    // 工具面板
    const panel = document.createElement('div');
    panel.id = 'farmTools';
    panel.innerHTML = `
        <div id="foldBtnWrap">
            <button id="foldBtn">−</button>
        </div>
        <div style="font-weight:bold;margin-bottom:8px">🌱 农场工具</div>
        <button class="farmBtn" id="autoCheckLand">开启成熟自动收种双倍</button>
        <button class="farmBtn" id="autoAll">开启10分钟自动轮询</button>
        <button class="farmBtn" id="switchStealMode">当前：全部成熟作物都偷</button>
        <div id="autoTips">当前状态：已关闭</div>
        <div id="statTips">累计浇水：0 次 | 已完成轮询：0 轮</div>
    `;
    document.body.appendChild(panel);

    // 面板收起/展开
    const foldBtn = document.getElementById('foldBtn');
    foldBtn.onclick = ()=>{
        isPanelFold = !isPanelFold;
        panel.classList.toggle('fold-panel', isPanelFold);
        foldBtn.innerText = isPanelFold ? "+" : "−";
    };

    // 更新偷取模式按钮文字颜色
    function refreshStealModeBtn() {
        const btn = document.getElementById('switchStealMode');
        if(onlyStealTop20){
            btn.innerText = "当前：仅偷前20高收益作物";
            btn.style.background = "#27ae60";
        }else{
            btn.innerText = "当前：全部成熟作物都偷";
            btn.style.background = "#e67e22";
        }
    }

    // 切换偷取模式
    document.getElementById('switchStealMode').onclick = ()=>{
        onlyStealTop20 = !onlyStealTop20;
        refreshStealModeBtn();
        const tip = onlyStealTop20 ? "已切换：仅偷收益前20作物（松露只偷可偷满地块）" : "已切换：所有成熟作物全部偷取（松露无满成熟限制）";
        console.log(`🔄 ${tip}`);
        alert(tip);
    };

    function updateAutoTip(text) {
        document.getElementById('autoTips').innerText = `当前状态：${text}`;
    }
    function updateStatInfo() {
        document.getElementById('statTips').innerText = `累计浇水：${totalWaterCount} 次 | 已完成轮询：${totalRoundCount} 轮`;
    }

    // 【分支1：仅偷前20，顺序：先浇水 → 再偷菜】
    async function stealTop20CropOnly() {
        const allPlots = document.querySelectorAll('.fp-plot');
        for(const plot of allPlots) {
            closeGuardDialog();
            const textEl = plot.querySelector('.fp-plot-text');
            if(!textEl) continue;
            const text = textEl.textContent.trim();
            const cropMatch = text.match(/地块 \d+：(.+?)\s+/);
            if(!cropMatch) continue;
            const cropName = cropMatch[1].trim();

            const stealBtn = plot.querySelector('.fp-btn.steal');
            const waterBtn = plot.querySelector('.fp-plot.thirsty .fp-btn.primary');

            // 第一步：先浇水
            if(waterBtn){
                console.log(`💧 地块【${cropName}】执行浇水`);
                clickElement(waterBtn);
                totalWaterCount++;
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
                if(battleDlgObserver) scanAllBattleDlg();
                updateStatInfo();
            }

            // 不在白名单直接跳过偷菜
            if(!TOP20_CROP_LIST.has(cropName)) {
                console.log(`⏭️ 低收益作物【${cropName}】跳过偷菜`);
                continue;
            }

            // 松露限制
            if(cropName === "松露" && !text.includes(FULL_RIPE_KEYWORD)) {
                console.log(`⏭️ 松露未满成熟，跳过偷菜`);
                continue;
            }

            // 第二步：再偷菜
            if(stealBtn){
                console.log(`🥬 地块【${cropName}】执行偷菜`);
                clickElement(stealBtn);
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
                if(battleDlgObserver) scanAllBattleDlg();
            }
        }
    }

    // 【分支2：全偷模式，顺序：先浇水 → 再偷菜】
    async function stealAllRipeCrop() {
        const allPlots = document.querySelectorAll('.fp-plot');
        for(const plot of allPlots) {
            closeGuardDialog();
            const stealBtn = plot.querySelector('.fp-btn.steal');
            const waterBtn = plot.querySelector('.fp-plot.thirsty .fp-btn.primary');

            // 先浇水
            if(waterBtn){
                clickElement(waterBtn);
                totalWaterCount++;
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
                if(battleDlgObserver) scanAllBattleDlg();
                updateStatInfo();
            }
            // 后偷菜
            if(stealBtn){
                clickElement(stealBtn);
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();
                if(battleDlgObserver) scanAllBattleDlg();
            }
        }
        console.log(`📦 全量模式：先浇水后偷菜遍历完成`);
    }

    // 初始化战斗弹窗监听
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

    // 好友遍历主逻辑
    async function runStealAndWater() {
        try {
            initBattleDialogObserver();
            await loadAllMoreFriends();

            const friends = document.querySelectorAll('.fp-friend .fp-steal-cta');
            if (friends.length === 0) {
                console.log('【自动任务】暂无好友列表');
                await backMyLand();
                return;
            }
            const modeTip = onlyStealTop20 ? "仅前20高收益(松露只偷可偷满)" : "全部成熟作物无限制";
            console.log(`【自动任务】开始遍历 ${friends.length} 位好友，当前偷取模式：${modeTip}，单地块顺序：先浇水→后偷菜`);
            for (let i = 0; i < friends.length; i++) {
                closeGuardDialog();
                clickElement(friends[i]);
                await delay(FRIEND_LOAD_DELAY);
                closeGuardDialog();

                if(onlyStealTop20){
                    await stealTop20CropOnly();
                }else{
                    await stealAllRipeCrop();
                }

                updateStatInfo();
                await delay(CLICK_DELAY_SHORT);
                closeGuardDialog();

                console.log(`⏸️ 当前好友操作完成，等待${SINGLE_FRIEND_WAIT/1000}秒切换下一位`);
                await delay(SINGLE_FRIEND_WAIT);
            }
            console.log('【自动任务】本轮好友浇水偷菜执行完毕');
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

    // 自动轮询开关
    document.getElementById('autoAll').onclick = function () {
        if (!autoRunning) {
            const modeTip = onlyStealTop20 ? "仅偷收益前20高收益作物（松露仅偷标注可偷满地块）" : "全部成熟作物偷取（松露无限制）";
            if (!confirm(`🚀 确定开启【10分钟自动偷菜浇水轮询】？\n当前偷取模式：${modeTip}\n地块操作顺序：先浇水、后偷菜\n每位好友操作完成后自动停留2秒再切换下一个`)) return;
            autoRunning = true;
            this.innerText = '🚀 关闭自动轮询';
            updateAutoTip('运行中(每10分钟执行)');
            totalWaterCount = 0;
            totalRoundCount = 0;
            updateStatInfo();
            runStealAndWater();
        } else {
            autoRunning = false;
            clearTimeout(autoTimer);
            autoTimer = null;
            if(battleDlgObserver){
                battleDlgObserver.disconnect();
                battleDlgObserver = null;
            }
            this.innerText = '🚀 开启10分钟自动轮询';
            updateAutoTip('已关闭');
            alert(`✅ 已停止自动轮询\n本轮总计浇水：${totalWaterCount} 次\n完成轮询：${totalRoundCount} 轮`);
        }
    };

    // 自家地块自动收种（VIP翻地保留）
    async function autoHarvestAndPlant() {
        closeGuardDialog();
        const ripePlots = document.querySelectorAll('.fp-plot.ripe');
        if (ripePlots.length === 0) return;
        console.log(`🥬 检测到${ripePlots.length}块成熟土地，执行自动收菜`);
        const vipBtns = document.querySelectorAll('button.fp-btn.vip');
        if(vipBtns[1] && !vipBtns[1].disabled){
            clickElement(vipBtns[1]);
            await delay(800);
            closeGuardDialog();
        }
        if(vipBtns[0] && !vipBtns[0].disabled){
            clickElement(vipBtns[0]);
            await delay(800);
            closeGuardDialog();
        }
        if(vipBtns.length >=2 && !vipBtns[2].disabled){
            clickElement(vipBtns[2]);
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
        if(vipBtns.length >=3 && !vipBtns[3].disabled){
            console.log('✨ 自动执行一键双倍经验');
            clickElement(vipBtns[3]);
            await delay(500);
            closeGuardDialog();
        }
    }

    // 开启成熟监听
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

    document.getElementById('autoCheckLand').onclick = ()=>{
        checkRunning ? stopAutoCheckLand() : startAutoCheckLand();
    };

    // 初始化按钮显示
    refreshStealModeBtn();
    createSilentKeepAliveAudio();

    // ====================== 需求3：页面加载完成自动启动逻辑 ======================
    if(autoStartScript){
        console.log("⚙️ 自动启动开关开启，页面加载完成自动执行收种+好友轮询");
        // 自动开启自家成熟地块双倍监听
        startAutoCheckLand();
        // 延时后自动启动好友轮询
        setTimeout(()=>{
            if(!autoRunning){
                autoRunning = true;
                document.getElementById('autoAll').innerText = '🚀 关闭自动轮询';
                updateAutoTip('运行中(每10分钟执行)【自动启动】');
                totalWaterCount = 0;
                totalRoundCount = 0;
                updateStatInfo();
                runStealAndWater();
            }
        }, 5000);
    }

})();
