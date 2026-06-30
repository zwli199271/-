// ==UserScript==
// @name         帮派双模式抽奖
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  两个按钮：加权抽奖(周贡献)、纯随机抽奖
// @author       You
// @match        https://www.duanwuqiufenmao.top/qpet/gang
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    function waitElement(selector, callback) {
        const timer = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(timer);
                callback();
            }
        }, 300);
    }

    // 加权随机（按周贡献）
    function weightedRandom(list) {
        let totalWeight = list.reduce((sum, item) => sum + item.weight, 0);
        let random = Math.random() * totalWeight;
        for (let item of list) {
            random -= item.weight;
            if (random <= 0) return item;
        }
        return list[list.length - 1];
    }

    // 纯随机，均等概率
    function pureRandom(list) {
        const idx = Math.floor(Math.random() * list.length);
        return list[idx];
    }

    // 读取成员姓名+周贡献权重
    function getMemberList() {
        const rows = document.querySelectorAll('.gm-row');
        const members = [];
        rows.forEach(row => {
            const nameEl = row.querySelector('.gm-name');
            const weekEl = row.querySelector('.gm-chip-week');
            if (!nameEl || !weekEl) return;
            const name = nameEl.textContent.trim();
            const weekNum = parseInt(weekEl.textContent.replace('周 ', ''), 10) || 0;
            members.push({
                name: name,
                weight: weekNum
            });
        });
        return members;
    }

    function addButtons() {
        const header = document.querySelector('.gsp-hd');
        if (!header || document.querySelector('#btn-weight') || document.querySelector('#btn-random')) return;

        // 按钮1：加权抽奖
        const btnWeight = document.createElement('button');
        btnWeight.id = 'btn-weight';
        btnWeight.textContent = '加权抽奖';
        btnWeight.style.cssText = `
            margin-left:15px;
            padding:4px 12px;
            background:#f56c6c;
            color:#fff;
            border:none;
            border-radius:4px;
            cursor:pointer;
        `;
        btnWeight.onclick = () => {
            const list = getMemberList();
            if (!list.length) {alert('未读取到成员');return;}
            const winner = weightedRandom(list);
            alert(`🎉 加权中奖：${winner.name}\n周贡献权重：${winner.weight}`);
        };

        // 按钮2：纯随机抽奖
        const btnRandom = document.createElement('button');
        btnRandom.id = 'btn-random';
        btnRandom.textContent = '纯随机抽奖';
        btnRandom.style.cssText = `
            margin-left:8px;
            padding:4px 12px;
            background:#409eff;
            color:#fff;
            border:none;
            border-radius:4px;
            cursor:pointer;
        `;
        btnRandom.onclick = () => {
            const list = getMemberList();
            if (!list.length) {alert('未读取到成员');return;}
            const winner = pureRandom(list);
            alert(`🎉 纯随机中奖：${winner.name}`);
        };

        header.appendChild(btnWeight);
        header.appendChild(btnRandom);
    }

    waitElement('.gang-member-list', addButtons);

})();
