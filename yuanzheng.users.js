// ==UserScript==
// @name         远征双模式【大号建房闯关 / 小号自动入房】
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  大号打完安图恩自动停止脚本；小号自动入房准备；按钮切换模式，无弹窗
// @author       You
// @match        https://www.duanwuqiufenmao.top/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // ====================== 全局配置 ======================
    const RAID_ORDER = [
        "巢穴入口",
        "暗影走廊",
        "隐秘宝库",
        "熔火核心",
        "地下泉眼",
        "装甲领主",
        "领主宝库",
        "安图恩"
    ];
    const CHECK_TREASURE_NODE = new Set(["隐秘宝库", "领主宝库"]);
    const LAST_STAGE = "安图恩";

    const HOME_URL = "https://www.duanwuqiufenmao.top/qpet/home";
    const EXPEDITION_URL = "https://www.duanwuqiufenmao.top/qpet/raid";
    const ROOM_NAME = "良人";
    const ROOM_PWD = "666";

    const WAIT_AFTER_HOME = 5000;
    const POLL_INTERVAL = 700;
    // =====================================================

    let currentIndex = 0;
    let running = false;
    let stopSignal = false;
    // 模式："main"大号 | "sub"小号
    let workMode = localStorage.getItem("autoRaidMode") || "sub";
    let subObserver = null;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 通用模拟点击（兼容SVG <g>）
    function triggerClick(el) {
        if (!el) return;
        const evt = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(evt);
    }

    // Vue el-input 赋值，解决双向绑定不刷新
    function setInputValue(inputEl, value) {
        inputEl.value = value;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    // 根据文本等待按钮
    async function waitBtnByText(text) {
        let targetBtn = null;
        while (!targetBtn && !stopSignal) {
            const btns = document.querySelectorAll(".el-button");
            targetBtn = Array.from(btns).find(b => b.textContent.trim() === text);
            if (!targetBtn) await sleep(POLL_INTERVAL);
        }
        return targetBtn;
    }

    // 副本节点查找
    function findNodeByName(nodeName) {
        const nodeList = document.querySelectorAll(".raid-node");
        for (const g of nodeList) {
            const texts = Array.from(g.querySelectorAll("text")).map(t => t.textContent.trim());
            if (texts.includes(nodeName)) {
                return g;
            }
        }
        return null;
    }

    // 检测魂珠碎片
    function checkTreasureHasSoulFragment() {
        const items = document.querySelectorAll(".treasure-item");
        for (const item of items) {
            if (item.textContent.includes("魂珠碎片")) {
                return true;
            }
        }
        return false;
    }

    // ========== 大号流程：创建房间 → 等待开始游戏 ==========
    async function runExpeditionPrepare_Main() {
        console.log("【大号模式】开始建房流程");
        if (location.href !== EXPEDITION_URL) {
            location.href = EXPEDITION_URL;
            return;
        }
        await sleep(1000);

        const createRoomBtn = await waitBtnByText("创建房间");
        triggerClick(createRoomBtn);
        console.log("点击【创建房间】");
        await sleep(1200);

        const nameInput = document.querySelector('input[placeholder="输入房间名称 (1-20字符)"]');
        const pwdInput = document.querySelector('input[placeholder="不填则为公开房间（1-20字符）"]');
        if (nameInput) setInputValue(nameInput, ROOM_NAME);
        if (pwdInput) setInputValue(pwdInput, ROOM_PWD);
        console.log(`房间名称:${ROOM_NAME} 密码:${ROOM_PWD}`);
        await sleep(600);

        const confirmCreateBtn = await waitBtnByText("创建");
        triggerClick(confirmCreateBtn);
        console.log("房间创建成功，等待队友准备...");

        const startGameBtn = await waitBtnByText("开始游戏");
        triggerClick(startGameBtn);
        console.log("✅ 点击【开始游戏】，进入副本！");
        await sleep(2000);
    }

    // ========== 大号：单次副本闯关 ==========
    async function runDungeonOnce_Main() {
        currentIndex = 0;
        while (currentIndex < RAID_ORDER.length && !stopSignal) {
            const targetName = RAID_ORDER[currentIndex];
            console.log(`>>> 当前关卡：${targetName}`);

            let targetNode = null;
            while (!targetNode && !stopSignal) {
                targetNode = findNodeByName(targetName);
                if (!targetNode) {
                    await sleep(POLL_INTERVAL);
                    continue;
                }
                if (!targetNode.querySelector(".clickable")) {
                    targetNode = null;
                    await sleep(POLL_INTERVAL);
                }
            }
            if (stopSignal) break;

            triggerClick(targetNode);
            console.log(`点击关卡：${targetName}`);

            const continueBtn = await waitBtnByText("继续探索");
            if (stopSignal || !continueBtn) break;

            if (CHECK_TREASURE_NODE.has(targetName)) {
                console.log(`【${targetName}】检测奖励`);
                const hasFragment = checkTreasureHasSoulFragment();
                console.log(`魂珠碎片：${hasFragment ? "存在" : "缺失"}`);

                if (!hasFragment) {
                    console.log("❌缺失魂珠碎片，跳转Home，标记重启远征");
                    location.href = `${HOME_URL}?restartExpedition=1`;
                    return "needRestart";
                }
            }

            triggerClick(continueBtn);
            await sleep(POLL_INTERVAL);

            // 新增逻辑：打完安图恩，直接结束任务，不再循环
            if (targetName === LAST_STAGE) {
                console.log("✅ 安图恩通关，大号任务全部完成，自动停止脚本");
                return "finishAll";
            }

            currentIndex++;
        }

        if (stopSignal) return "stop";
        console.log("✅本轮全部副本通关");
        return "complete";
    }

    // ========== 大号循环入口（修改：通关安图恩不再重启） ==========
    async function runMainTask() {
        console.log("=====【大号】启动一轮远征流程 =====");
        await runExpeditionPrepare_Main();
        if (stopSignal) return;

        const dungeonResult = await runDungeonOnce_Main();
        if (dungeonResult === "stop" || dungeonResult === "finishAll") {
            stopAllTask();
        }
        // needRestart 页面跳转，由url标记接力
    }

    // ========== 小号逻辑：自动加入良人房间 + 准备 ==========
    function runSubTask() {
        if (!running || stopSignal) return;
        console.log("【小号模式】一轮检测");

        // 最高优先级：检测继续探索按钮，跳转home
        const continueExploreBtns = document.querySelectorAll(".el-button");
        for (const btn of continueExploreBtns) {
            const span = btn.querySelector("span");
            if (span && span.textContent.trim() === "继续探索") {
                console.log("【小号】检测到继续探索，跳转home");
                location.href = `${HOME_URL}?restartExpedition=1`;
                return;
            }
        }

        if (!location.href.includes("/qpet/raid")) {
            location.href = EXPEDITION_URL;
            return;
        }

        // 房间内自动准备
        const readySpan = document.querySelector('span.status-badge.unready');
        if (readySpan && readySpan.textContent.trim() === "准备") {
            console.log("【小号】自动点击准备");
            triggerClick(readySpan);
            return;
        }

        // 密码弹窗
        const pwdInput = document.querySelector('.el-message-box__input .el-input__inner[placeholder="输入房间密码"]');
        if (pwdInput) {
            setInputValue(pwdInput, ROOM_PWD);
            const confirmBtn = document.querySelector('.el-message-box__btns .el-button--primary');
            if (confirmBtn) {
                console.log("【小号】输入密码确认加入");
                triggerClick(confirmBtn);
            }
            return;
        }

        // 大厅寻找良人房间
        const roomItems = document.querySelectorAll(".rooms-list .room-item:not(.disabled)");
        let foundRoom = false;
        for (const item of roomItems) {
            const titleDom = item.querySelector(".room-title");
            if (!titleDom) continue;
            const roomName = titleDom.textContent.trim();
            if (roomName.includes(ROOM_NAME)) {
                foundRoom = true;
                const roomMain = item.querySelector(".room-main");
                if (roomMain) {
                    console.log("【小号】找到良人房间，点击进入");
                    triggerClick(roomMain);
                    return;
                }
            }
        }

        // 刷新大厅
        if (!foundRoom) {
            const refreshBtns = document.querySelectorAll('.header-actions .el-button.el-button--small');
            for (const btn of refreshBtns) {
                const icon = btn.querySelector('.el-icon');
                if (icon && icon.textContent.trim() === '🔄') {
                    console.log("【小号】未找到房间，刷新大厅");
                    triggerClick(btn);
                    return;
                }
            }
        }
    }

    // ========== 页面载入检测home重启标记 ==========
    async function autoCheckRestartFlag() {
        const urlParams = new URLSearchParams(location.search);
        if (urlParams.get("restartExpedition") === "1") {
            console.log("✅检测到重启标记，等待5s");
            history.replaceState({}, document.title, HOME_URL);
            await sleep(WAIT_AFTER_HOME);
            if (workMode === "main") {
                await runExpeditionPrepare_Main();
            } else if (workMode === "sub") {
                location.href = EXPEDITION_URL;
            }
        }
    }

    // 停止全部任务
    function stopAllTask() {
        stopSignal = true;
        running = false;
        if (subObserver) {
            subObserver.disconnect();
            subObserver = null;
        }
        updateUIStatus();
        console.log("脚本已停止");
    }

    // 启动任务
    async function startTask() {
        if (running) return;
        running = true;
        stopSignal = false;
        updateUIStatus();

        try {
            if (workMode === "main") {
                await runMainTask();
            } else if (workMode === "sub") {
                // 小号开启DOM监听持续循环
                subObserver = new MutationObserver(() => {
                    if (running && workMode === "sub") runSubTask();
                });
                subObserver.observe(document.documentElement, {
                    childList: true,
                    subtree: true,
                    characterData: true
                });
                runSubTask();
            }
        } catch (e) {
            console.error("任务异常", e);
            stopAllTask();
        }
    }

    // 更新按钮UI样式
    function updateUIStatus() {
        const btnMain = document.getElementById("btn-mode-main");
        const btnSub = document.getElementById("btn-mode-sub");
        const btnCtrl = document.getElementById("btn-control");
        if (!btnMain || !btnSub || !btnCtrl) return;

        // 模式按钮高亮
        btnMain.style.background = workMode === "main" ? "#1677ff" : "#606266";
        btnSub.style.background = workMode === "sub" ? "#1677ff" : "#606266";

        // 启停按钮
        if (running) {
            btnCtrl.textContent = "停止脚本";
            btnCtrl.style.background = "#f5222d";
        } else {
            btnCtrl.textContent = "启动脚本";
            btnCtrl.style.background = "#22c55e";
        }
    }

    // 创建悬浮控制面板
    function createControlPanel() {
        const wrap = document.createElement("div");
        wrap.style.cssText = `
            position:fixed;z-index:999999;top:12px;right:12px;display:flex;gap:6px;
        `;

        const btnMain = document.createElement("button");
        btnMain.id = "btn-mode-main";
        btnMain.innerText = "大号模式";
        btnMain.style.cssText = `
            padding:7px 10px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;
        `;
        btnMain.onclick = () => {
            workMode = "main";
            localStorage.setItem("autoRaidMode", workMode);
            updateUIStatus();
        };

        const btnSub = document.createElement("button");
        btnSub.id = "btn-mode-sub";
        btnSub.innerText = "小号模式";
        btnSub.style.cssText = `
            padding:7px 10px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;
        `;
        btnSub.onclick = () => {
            workMode = "sub";
            localStorage.setItem("autoRaidMode", workMode);
            updateUIStatus();
        };

        const btnCtrl = document.createElement("button");
        btnCtrl.id = "btn-control";
        btnCtrl.style.cssText = `
            padding:7px 12px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;
        `;
        btnCtrl.onclick = () => {
            if (running) {
                stopAllTask();
            } else {
                startTask();
            }
        };

        wrap.appendChild(btnMain);
        wrap.appendChild(btnSub);
        wrap.appendChild(btnCtrl);
        document.body.appendChild(wrap);
        updateUIStatus();
    }

    window.addEventListener("load", async () => {
        createControlPanel();
        await autoCheckRestartFlag();
    });

    window.addEventListener("beforeunload", () => {
        if (subObserver) subObserver.disconnect();
    });

})();
