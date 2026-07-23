// ==UserScript==
// @name         远征双模式【大号建房闯关 / 小号自动入房】
// @namespace    http://tampermonkey.net/
// @version      1.4
// @description  修复：小号跳转home后无法自动重启循环；持久化运行状态；大号缺碎片接力、通关安图恩自动停止
// @author       zwli
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
    let workMode = localStorage.getItem("autoRaidMode") || "sub";
    let subObserver = null;

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function triggerClick(el) {
        if (!el) return;
        const evt = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window
        });
        el.dispatchEvent(evt);
    }

    function setInputValue(inputEl, value) {
        inputEl.value = value;
        inputEl.dispatchEvent(new Event("input", { bubbles: true }));
        inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    }

    async function waitBtnByText(text) {
        let targetBtn = null;
        while (!targetBtn && !stopSignal) {
            const btns = document.querySelectorAll(".el-button");
            targetBtn = Array.from(btns).find(b => b.textContent.trim() === text);
            if (!targetBtn) await sleep(POLL_INTERVAL);
        }
        return targetBtn;
    }

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

    function checkTreasureHasSoulFragment() {
        const items = document.querySelectorAll(".treasure-item");
        for (const item of items) {
            if (item.textContent.includes("魂珠碎片")) {
                return true;
            }
        }
        return false;
    }

    // ========== 大号：创建房间流程 ==========
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

    // ========== 大号单次副本闯关 ==========
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
                    console.log("❌缺失魂珠碎片，跳转Home携带重启标记");
                    location.href = `${HOME_URL}?restartExpedition=1`;
                    return "needRestart";
                }
            }

            triggerClick(continueBtn);
            await sleep(POLL_INTERVAL);

            if (targetName === LAST_STAGE) {
                console.log("✅ 安图恩通关，大号任务全部完成，自动停止脚本");
                return "finishAll";
            }
            currentIndex++;
        }
        if (stopSignal) return "stop";
        return "complete";
    }

    // ========== 大号完整一轮任务 ==========
    async function runMainTask() {
        console.log("=====【大号】启动一轮远征流程 =====");
        await runExpeditionPrepare_Main();
        if (stopSignal) return;

        const dungeonResult = await runDungeonOnce_Main();
        if (dungeonResult === "stop" || dungeonResult === "finishAll") {
            stopAllTask();
        }
    }

    // ========== 小号逻辑 ==========
    function runSubTask() {
        if (!running || stopSignal) return;
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

        const readySpan = document.querySelector('span.status-badge.unready');
        if (readySpan && readySpan.textContent.trim() === "准备") {
            triggerClick(readySpan);
            return;
        }

        const pwdInput = document.querySelector('.el-message-box__input .el-input__inner[placeholder="输入房间密码"]');
        if (pwdInput) {
            setInputValue(pwdInput, ROOM_PWD);
            const confirmBtn = document.querySelector('.el-message-box__btns .el-button--primary');
            if (confirmBtn) triggerClick(confirmBtn);
            return;
        }

        const roomItems = document.querySelectorAll(".rooms-list .room-item:not(.disabled)");
        let foundRoom = false;
        for (const item of roomItems) {
            const titleDom = item.querySelector(".room-title");
            if (!titleDom) continue;
            const roomName = titleDom.textContent.trim();
            if (roomName.includes(ROOM_NAME)) {
                foundRoom = true;
                const roomMain = item.querySelector(".room-main");
                if (roomMain) triggerClick(roomMain);
                return;
            }
        }
        if (!foundRoom) {
            const refreshBtns = document.querySelectorAll('.header-actions .el-button.el-button--small');
            for (const btn of refreshBtns) {
                const icon = btn.querySelector('.el-icon');
                if (icon && icon.textContent.trim() === '🔄') {
                    triggerClick(btn);
                    return;
                }
            }
        }
    }

    // 停止全部任务
    function stopAllTask() {
        stopSignal = true;
        running = false;
        localStorage.removeItem("autoRaidRunning");
        if (subObserver) {
            subObserver.disconnect();
            subObserver = null;
        }
        updateUIStatus();
        console.log("脚本已停止");
    }

    // 启动任务【新增持久化运行标记】
    async function startTask() {
        if (running) return;
        running = true;
        stopSignal = false;
        localStorage.setItem("autoRaidRunning", "1");
        updateUIStatus();
        try {
            if (workMode === "main") {
                await runMainTask();
            } else if (workMode === "sub") {
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

    // ========== 页面加载自动检测重启标记 + 运行持久标记【核心修复】 ==========
    async function autoCheckRestartFlag() {
        const urlParams = new URLSearchParams(location.search);
        const hasRestartFlag = urlParams.get("restartExpedition") === "1";
        const isPersistRunning = localStorage.getItem("autoRaidRunning") === "1";

        if (hasRestartFlag) {
            // 清除URL参数，防止反复触发
            history.replaceState({}, document.title, location.pathname);
            console.log("✅检测到重启标记");

            if (location.href.includes("/qpet/home")) {
                console.log("Home页面等待5s，跳转远征");
                await sleep(WAIT_AFTER_HOME);
                location.href = EXPEDITION_URL;
                return;
            }
        }

        // 已经抵达远征页面，且存在持久运行标记，自动启动
        if (location.href.includes("/qpet/raid") && isPersistRunning && !running) {
            console.log("✅持久运行标记生效，自动启动任务");
            await startTask();
        }
    }

    function updateUIStatus() {
        const btnMain = document.getElementById("btn-mode-main");
        const btnSub = document.getElementById("btn-mode-sub");
        const btnCtrl = document.getElementById("btn-control");
        if (!btnMain || !btnSub || !btnCtrl) return;
        btnMain.style.background = workMode === "main" ? "#1677ff" : "#606266";
        btnSub.style.background = workMode === "sub" ? "#1677ff" : "#606266";
        if (running) {
            btnCtrl.textContent = "停止脚本";
            btnCtrl.style.background = "#f5222d";
        } else {
            btnCtrl.textContent = "启动脚本";
            btnCtrl.style.background = "#22c55e";
        }
    }

    function createControlPanel() {
        const wrap = document.createElement("div");
        wrap.style.cssText = `
            position:fixed;z-index:999999;top:12px;right:12px;display:flex;gap:6px;
        `;
        const btnMain = document.createElement("button");
        btnMain.id = "btn-mode-main";
        btnMain.innerText = "大号模式";
        btnMain.style.cssText = `padding:7px 10px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;`;
        btnMain.onclick = () => {
            workMode = "main";
            localStorage.setItem("autoRaidMode", workMode);
            updateUIStatus();
        };

        const btnSub = document.createElement("button");
        btnSub.id = "btn-mode-sub";
        btnSub.innerText = "小号模式";
        btnSub.style.cssText = `padding:7px 10px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;`;
        btnSub.onclick = () => {
            workMode = "sub";
            localStorage.setItem("autoRaidMode", workMode);
            updateUIStatus();
        };

        const btnCtrl = document.createElement("button");
        btnCtrl.id = "btn-control";
        btnCtrl.style.cssText = `padding:7px 12px;border:none;border-radius:6px;color:#fff;cursor:pointer;font-size:13px;`;
        btnCtrl.onclick = () => {
            if (running) stopAllTask();
            else startTask();
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
