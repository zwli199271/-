// ==UserScript==
// @name         非VIP魂珠 自动合成
// @namespace    http://tampermonkey.net/
// @version      3.3
// @description  自动合成魂珠(每次只合成一次，随机间隔)
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/qpet/weapons
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局配置 ==========
    // 随机延迟函数
    function getRandomDelay(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // 合成点击间隔: 6500~7500ms (每次合成后等待)
    const getMergeInterval = () => getRandomDelay(6500, 7500);

    // 轮询检测间隔: 8000ms (避免频繁检测)
    const LOOP_INTERVAL = 8000;

    // 合成消耗规则
    const MERGE_RULE = {
        1: 3,
        2: 3,
        3: 3,
        4: 3,
        5: 6
    };

    // 状态标记
    let mergeRunning = false;
    let mergeTimer = null;
    let isMerging = false;           // 防止重复执行合成

    // ========== 1. 创建控制按钮 ==========
    function createControlBtn() {
        if (document.getElementById('beadMergeBtn')) return;

        const mergeBtn = document.createElement('button');
        mergeBtn.id = 'beadMergeBtn';
        mergeBtn.innerText = '启用 自动合成魂珠';
        setBtnStyle(mergeBtn, 20);

        mergeBtn.addEventListener('click', toggleMerge);

        document.body.appendChild(mergeBtn);
    }

    function setBtnStyle(btn, top) {
        Object.assign(btn.style, {
            position: 'fixed',
            top: top + 'px',
            right: '20px',
            zIndex: '99999',
            padding: '6px 12px',
            background: '#409eff',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            marginBottom: '8px',
            display: 'block'
        });
    }

    // ========== 2. 数值提取函数 ==========
    function extractNum(str) {
        if (!str) return 0;
        const reg = /×(\d+)/;
        const match = str.match(reg);
        return match ? parseInt(match[1], 10) : 0;
    }

    function readBeadBag() {
        const bagRows = document.querySelectorAll('.bead-bag-row');
        const beadData = {};
        bagRows.forEach(row => {
            const name = row.querySelector('.bead-bag-name')?.textContent?.trim();
            if (!name) return;
            const items = row.querySelectorAll('.bead-bag-item');
            beadData[name] = {
                fragment: extractNum(items[0]?.textContent),
                lv1: extractNum(items[1]?.textContent),
                lv2: extractNum(items[2]?.textContent),
                lv3: extractNum(items[3]?.textContent),
                lv4: extractNum(items[4]?.textContent),
                lv5: extractNum(items[5]?.textContent)
            };
        });
        return beadData;
    }

    function selectBeadType(typeName) {
        const typeBtns = document.querySelectorAll('.bead-type-btn');
        for (let btn of typeBtns) {
            if (btn.textContent.trim() === typeName) {
                btn.click();
                console.log(`🔮 切换魂珠类型: ${typeName}`);
                return true;
            }
        }
        return false;
    }

    function selectMergeLv(lv) {
        const targetBtns = document.querySelectorAll('.bead-lv-btn');
        if (lv < 1 || lv > targetBtns.length) return false;
        targetBtns[lv - 1].click();
        console.log(`🔮 切换合成目标: ${lv}级`);
        return true;
    }

    function doMerge() {
        const mergeBtn = document.querySelector('.bead-merge-btn');
        if (mergeBtn) {
            mergeBtn.click();
            console.log('🔮 点击合成');
            return true;
        }
        return false;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== 3. 自动合成主流程（每次只合成一次） ==========
    async function autoMergeBead() {
        // 防止重复执行
        if (!mergeRunning || isMerging) {
            return;
        }

        isMerging = true;

        try {
            const beadData = readBeadBag();
            const typeList = Object.keys(beadData);

            if (typeList.length === 0) {
                console.log('🔮 未读取到魂珠背包数据');
                isMerging = false;
                return;
            }

            // 查找可合成的目标（按优先级：4级→5级，3级→4级，2级→3级，1级→2级，碎片→1级）
            // 优先合成高等级，因为高等级需求更大
            for (let typeName of typeList) {
                if (!mergeRunning) break;
                const data = beadData[typeName];

                // 4级合成5级（优先级最高）
                if (data.lv4 >= MERGE_RULE[5]) {
                    console.log(`🔮 检测到 ${typeName} 4级数量:${data.lv4}，可合成5级`);
                    if (selectBeadType(typeName)) {
                        await sleep(getMergeInterval());
                        if (selectMergeLv(5)) {
                            await sleep(getMergeInterval());
                            doMerge();
                            console.log(`🔮 ${typeName} 正在合成5级魂珠，等待下一轮检测`);
                            isMerging = false;
                            return;
                        }
                    }
                }

                // 3级合成4级
                if (data.lv3 >= MERGE_RULE[4]) {
                    console.log(`🔮 检测到 ${typeName} 3级数量:${data.lv3}，可合成4级`);
                    if (selectBeadType(typeName)) {
                        await sleep(getMergeInterval());
                        if (selectMergeLv(4)) {
                            await sleep(getMergeInterval());
                            doMerge();
                            console.log(`🔮 ${typeName} 正在合成4级魂珠，等待下一轮检测`);
                            isMerging = false;
                            return;
                        }
                    }
                }

                // 2级合成3级
                if (data.lv2 >= MERGE_RULE[3]) {
                    console.log(`🔮 检测到 ${typeName} 2级数量:${data.lv2}，可合成3级`);
                    if (selectBeadType(typeName)) {
                        await sleep(getMergeInterval());
                        if (selectMergeLv(3)) {
                            await sleep(getMergeInterval());
                            doMerge();
                            console.log(`🔮 ${typeName} 正在合成3级魂珠，等待下一轮检测`);
                            isMerging = false;
                            return;
                        }
                    }
                }

                // 1级合成2级
                if (data.lv1 >= MERGE_RULE[2]) {
                    console.log(`🔮 检测到 ${typeName} 1级数量:${data.lv1}，可合成2级`);
                    if (selectBeadType(typeName)) {
                        await sleep(getMergeInterval());
                        if (selectMergeLv(2)) {
                            await sleep(getMergeInterval());
                            doMerge();
                            console.log(`🔮 ${typeName} 正在合成2级魂珠，等待下一轮检测`);
                            isMerging = false;
                            return;
                        }
                    }
                }

                // 碎片合成1级
                if (data.fragment >= MERGE_RULE[1]) {
                    console.log(`🔮 检测到 ${typeName} 碎片数量:${data.fragment}，可合成1级`);
                    if (selectBeadType(typeName)) {
                        await sleep(getMergeInterval());
                        if (selectMergeLv(1)) {
                            await sleep(getMergeInterval());
                            doMerge();
                            console.log(`🔮 ${typeName} 正在合成1级魂珠，等待下一轮检测`);
                            isMerging = false;
                            return;
                        }
                    }
                }
            }

            // 没有可合成的物品
            console.log('🔮 当前无可合成魂珠，等待下一轮检测');

        } catch (error) {
            console.error('🔮 合成出错:', error);
        }

        isMerging = false;
    }

    function toggleMerge() {
        const btn = document.getElementById('beadMergeBtn');
        if (!mergeRunning) {
            mergeRunning = true;
            btn.innerText = '已启用(点击停止)';
            btn.style.background = '#67c23a';
            console.log('🔮 已启动：自动合成魂珠 (每次只合成一次，随机间隔后继续)');
            // 启动定时器，每隔一段时间检测一次
            mergeTimer = setInterval(() => {
                if (mergeRunning && !isMerging) {
                    autoMergeBead();
                }
            }, LOOP_INTERVAL);
            // 立即执行一次
            autoMergeBead();
        } else {
            mergeRunning = false;
            btn.innerText = '启用 自动合成魂珠';
            btn.style.background = '#409eff';
            clearInterval(mergeTimer);
            console.log('✅ 已停止：自动合成魂珠');
        }
    }

    // 页面初始化
    window.addEventListener('load', () => {
        setTimeout(createControlBtn, 1000);
    });
})();
