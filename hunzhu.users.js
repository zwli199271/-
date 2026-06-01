// ==UserScript==
// @name         魂珠 合集(使用+拆卸+合成)
// @namespace    http://tampermonkey.net/
// @version      3.1
// @description  自动使用、自动拆卸、自动合成魂珠(修复数值提取)
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @run-at       document-end
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // ========== 全局配置 ==========
    const CLICK_INTERVAL = 1000;    // 使用/拆卸 点击间隔(ms)
    const MERGE_INTERVAL = 3000;    // 合成点击间隔(ms)
    const LOOP_INTERVAL = 3000;     // 轮询检测间隔(ms)

    // 合成消耗规则: key=目标等级, value=所需低阶数量
    const MERGE_RULE = {
        1: 3,
        2: 3,
        3: 3,
        4: 3,
        5: 6
    };

    // 状态标记
    let useRunning = false;
    let removeRunning = false;
    let mergeRunning = false;
    let useTimer = null;
    let removeTimer = null;
    let mergeTimer = null;

    // ========== 1. 创建控制按钮 ==========
    function createControlBtn() {
        if (document.getElementById('beadUseBtn') || document.getElementById('beadRemoveBtn') || document.getElementById('beadMergeBtn')) return;

        const useBtn = document.createElement('button');
        useBtn.id = 'beadUseBtn';
        useBtn.innerText = '启用 自动使用魂珠';
        setBtnStyle(useBtn, 20);

        const removeBtn = document.createElement('button');
        removeBtn.id = 'beadRemoveBtn';
        removeBtn.innerText = '启用 自动拆卸魂珠';
        setBtnStyle(removeBtn, 70);

        const mergeBtn = document.createElement('button');
        mergeBtn.id = 'beadMergeBtn';
        mergeBtn.innerText = '启用 自动合成魂珠';
        setBtnStyle(mergeBtn, 120);

        useBtn.addEventListener('click', toggleUse);
        removeBtn.addEventListener('click', toggleRemove);
        mergeBtn.addEventListener('click', toggleMerge);

        document.body.appendChild(useBtn);
        document.body.appendChild(removeBtn);
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

    // ========== 2. 自动使用魂珠 ==========
    function toggleUse() {
        const btn = document.getElementById('beadUseBtn');
        if (!useRunning) {
            useRunning = true;
            btn.innerText = '已启用(点击停止)';
            btn.style.background = '#67c23a';
            autoUseBead();
            useTimer = setInterval(autoUseBead, LOOP_INTERVAL);
        } else {
            useRunning = false;
            btn.innerText = '启用 自动使用魂珠';
            btn.style.background = '#409eff';
            clearInterval(useTimer);
            console.log('✅ 已停止：自动使用魂珠');
        }
    }

    function getUseBeadBtns() {
        const cards = document.querySelectorAll('.inv-card-bead');
        const btnList = [];
        cards.forEach(card => {
            const typeTxt = card.querySelector('.inv-item-type')?.textContent?.trim();
            if (typeTxt === '魂珠') {
                const useBtn = card.querySelector('.inv-btn-use');
                if (useBtn) btnList.push(useBtn);
            }
        });
        return btnList;
    }

    function autoUseBead() {
        if (!useRunning) return;
        const btnList = getUseBeadBtns();
        if (btnList.length === 0) {
            console.log('📦 背包：暂无可用魂珠');
            return;
        }
        console.log(`📦 背包：检测到 ${btnList.length} 个魂珠，开始使用`);
        btnList.forEach((btn, idx) => {
            setTimeout(() => {
                btn.click();
                console.log(`📦 已使用第 ${idx + 1} 个魂珠`);
            }, idx * CLICK_INTERVAL);
        });
    }

    // ========== 3. 自动拆卸魂珠 ==========
    function toggleRemove() {
        const btn = document.getElementById('beadRemoveBtn');
        if (!removeRunning) {
            removeRunning = true;
            btn.innerText = '已启用(点击停止)';
            btn.style.background = '#67c23a';
            autoRemoveBead();
            removeTimer = setInterval(autoRemoveBead, LOOP_INTERVAL);
        } else {
            removeRunning = false;
            btn.innerText = '启用 自动拆卸魂珠';
            btn.style.background = '#409eff';
            clearInterval(removeTimer);
            console.log('✅ 已停止：自动拆卸魂珠');
        }
    }

    function getRemoveBeadBtns() {
        const removeBtns = document.querySelectorAll('.wbs-remove');
        const validBtns = [];
        removeBtns.forEach(btn => {
            const style = getComputedStyle(btn);
            if (style.display !== 'none' && style.visibility !== 'hidden' && btn.offsetWidth > 0) {
                validBtns.push(btn);
            }
        });
        return validBtns;
    }

    function autoRemoveBead() {
        if (!removeRunning) return;
        const btnList = getRemoveBeadBtns();
        if (btnList.length === 0) {
            console.log('⚔️ 武器：暂无可拆卸魂珠');
            return;
        }
        console.log(`⚔️ 武器：检测到 ${btnList.length} 个魂珠，开始拆卸`);
        btnList.forEach((btn, idx) => {
            setTimeout(() => {
                btn.click();
                console.log(`⚔️ 已拆卸第 ${idx + 1} 个魂珠`);
            }, idx * CLICK_INTERVAL);
        });
    }

    // ========== 4. 核心修复：精准提取 × 后面的数字 ==========
    /**
     * 专门提取 文本中「×」后面的数字
     * 示例："碎片×12" → 12  /  "1级×7" →7
     */
    function extractNum(str) {
        if (!str) return 0;
        // 正则：匹配 乘号(×) 后面的连续数字
        const reg = /×(\d+)/;
        const match = str.match(reg);
        return match ? parseInt(match[1], 10) : 0;
    }

    /**
     * 读取背包所有魂珠数量
     */
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
            console.log(`📊 [${name}] 碎片:${beadData[name].fragment} 1级:${beadData[name].lv1} 2级:${beadData[name].lv2} 3级:${beadData[name].lv3} 4级:${beadData[name].lv4} 5级:${beadData[name].lv5}`);
        });
        return beadData;
    }

    // 选择魂珠类型
    function selectBeadType(typeName) {
        const typeBtns = document.querySelectorAll('.bead-type-btn');
        for (let btn of typeBtns) {
            if (btn.textContent.trim() === typeName) {
                btn.click();
                console.log(`🔮 切换魂珠类型: ${typeName}`);
                break;
            }
        }
    }

    // 选择合成目标等级
    function selectMergeLv(lv) {
        const targetBtns = document.querySelectorAll('.bead-lv-btn');
        if (lv < 1 || lv > targetBtns.length) return;
        targetBtns[lv - 1].click();
        console.log(`🔮 切换合成目标: ${lv}级`);
    }

    // 执行合成点击
    function doMerge() {
        const mergeBtn = document.querySelector('.bead-merge-btn');
        if (mergeBtn) {
            mergeBtn.click();
            console.log('🔮 点击合成');
        }
    }

    // 延时函数
    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ========== 5. 自动合成主流程 ==========
    async function autoMergeBead() {
        if (!mergeRunning) return;
        const beadData = readBeadBag();
        const typeList = Object.keys(beadData);
        if (typeList.length === 0) {
            console.log('🔮 未读取到魂珠背包数据');
            return;
        }

        // 合成顺序：碎片→1级 →1级→2级 →2级→3级 →3级→4级 →4级→5级
        for (let typeName of typeList) {
            if (!mergeRunning) break;
            const data = beadData[typeName];

            // 碎片合成 1级
            let mergeTimes = Math.floor(data.fragment / MERGE_RULE[1]);
            if (mergeTimes > 0) {
                console.log(`🔮 ${typeName} 碎片可合成 ${mergeTimes} 次1级`);
                selectBeadType(typeName);
                await sleep(MERGE_INTERVAL);
                selectMergeLv(1);
                await sleep(MERGE_INTERVAL);
                for (let i = 0; i < mergeTimes; i++) {
                    if (!mergeRunning) return;
                    doMerge();
                    await sleep(MERGE_INTERVAL);
                }
            }

            // 1级合成 2级
            mergeTimes = Math.floor(data.lv1 / MERGE_RULE[2]);
            if (mergeTimes > 0) {
                console.log(`🔮 ${typeName} 1级可合成 ${mergeTimes} 次2级`);
                selectBeadType(typeName);
                await sleep(MERGE_INTERVAL);
                selectMergeLv(2);
                await sleep(MERGE_INTERVAL);
                for (let i = 0; i < mergeTimes; i++) {
                    if (!mergeRunning) return;
                    doMerge();
                    await sleep(MERGE_INTERVAL);
                }
            }

            // 2级合成 3级
            mergeTimes = Math.floor(data.lv2 / MERGE_RULE[3]);
            if (mergeTimes > 0) {
                console.log(`🔮 ${typeName} 2级可合成 ${mergeTimes} 次3级`);
                selectBeadType(typeName);
                await sleep(MERGE_INTERVAL);
                selectMergeLv(3);
                await sleep(MERGE_INTERVAL);
                for (let i = 0; i < mergeTimes; i++) {
                    if (!mergeRunning) return;
                    doMerge();
                    await sleep(MERGE_INTERVAL);
                }
            }

            // 3级合成 4级
            mergeTimes = Math.floor(data.lv3 / MERGE_RULE[4]);
            if (mergeTimes > 0) {
                console.log(`🔮 ${typeName} 3级可合成 ${mergeTimes} 次4级`);
                selectBeadType(typeName);
                await sleep(MERGE_INTERVAL);
                selectMergeLv(4);
                await sleep(MERGE_INTERVAL);
                for (let i = 0; i < mergeTimes; i++) {
                    if (!mergeRunning) return;
                    doMerge();
                    await sleep(MERGE_INTERVAL);
                }
            }

            // 4级合成 5级（6合1）
            mergeTimes = Math.floor(data.lv4 / MERGE_RULE[5]);
            if (mergeTimes > 0) {
                console.log(`🔮 ${typeName} 4级可合成 ${mergeTimes} 次5级`);
                selectBeadType(typeName);
                await sleep(MERGE_INTERVAL);
                selectMergeLv(5);
                await sleep(MERGE_INTERVAL);
                for (let i = 0; i < mergeTimes; i++) {
                    if (!mergeRunning) return;
                    doMerge();
                    await sleep(MERGE_INTERVAL);
                }
            }
        }
        console.log('🔮 当前轮次所有魂珠合成完毕，等待下一轮检测');
    }

    function toggleMerge() {
        const btn = document.getElementById('beadMergeBtn');
        if (!mergeRunning) {
            mergeRunning = true;
            btn.innerText = '已启用(点击停止)';
            btn.style.background = '#67c23a';
            autoMergeBead();
            mergeTimer = setInterval(autoMergeBead, LOOP_INTERVAL);
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
