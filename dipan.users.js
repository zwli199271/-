// ==UserScript==
// @name         地盘循环攻打选择脚本
// @namespace    http://tampermonkey.net/
// @version      1.9
// @description  勾选地块后持续循环刷新+尝试进攻，自动处理更换地盘确认弹窗，点击攻打后自动停止，带收起面板，1分钟内地块高亮，地块按护盾剩余时间升序排列
// @author       zwli
// @match        https://www.duanwuqiufenmao.top/qpet/territory
// @grant        GM_addStyle
// ==/UserScript==

(function() {
    'use strict';

    // ========== 配置区 ==========
    const CONFIG = {
        escDelay: 100,         // 点击地块后多久按ESC关弹窗
        cardInterval: 0,       // 切换地块点击间隔
        fightDelay: 1000,      // 点击攻打按钮后延时
        loopWait: 100,         // 一轮全部目标跑完后的等待间隔
        randomRange: [0, 50],  // 随机浮动延时防风控
        minEscWait: 0,       // 兜底最低弹窗等待时间，防止过快ESC失效
        highlightMinute: 1     // 剩余护盾小于该分钟高亮
    };
    // ==============================================

    // 全局变量
    let isRunning = false;
    let loopTimer = null;
    let selectList = [];
    let targetCheckedList = [];
    let panelCollapsed = false; // 面板收起标记
    const $ = s => document.querySelector(s);
    const $$ = s => Array.from(document.querySelectorAll(s));

    // 样式注入
    GM_addStyle(`
        #mainPanel {
            position: fixed;
            top: 10px;
            right: 10px;
            width: 340px;
            max-height: 88vh;
            z-index: 99999;
            background: #161a23;
            color: #e6e6e6;
            border-radius: 10px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            transition: all 0.3s ease;
        }
        #mainPanel.collapse {
            width: 120px;
            height: 36px;
            overflow: hidden;
            padding: 6px 10px;
        }
        #mainPanel.collapse > div:not(.panel-header) {
            display: none !important;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .panel-header h3 {
            margin: 0;
            font-size: 14px;
            color: #73d1ff;
        }
        #collapseBtn {
            background: #444;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 12px;
        }
        .btn-group {
            display: flex;
            gap: 6px;
            margin-bottom: 10px;
        }
        .op-btn {
            flex: 1;
            padding: 7px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: bold;
        }
        #refreshBtn { background: #2563eb; color: #fff; }
        #startLoopBtn { background: #16a34a; color: #fff; }
        #stopBtn { background: #dc2626; color: #fff; }
        .list-wrap {
            flex: 1;
            overflow-y: auto;
            border: 1px solid #333;
            padding: 6px;
            margin-bottom: 10px;
        }
        .terr-item {
            padding: 6px 4px;
            border-bottom: 1px solid #2d2d2d;
            font-size: 13px;
            line-height: 1.4;
        }
        .terr-item.unable { color: #777; }
        .terr-item.can-fight { color: #4ade80; }
        .terr-item.near-expire {
            background: #78350f;
            color: #fef08a;
        }
        .log-area {
            height: 120px;
            background: #0d0f14;
            padding: 6px;
            overflow: auto;
            font-size: 12px;
            color: #86efac;
            white-space: pre-wrap;
        }
        .status-text {
            margin-bottom:8px;
            font-size:13px;
        }
    `);

    // 主面板DOM（新增头部收起按钮）
    const panel = document.createElement('div');
    panel.id = 'mainPanel';
    panel.innerHTML = `
        <div class="panel-header">
            <h3>地盘循环攻打控制台</h3>
            <button id="collapseBtn">收起</button>
        </div>
        <div class="status-text">运行状态：<span id="runStatus">已停止</span></div>
        <div class="btn-group">
            <button class="op-btn" id="refreshBtn">刷新地块列表</button>
            <button class="op-btn" id="startLoopBtn">循环攻打选中</button>
            <button class="op-btn" id="stopBtn">停止</button>
        </div>
        <div class="list-wrap" id="listBox"></div>
        <div class="log-area" id="logBox"></div>
    `;
    document.body.appendChild(panel);

    const listBox = $('#listBox');
    const logBox = $('#logBox');
    const runStatus = $('#runStatus');
    const collapseBtn = $('#collapseBtn');

    // 收起/展开切换
    collapseBtn.addEventListener('click', () => {
        panelCollapsed = !panelCollapsed;
        if (panelCollapsed) {
            panel.classList.add('collapse');
            collapseBtn.textContent = '展开';
        } else {
            panel.classList.remove('collapse');
            collapseBtn.textContent = '收起';
        }
    });

    // 日志打印
    function log(text) {
        const t = new Date().toLocaleTimeString();
        logBox.textContent += `[${t}] ${text}\n`;
        logBox.scrollTop = logBox.scrollHeight;
    }

    // 随机延时
    function randDelay() {
        const [min, max] = CONFIG.randomRange;
        return Math.floor(Math.random() * (max - min) + min);
    }
    function sleep(ms) {
        return new Promise(res => setTimeout(res, ms + randDelay()));
    }

    // 模拟ESC关闭弹窗
    function pressEsc() {
        const e = new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true });
        document.dispatchEvent(e);
    }

    // 解析收益数字
    function parseReward(str) {
        const m = str.match(/\+(\d+)经验/);
        return m ? Number(m[1]) : 0;
    }

    // 解析护盾剩余时间 例：0h58m → 总分钟数
    function parseProtectTime(text) {
        if (!text || !text.includes('🛡️')) return null;
        const hMatch = text.match(/(\d+)h/);
        const mMatch = text.match(/(\d+)m/);
        const hour = hMatch ? Number(hMatch[1]) : 0;
        const minute = mMatch ? Number(mMatch[1]) : 0;
        return hour * 60 + minute;
    }

    // 抓取全部地块信息存入数组 + 按护盾剩余时间升序排序（最小在前）
    function getAllTerritory() {
        const cards = $$('.terr-slot-card.occupied');
        selectList = [];
        cards.forEach(card => {
            const name = card.querySelector('.terr-slot-name')?.textContent || '未知';
            const rewardText = card.querySelector('.terr-slot-reward')?.textContent || '';
            const reward = parseReward(rewardText);
            const owner = card.querySelector('.terr-occupier-name')?.textContent || '';
            const gang = card.querySelector('.terr-occupier-gang')?.textContent || '';
            const fightBtn = card.querySelector('.wap-fight-btn.danger');
            const canAttack = !!fightBtn;
            const protectText = card.querySelector('.terr-protect-badge')?.textContent || '';
            const totalMin = parseProtectTime(protectText);
            // 是否小于1分钟
            const isNear = totalMin !== null && totalMin < CONFIG.highlightMinute;

            selectList.push({
                card,
                btn: fightBtn,
                name,
                reward,
                owner,
                gang,
                canAttack,
                protectText,
                totalMin,
                isNear
            });
        });

        // 排序：护盾剩余时间从小到大，可攻打(totalMin=null)视为0排最前
        selectList.sort((a, b) => {
            const timeA = a.totalMin === null ? 0 : a.totalMin;
            const timeB = b.totalMin === null ? 0 : b.totalMin;
            return timeA - timeB;
        });

        renderList();
        log(`共扫描到 ${selectList.length} 块地盘，已按护盾剩余时间升序排列，列表已刷新`);
    }

    // 渲染可选地块列表，带复选框 + 1分钟内高亮
    function renderList() {
        listBox.innerHTML = '';
        selectList.forEach((item, idx) => {
            const div = document.createElement('div');
            let cls = 'terr-item';
            if (item.canAttack) cls += ' can-fight';
            else cls += ' unable';
            // 护盾不足1分钟添加高亮类
            if (item.isNear) cls += ' near-expire';
            div.className = cls;

            let timeTip = item.canAttack ? '✅ 可攻打' : `🛡️ ${item.protectText}`;
            div.innerHTML = `
                <label>
                    <input type="checkbox" data-index="${idx}">
                    【${item.name}】收益${item.reward}/h
                    <br>持有者：${item.owner} | 公会${item.gang}
                    <br>${timeTip}
                </label>
            `;
            listBox.appendChild(div);
        });
    }

    // 获取用户勾选的地块
    function getCheckedTargets() {
        const checkboxes = $$('#listBox input[type="checkbox"]:checked');
        const targets = [];
        checkboxes.forEach(cb => {
            const idx = Number(cb.dataset.index);
            targets.push(selectList[idx]);
        });
        return targets;
    }

    // 单块地块刷新流程：点击卡片弹窗 → ESC关闭
    async function refreshSingleCard(card, name) {
        log(`刷新地块【${name}】`);
        card.click();
        // 取配置延时与兜底最小值，防止过快ESC失效
        const waitTime = Math.max(CONFIG.escDelay, CONFIG.minEscWait);
        await sleep(waitTime);
        pressEsc();
        log(`【${name}】ESC关闭，状态更新`);
        await sleep(CONFIG.cardInterval);
    }

    // 停止全部循环（封装统一停止函数）
    function stopAll() {
        isRunning = false;
        if (loopTimer) clearTimeout(loopTimer);
        loopTimer = null;
        runStatus.textContent = '已停止';
        log('===== 循环攻打已终止 =====');
    }

    // 一轮循环任务：遍历所有勾选目标，尝试进攻
    async function singleLoopTask() {
        if (!isRunning) return;
        targetCheckedList = getCheckedTargets();
        if (targetCheckedList.length === 0) {
            log('无勾选地块，等待下一轮');
            scheduleNextLoop();
            return;
        }

        log(`===== 本轮目标数：${targetCheckedList.length} =====`);
        for (const target of targetCheckedList) {
            if (!isRunning) return;
            const { card, name, owner, gang } = target;
            await refreshSingleCard(card, name);
            // 刷新后实时检测攻打按钮
            const realBtn = card.querySelector('.wap-fight-btn.danger');
            if (!realBtn) {
                log(`【${name}】${owner}${gang}护盾未消失，跳过`);
                continue;
            }
            // 出现攻打按钮自动点击，点击后自动停止脚本
            log(`【${name}】可进攻，自动点击攻打按钮`);
            realBtn.click();
            // 检测更换地盘确认弹窗，自动点继续
            const changeTerritoryDialog = document.querySelector('.el-message-box');
            if (changeTerritoryDialog) {
                const titleText = changeTerritoryDialog.querySelector('.el-message-box__title')?.textContent?.trim();
                if (titleText === '更换地盘确认') {
                    const confirmBtn = changeTerritoryDialog.querySelector('.el-message-box__btns .el-button--primary');
                    if (confirmBtn) {
                        log('检测到更换地盘确认弹窗，自动点击【继续】');
                        confirmBtn.click();
                    }
                }
            }
            // 点击攻打后立刻终止所有循环
            stopAll();
            return;
        }
        scheduleNextLoop();
    }

    // 安排下一轮循环
    function scheduleNextLoop() {
        if (!isRunning) return;
        // 清理旧定时器防止堆积
        if (loopTimer) clearTimeout(loopTimer);
        loopTimer = setTimeout(singleLoopTask, CONFIG.loopWait + randDelay());
    }

    // 启动无限循环攻打
    function startLoopAttack() {
        if (isRunning) {
            log('当前循环已运行，请勿重复启动');
            return;
        }
        targetCheckedList = getCheckedTargets();
        if (targetCheckedList.length === 0) {
            log('请先勾选至少一块地盘再启动');
            return;
        }
        isRunning = true;
        runStatus.textContent = '循环运行中';
        log('===== 无限循环攻打已启动 =====');
        singleLoopTask();
    }

    // 绑定按钮事件
    $('#stopBtn').addEventListener('click', stopAll);
    $('#refreshBtn').addEventListener('click', getAllTerritory);
    $('#startLoopBtn').addEventListener('click', startLoopAttack);

})();
