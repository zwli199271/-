// ==UserScript==
// @name         魂珠合集：一键卸载+一键合成（循环合成至无材料）
// @namespace    https://www.duanwuqiufenmao.top/qpet/weapons
// @version      2026-06-18
// @description  原版卸载逻辑不变，合成自动循环合到材料耗尽，修复单次合成不全
// @author       zwli+甜心教主
// @match        https://www.duanwuqiufenmao.top/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=duanwuqiufenmao.top
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

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
        margin-left: 10px;
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

    // ===================== 卸载计时器（原版完全不变） =====================
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

    // ===================== 路由监听 =====================
    const originalPush = history.pushState;
    history.pushState = function (...args) {
        originalPush.apply(history, args);
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

    function renderBtnGroup() {
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
        return unloadHtml + mergeHtml;
    }

    // ===================== 【原版卸载逻辑 100%原样无修改】 =====================
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

    // ===================== 合成模块（修复循环，自动合至无材料） =====================
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

    // 读取背包库存
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

    // 库存兜底防护
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

    // 单类型单等级执行一次合成
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

        // 停止合成
        if (!isMerging) {
            stopMergeAllTimer();
            mergeBtn?.classList.remove("active");
            if (titleDom) titleDom.textContent = "一键合成";
            console.log("合成流程手动终止");
            return;
        }

        mergeBtn?.classList.add("active");
        let bag = parseBagData();

        // 检测是否打开背包面板
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

        // 遍历所有魂珠种类
        for (const tName of typeNameList) {
            if (!isMerging) break;
            console.log(`======== 开始处理【${tName}】全部可合成等级 ========`);

            // 循环：重复读取背包合成，直到该类型无任何可合成材料
            while(true){
                if (!isMerging) break;
                bag = parseBagData(); // 每次循环刷新最新背包数据
                const stock = bag[tName];
                const lvArr = getLvList(stock);

                if(lvArr.length === 0){
                    console.log(`【${tName}】无剩余可合成材料，切换下一种魂珠`);
                    break;
                }

                // 低阶→高阶依次合成
                for(const lv of lvArr){
                    if (!isMerging) break;
                    await mergeOne(tName, lv);
                }
            }
        }

        // 全部完成重置状态
        isMerging = false;
        stopMergeAllTimer();
        mergeBtn?.classList.remove("active");
        if (titleDom) titleDom.textContent = "一键合成";
        console.log("所有魂珠合成全部完成，材料已清空");
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
