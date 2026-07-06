// ==UserScript==
// @name         魂珠合集：一键卸载+一键合成+自动批量镶嵌（仅手动保存方案）
// @namespace    https://www.duanwuqiufenmao.top/qpet/weapons
// @version      2026-07-05
// @description  仅保留手动保存全武器魂珠方案；卸载不再自动备份，镶嵌优先使用手动保存配置，无备份自动智能匹配，自动选用背包最高等级魂珠，一键启停
// @author       zwli+甜心教主
// @match        https://www.duanwuqiufenmao.top/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duanwuqiufenmao.top
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    // ===================== 全局日志函数（上移至最前，所有函数均可调用） =====================
    const ENABLE_LOG = true;
    function log(...args) {
        if (ENABLE_LOG) console.log(...args);
    }

    // ===================== 仅保留：手动点击【保存方案】备份（唯一一套配置） =====================
    let manualSaveScheme = {};
    const savedManual = localStorage.getItem("manualWeaponBeadScheme");
    if (savedManual) {
        Object.assign(manualSaveScheme, JSON.parse(savedManual));
    }

    // ===================== 统一样式 =====================
    const style = document.createElement('style');
    style.innerHTML = `
    .auto-hz-btn {
        cursor: pointer;
        font-size: 14px;
        padding: 8px 20px;
        transition: all .2s;
        color: #000;
        border-radius: 20px;
        background: #fff;
        border: 1px solid #e1e5e9;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
    .btn-unload.active {
        background: linear-gradient(135deg, #f44336, #e91e63);
        border: 1px solid #e1e5e9;
        color: #fff;
    }
    .btn-merge.active {
        background: linear-gradient(135deg, #409EFF, #2177d8);
        border: 1px solid #e1e5e9;
        color: #fff;
    }
    .btn-inlay.active {
        background: linear-gradient(135deg, #7b2cbf, #9d4edd);
        border: 1px solid #e1e5e9;
        color: #fff;
    }
    .btn-save-scheme {
        background: linear-gradient(135deg, #00b42a, #00d14b);
        color: #fff;
    }
    .weapon-tabs {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap:10px;
    }
    `;
    document.head.appendChild(style);

    // ===================== 通用基础工具函数 =====================
    function $(selector, all = false) {
        return all ? document.querySelectorAll(selector) : document.querySelector(selector);
    }
    function extractNum(str) {
        if (!str) return 0;
        const reg = /×(\d+)/;
        const m = str.match(reg);
        return m ? +m[1] : 0;
    }

    // ===================== 手动方案保存工具函数 =====================
    /**
     * 提取单武器当前所有魂珠类型顺序
     * @param {HTMLElement} cardEl 武器卡片DOM
     * @returns string[]
     */
    function getSingleWeaponBeadList(cardEl) {
        const filledSlots = Array.from(cardEl.querySelectorAll(".wbs-filled"));
        const beadNameList = [];
        filledSlots.forEach(slot => {
            const nameText = slot.querySelector(".wbs-name").textContent.trim();
            const beadName = nameText.split("·")[0];
            beadNameList.push(beadName);
        });
        return beadNameList;
    }

    /**
     * 全局：手动保存当前页面全部武器魂珠配置
     */
    window.manualSaveAllScheme = function() {
        const libList = $('.lib-list .lib-card.lib-card-owned', true);
        if (!libList || libList.length === 0) {
            alert("未检测到已拥有武器，无法保存方案！");
            return;
        }
        manualSaveScheme = {};
        libList.forEach(card => {
            const weaponName = card.querySelector(".lib-name").textContent.trim();
            const beadArr = getSingleWeaponBeadList(card);
            manualSaveScheme[weaponName] = beadArr;
        });
        localStorage.setItem("manualWeaponBeadScheme", JSON.stringify(manualSaveScheme));
        alert("✅ 当前页面所有武器魂珠方案保存成功！镶嵌时将优先使用此套配置");
        log("【手动保存完成】全武器方案已存入本地：", manualSaveScheme);
    }

    /**
     * 获取武器镶嵌顺序：仅读取手动保存方案，无则返回空数组走智能匹配
     * @param {string} weaponName 武器名称
     * @returns string[]
     */
    function getWeaponBackupScheme(weaponName) {
        if (manualSaveScheme[weaponName] && manualSaveScheme[weaponName].length > 0) {
            return manualSaveScheme[weaponName];
        }
        return [];
    }

    // ===================== 全局共用sleep（镶嵌模块复用，带停止检测） =====================
    let globalStopFlag = false;
    const baseSleep = ms => new Promise(resolve => {
        const timer = setTimeout(() => resolve(true), ms);
        const check = setInterval(() => {
            if (globalStopFlag) {
                clearTimeout(timer);
                clearInterval(check);
                resolve(false);
            }
        }, 200);
    });

    // ===================== 卸载计时器 =====================
    let unloadTimer = null;
    let unloadTimer1 = null;
    let unloadNum = 0;

    const unloadSleep = (ms) => new Promise(res => {
        if (ms === -1) {
            ms = Math.floor(Math.random() * (800 - 500 + 1) + 500);
        }
        if (ms === -2) {
            ms = Math.floor(Math.random() * (400 - 200 + 1) + 200);
        }

        unloadNum = Math.ceil(ms / 1000);
        $('.btn-unload .hz-btn-title').textContent = `卸载中${unloadNum}`;

        unloadTimer1 = setInterval(() => {
            unloadNum--;
            $('.btn-unload .hz-btn-title').textContent = `卸载中${unloadNum}`;
            if (unloadNum <= 0) clearInterval(unloadTimer1);
        }, 1000);

        unloadTimer = setTimeout(res, ms);
    });
    function stopUnloadAllTimer() {
        clearTimeout(unloadTimer);
        clearInterval(unloadTimer1);
        unloadTimer = null;
        unloadTimer1 = null;
    }

    // ===================== 合成计时器 =====================
    let mergeTimer = null, mergeTimer1 = null, waitNum = 0;
    const mergeSleep = ms => new Promise(res => {
        waitNum = Math.ceil(ms / 1000);
        const t = $('.btn-merge .hz-btn-title');
        if (t) t.textContent = `合成等待${waitNum}s`;
        mergeTimer1 = setInterval(() => {
            waitNum--;
            if (t) t.textContent = `合成等待${waitNum}s`;
            waitNum <= 0 && clearInterval(mergeTimer1);
        }, 1000);
        mergeTimer = setTimeout(res, ms);
    });
    function stopMergeAllTimer() {
        clearTimeout(mergeTimer);
        clearInterval(mergeTimer1);
        mergeTimer = mergeTimer1 = null;
    }

    // ===================== 自动镶嵌魂珠模块 =====================
    let isInlayRunning = false;
    const MODAL_FAIL_MAX = 3;
    const INLAY_INTERVAL = 5500;

    // 品质权重（真·神器最高）
    const QUALITY_WEIGHT = {
        "真·神器": 5,
        "神器": 4,
        "仙器": 3,
        "灵器": 2,
        "凡器": 1
    };
    const LV_PRIORITY = [5,4,3,2,1];
    const BEAD_PRIORITY_MAP = {
        crit: "帅帅",
        combo: "月璇",
        throw: "菜菜"
    };
    const BASE_BEAD_ORDER = ["剑君", "血灵","帅帅","月璇","菜菜","教主"];
    const CARD_OWNED = "lib-card-owned";
    const SLOT_WRAPPER = "weapon-bead-slots";
    const EMPTY_SLOT = "wbs-empty";
    const BEAD_TYPE_BTN_PREFIX = "bead-btn-";
    const ACTIVE_BTN = "active";
    const CONFIRM_BTN = "bsd-confirm-btn";
    const CANCEL_BTN = "bsd-cancel-btn";
    const BEAD_LV_BTN = "bsd-lv-btn";
    const DISABLED_ATTR = "disabled";

    function getAllValidWeapons() {
        const cards = Array.from($(`.lib-card.${CARD_OWNED}`, true));
        const validWeapons = [];
        for(const card of cards) {
            const slotBox = card.querySelector(`.${SLOT_WRAPPER}`);
            if(!slotBox) continue;
            const emptySlots = slotBox.querySelectorAll(`.${EMPTY_SLOT}`);
            if(emptySlots.length === 0) continue;

            const nameEl = card.querySelector(".lib-name");
            const qualityEl = card.querySelector(".lib-quality-label");
            const name = nameEl?.textContent?.trim() || "";
            const quality = qualityEl?.textContent?.trim() || "凡器";

            const specialText = card.querySelector(".lib-special")?.textContent || "";
            const canThrow = specialText.includes("可投掷");
            const isCritWeapon = specialText.includes("暴击");
            const isComboWeapon = specialText.includes("连击");

            validWeapons.push({
                el: card,
                name,
                quality,
                canThrow,
                isCritWeapon,
                isComboWeapon,
                weight: QUALITY_WEIGHT[quality] ?? 1
            });
        }
        validWeapons.sort((a,b) => b.weight - a.weight);
        return validWeapons;
    }

    function getWeaponEmptySlotCount(weaponEl) {
        const slotBox = weaponEl.querySelector(`.${SLOT_WRAPPER}`);
        if (!slotBox) return 0;
        return slotBox.querySelectorAll(`.${EMPTY_SLOT}`).length;
    }

    async function openBeadModal(weaponCardEl) {
        if (globalStopFlag) return false;
        const emptySlot = weaponCardEl.querySelector(`.${EMPTY_SLOT}`);
        if(!emptySlot) return false;
        emptySlot.click();
        const waitResult = await baseSleep(500);
        if (!waitResult) return false;
        return !!$(".bsd-modal");
    }

    async function closeModal() {
        if (globalStopFlag) return;
        const cancelBtn = $(`.${CANCEL_BTN}`);
        if(cancelBtn) cancelBtn.click();
    }

    async function selectBeadType(beadName) {
        if (globalStopFlag) return false;
        const typeBtn = $(`.${BEAD_TYPE_BTN_PREFIX}${beadName}`);
        if(!typeBtn) return false;
        if(!typeBtn.classList.contains(ACTIVE_BTN)) {
            typeBtn.click();
            const waitResult = await baseSleep(100);
            if (!waitResult) return false;
        }
        return true;
    }

    async function selectMaxLvBead() {
        if (globalStopFlag) return false;
        const lvBtns = Array.from($(`.${BEAD_LV_BTN}`, true));
        const lvBtnMap = {};
        lvBtns.forEach(btn => {
            const lvText = btn.textContent.match(/(\d+)级/)?.[1];
            if(lvText) lvBtnMap[Number(lvText)] = btn;
        });
        for(const targetLv of LV_PRIORITY) {
            const targetBtn = lvBtnMap[targetLv];
            if(!targetBtn) continue;
            if(!targetBtn.hasAttribute(DISABLED_ATTR)) {
                targetBtn.click();
                await baseSleep(200);
                return true;
            }
        }
        return false;
    }

    async function doSingleInlay() {
        if (globalStopFlag) return false;
        const confirmBtn = $(`.${CONFIRM_BTN}`);
        if(!confirmBtn || confirmBtn.hasAttribute(DISABLED_ATTR)) return false;
        confirmBtn.click();
        return true;
    }

    function getWeaponBeadOrder(weapon) {
        const backupNames = getWeaponBackupScheme(weapon.name);
        if (backupNames.length > 0) {
            log(`【${weapon.name}】使用手动保存固定魂珠类型顺序，自动填充当前最高等级`);
            return backupNames;
        }
        // 无手动备份，走武器特性智能匹配
        const tryList = [];
        if (weapon.isCritWeapon) tryList.push(BEAD_PRIORITY_MAP.crit);
        if (weapon.isComboWeapon) tryList.push(BEAD_PRIORITY_MAP.combo);
        if (weapon.canThrow) tryList.push(BEAD_PRIORITY_MAP.throw);
        const unique = [...new Set(tryList)];
        return [...unique, ...BASE_BEAD_ORDER];
    }

    async function handleSingleWeapon(weapon) {
        log(`【开始处理武器】${weapon.name} | 品质:${weapon.quality} | 暴击:${weapon.isCritWeapon} | 连击:${weapon.isComboWeapon} | 可投掷:${weapon.canThrow}`);
        let failOpenCount = 0;

        while(true) {
            if (globalStopFlag) {
                log("收到停止指令，退出当前武器");
                break;
            }
            const remainSlot = getWeaponEmptySlotCount(weapon.el);
            if (remainSlot <= 0) break;

            const modalOpen = await openBeadModal(weapon.el);
            if(!modalOpen) {
                failOpenCount++;
                log(`弹窗打开失败，累计失败${failOpenCount}次`);
                if (failOpenCount >= MODAL_FAIL_MAX) {
                    log("弹窗失败达到上限，跳过该武器");
                    break;
                }
                await baseSleep(1500);
                continue;
            }
            failOpenCount = 0;

            const beadTryOrder = getWeaponBeadOrder(weapon);
            let beadSelectSuccess = false;
            for (const beadName of beadTryOrder) {
                beadSelectSuccess = await selectBeadType(beadName);
                if (beadSelectSuccess) break;
            }

            if(!beadSelectSuccess) {
                log("无任何可用魂珠类型，结束镶嵌");
                await closeModal();
                break;
            }

            const lvSelect = await selectMaxLvBead();
            if(!lvSelect) {
                log("该类型无可用等级魂珠，切换下一类");
                await closeModal();
                continue;
            }

            const inlayOk = await doSingleInlay();
            if(inlayOk) {
                log(`镶嵌成功`);
            } else {
                log("镶嵌按钮不可点击，跳过本次");
            }

            await closeModal();
            const nextRemain = getWeaponEmptySlotCount(weapon.el);
            if(nextRemain > 0) {
                log(`等待${INLAY_INTERVAL/1000}秒后进行下一次镶嵌`);
                await baseSleep(INLAY_INTERVAL);
            }
        }
        log(`【${weapon.name}】镶嵌流程完成`);
    }

    window.startAutoInlay = async function () {
        const inlayBtn = $('.btn-inlay');
        const titleDom = $('.btn-inlay .hz-btn-title');
        if(isInlayRunning) {
            globalStopFlag = true;
            log("已触发停止镶嵌任务，等待当前操作结束");
            return;
        }

        globalStopFlag = false;
        isInlayRunning = true;
        inlayBtn.classList.add("active");
        log("===== 自动镶嵌魂珠脚本启动 =====");

        try {
            const weapons = getAllValidWeapons();
            if(weapons.length === 0) {
                log("无满足条件的武器（未拥有/无空镶嵌槽）");
                return;
            }
            log(`共检测到${weapons.length}把待镶嵌武器，按品质从高到低处理`);
            for(const weapon of weapons) {
                if (globalStopFlag) {
                    log("任务终止指令触发，结束全部镶嵌流程");
                    break;
                }
                await handleSingleWeapon(weapon);
            }
            log("===== 全部武器镶嵌任务执行完毕 =====");
        } catch (err) {
            log("镶嵌任务异常：", err);
        } finally {
            isInlayRunning = false;
            globalStopFlag = false;
            inlayBtn.classList.remove("active");
            titleDom.textContent = "自动镶嵌魂珠";
        }
    }

    // ===================== 路由监听 =====================
    const originalPush = history.pushState;
    history.pushState = function (...args) {
        originalPush.apply(this, args);
        checkRoute();
    };
    window.addEventListener('popstate', checkRoute);
    window.addEventListener('load', checkRoute);

    function checkRoute() {
        const path = location.pathname;
        if (path === '/qpet/weapons') {
            setTimeout(() => {
                const tab = $('.weapon-tabs');
                if (!tab) return;
                if (!$('.btn-unload')) {
                    tab.insertAdjacentHTML('beforeend', renderBtnGroup());
                }
            }, 100);
        }
    }

    // 按钮渲染：保存方案 → 一键卸载 → 一键合成 → 自动镶嵌
    function renderBtnGroup() {
        const saveHtml = `<div class="auto-hz-btn btn-save-scheme" onclick="manualSaveAllScheme()">
<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle; margin-right:4px;">
<path fill="#fff" d="M17 3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V7l-4-4zm-5 16c-1.66 0-3-1.34-3-3 0-2 3-5.4 3-5.4s3 3.4 3 5.4c0 1.66-1.34 3-3 3zm6-11h-4V4h4v4z"></path>
</svg>
<span class="hz-btn-title">保存方案</span>
</div>`;
        const unloadHtml = `<div class="auto-hz-btn btn-unload" onclick="unLoadAll()">
<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle; margin-right:4px;">
<path fill="#499FFC" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12z"></path>
<path fill="#499FFC" d="M19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"></path>
</svg>
<span class="hz-btn-title">一键卸载</span>
</div>`;
        const mergeHtml = `<div class="auto-hz-btn btn-merge" onclick="startAllMerge()">
<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;">
<path fill="#499FFC" d="M19 3h-4.18C14.4 1.84 13.3 1 12 1s-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z"></path>
</svg>
<span class="hz-btn-title">一键合成</span>
</div>`;
        const inlayHtml = `<div class="auto-hz-btn btn-inlay" onclick="startAutoInlay()">
<svg width="20" height="20" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:4px;">
<path fill="#fff" d="M12 2L3 9h3v8h6v-6h2v6h6V9h3L12 2z"></path>
</svg>
<span class="hz-btn-title">自动镶嵌魂珠</span>
</div>`;
        return saveHtml + unloadHtml + mergeHtml + inlayHtml;
    }

    // ===================== 一键卸载（已移除自动备份逻辑，仅纯拆卸） =====================
    let unType = false;
    window.unLoadAll = async function () {
        unType = !unType;
        const $btn = $('.btn-unload');
        const $title = $('.btn-unload .hz-btn-title');

        if (!unType) {
            stopUnloadAllTimer();
            $btn.classList.remove('active');
            $title.textContent = '一键卸载';
            return;
        }

        $btn.classList.add('active');
        const libList = $('.lib-list .lib-card.lib-card-owned', true);
        if (!libList || libList.length === 0) {
            unType = false;
            $btn.classList.remove('active');
            $title.textContent = '一键卸载';
            return;
        }

        log("开始执行批量卸载魂珠");
        for (let i = 0; i < libList.length; i++) {
            if (!unType) break;
            const lib = libList[i];
            const weaponBead = lib?.querySelectorAll('.weapon-bead-slots .wbs-filled');
            if (!weaponBead || weaponBead.length === 0) continue;
            for (let j = 0; j < 2; j++) {
                if (!unType) break;
                const removeBtn = weaponBead[0]?.querySelector('.wbs-remove');
                if(!removeBtn) continue;
                await unloadSleep(6000);
                if (removeBtn) removeBtn.click();
            }
        }

        unType = false;
        stopUnloadAllTimer();
        $btn.classList.remove('active');
        $title.textContent = '一键卸载';
    };

    // ===================== 一键合成模块（无修改） =====================
    console.log("魂珠合成模块加载完成");
    const MERGE_CLICK_DELAY = 6000;
    const mergeRule = {
        1: { base: "fragment", need: 3 },
        2: { base: 1, need: 3 },
        3: { base: 2, need: 3 },
        4: { base: 3, need: 3 },
        5: { base: 4, need: 6 }
    };
    const beadTypeMap = {
        "剑君": "bead-btn-剑君",
        "菜菜": "bead-btn-菜菜",
        "月璇": "bead-btn-月璇",
        "帅帅": "bead-btn-帅帅",
        "血灵": "bead-btn-血灵",
        "教主": "bead-btn-教主"
    };
    const typeNameList = Object.keys(beadTypeMap);
    let isMerging = false;

    function parseBagData() {
        const rows = document.querySelectorAll(".bead-bag-row");
        const data = {};
        rows.forEach(row => {
            const name = row.querySelector(".bead-bag-name")?.textContent.trim();
            if (!name) return;
            const info = { fragment: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            row.querySelectorAll(".bead-bag-item").forEach(item => {
                const t = item.textContent;
                if (t.includes("碎片")) info.fragment = extractNum(t);
                if (t.includes("1级")) info[1] = extractNum(t);
                if (t.includes("2级")) info[2] = extractNum(t);
                if (t.includes("3级")) info[3] = extractNum(t);
                if (t.includes("4级")) info[4] = extractNum(t);
                if (t.includes("5级")) info[5] = extractNum(t);
            });
            data[name] = info;
        });
        return data;
    }

    function getLvList(stock) {
        const s = stock || { fragment:0,1:0,2:0,3:0,4:0,5:0 };
        const list = [];
        if (Math.floor(s.fragment / 3) > 0) list.push(1);
        if (Math.floor(s[1] / 3) > 0) list.push(2);
        if (Math.floor(s[2] / 3) > 0) list.push(3);
        if (Math.floor(s[3] / 3) > 0) list.push(4);
        // 开启5级合成取消下一行注释
        // if(Math.floor(s[4]/6)>0) list.push(5);
        return list;
    }

    async function quickClick(sel, desc) {
        const el = $(sel);
        if (!el) {
            console.warn(`找不到元素：${desc}`);
            return false;
        }
        el.click();
        console.log(`已点击：${desc}`);
        return true;
    }

    async function mergeClick(sel, desc) {
        const el = $(sel);
        if (!el) {
            console.warn(`找不到元素：${desc}`);
            return false;
        }
        el.click();
        console.log(`已点击：${desc}，等待${MERGE_CLICK_DELAY/1000}秒`);
        await mergeSleep(MERGE_CLICK_DELAY);
        return true;
    }

    async function mergeOne(type, lv) {
        console.log(`===== 合成【${type}】${lv}级 =====`);
        await quickClick(`.${beadTypeMap[type]}`, `${type}分类`);
        await quickClick(`.bead-target-btns .bead-lv-btn:nth-child(${lv})`, `${lv}级目标`);
        await mergeClick(".bead-auto-merge-btn", "原生一键合成");
    }

    window.startAllMerge = async function () {
        isMerging = !isMerging;
        const mergeBtn = $('.btn-merge');
        const titleDom = $('.btn-merge .hz-btn-title');

        if (!isMerging) {
            stopMergeAllTimer();
            mergeBtn?.classList.remove("active");
            if (titleDom) titleDom.textContent = "一键合成";
            console.log("合成流程手动终止");
            return;
        }

        mergeBtn?.classList.add("active");
        let bag = parseBagData();
        let hasBagData = false;
        for(const key of typeNameList){
            if(bag[key]){
                hasBagData = true;
                break;
            }
        }
        if(!hasBagData){
            alert("请先打开魂珠背包面板，再点击一键合成！");
            isMerging = false;
            stopMergeAllTimer();
            mergeBtn?.classList.remove("active");
            titleDom.textContent = "一键合成";
            return;
        }

        for (const tName of typeNameList) {
            if (!isMerging) break;
            console.log(`======== 开始处理【${tName}】全部可合成等级 ========`);
            while(true){
                if (!isMerging) break;
                bag = parseBagData();
                const stock = bag[tName];
                const lvArr = getLvList(stock);
                if(lvArr.length === 0){
                    console.log(`【${tName}】无剩余可合成材料，切换下一种魂珠`);
                    break;
                }
                for(const lv of lvArr){
                    if (!isMerging) break;
                    await mergeOne(tName, lv);
                }
            }
        }

        isMerging = false;
        stopMergeAllTimer();
        mergeBtn?.classList.remove("active");
        if (titleDom) titleDom.textContent = "一键合成";
        console.log("所有魂珠合成全部完成，材料已消耗");
    }

    window.addEventListener('load', function () {
        if (location.pathname === '/qpet/weapons') {
            setTimeout(() => {
                const tab = $('.weapon-tabs');
                if (tab && !$('.btn-unload')) {
                    tab.insertAdjacentHTML('beforeend', renderBtnGroup());
                }
            }, 100);
        }
    });

})();
