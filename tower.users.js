// ==UserScript==
// @name 斗塔一键升级托管
// @namespace https://www.duanwuqiufenmao.top/
// @version 2026-06-28
// @description 斗塔自动使用免费次数和还魂丹升级，支持自选经验水瓶类型
// @author 甜心教主+zwli
// @match https://www.duanwuqiufenmao.top/qpet/tower
// @match https://www.duanwuqiufenmao.top/qpet/inventory
// @icon https://www.google.com/s2/favicons?sz=64&domain=duanwuqiufenmao.top
// @grant none
// ==/UserScript==

(function () {
    'use strict';

    const allow = ['/qpet/tower', '/qpet/inventory'];
    if (!allow.includes(location.pathname)) return;

    function $(selector, all = false) {
        if (all) {
            return document.querySelectorAll(selector);
        }
        return document.querySelector(selector);
    }

    function isElementExist(selector) {
        return !!$(selector);
    }

    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    function getCurrentUrl() {
        const pathname = window.location.pathname;
        return ['/qpet/tower', '/qpet/inventory'].findIndex(item => pathname === item);
    }

    // 持久化配置
    let isHosting = false;
    let isOpenJy = JSON.parse(localStorage.getItem('isOpenJy') || 'false');
    // 药水类型：0=中瓶优先  1=仅中瓶  2=仅小瓶
    let waterMode = parseInt(localStorage.getItem('waterMode') || '0');

    if (getCurrentUrl() === 0) {
        // 主开关按钮
        const btn = document.createElement('div');
        btn.id = 'auto-host-btn';
        btn.textContent = isHosting ? '升级：开' : '升级：关';
        Object.assign(btn.style, {
            position: 'fixed',
            bottom: '30px',
            right: '30px',
            zIndex: '999999',
            padding: '12px 24px',
            borderRadius: '50px',
            backgroundColor: isHosting ? '#4caf50' : '#f44336',
            color: '#fff',
            fontSize: '15px',
            fontWeight: 'bold',
            fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(244, 67, 54, 0.4)',
            userSelect: 'none',
            transition: 'all 0.25s ease',
            letterSpacing: '1px',
            border: '2px solid rgba(255,255,255,0.2)',
        });
        btn.onmouseenter = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseleave = () => btn.style.transform = 'scale(1)';
        document.body.appendChild(btn);

        btn.addEventListener('click', () => {
            isHosting = !isHosting;
            if (isHosting) {
                btn.textContent = '升级：开';
                btn.style.backgroundColor = '#4caf50';
                btn.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
                Init();
            } else {
                btn.textContent = '升级：关';
                btn.style.backgroundColor = '#f44336';
                btn.style.boxShadow = '0 4px 15px rgba(244, 67, 54, 0.4)';
            }
        });

        // 经验水总开关
        const btn1 = document.createElement('div');
        btn1.id = 'auto-host-btn1';
        setBtn1Style();
        btn1.onmouseenter = () => btn1.style.transform = 'scale(1.05)';
        btn1.onmouseleave = () => btn1.style.transform = 'scale(1)';
        document.body.appendChild(btn1);

        function setBtn1Style() {
            if (isOpenJy) {
                btn1.textContent = '经验水：开';
                btn1.style.backgroundColor = '#4caf50';
                btn1.style.boxShadow = '0 4px 15px rgba(76, 175, 80, 0.4)';
            } else {
                btn1.textContent = '经验水：关';
                btn1.style.backgroundColor = '#f44336';
                btn1.style.boxShadow = '0 4px 15px rgba(244, 67, 54, 0.4)';
            }
            Object.assign(btn1.style, {
                position: 'fixed',
                bottom: '90px',
                right: '30px',
                zIndex: '999999',
                padding: '12px 24px',
                borderRadius: '50px',
                color: '#fff',
                fontSize: '15px',
                fontWeight: 'bold',
                fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
                cursor: 'pointer',
                userSelect: 'none',
                transition: 'all 0.25s ease',
                letterSpacing: '1px',
                border: '2px solid rgba(255,255,255,0.2)',
            });
        }

        btn1.addEventListener('click', () => {
            isOpenJy = !isOpenJy;
            localStorage.setItem('isOpenJy', isOpenJy);
            setBtn1Style();
        });

        // 新增：药水类型选择按钮
        const btn2 = document.createElement('div');
        btn2.id = 'water-mode-btn';
        refreshWaterBtnText();
        Object.assign(btn2.style, {
            position: 'fixed',
            bottom: '150px',
            right: '30px',
            zIndex: '999999',
            padding: '12px 24px',
            borderRadius: '50px',
            backgroundColor: '#2196F3',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 'bold',
            fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
            cursor: 'pointer',
            userSelect: 'none',
            transition: 'all 0.25s ease',
            border: '2px solid rgba(255,255,255,0.2)',
        });
        btn2.onmouseenter = () => btn2.style.transform = 'scale(1.05)';
        btn2.onmouseleave = () => btn2.style.transform = 'scale(1)';
        document.body.appendChild(btn2);

        function refreshWaterBtnText() {
            const map = {
                0: '模式：中瓶优先',
                1: '模式：只用中瓶',
                2: '模式：只用小瓶'
            };
            btn2.textContent = map[waterMode];
        }

        // 循环切换三种模式
        btn2.addEventListener('click', () => {
            waterMode = (waterMode + 1) % 3;
            localStorage.setItem('waterMode', waterMode);
            refreshWaterBtnText();
        });

        let type = 0;
        function getRemainingTimes() {
            const wapInfo = $('.wap-info > strong:first-child')?.textContent;
            const reviveBadge = $('.revive-badge');
            type = 0;
            if (wapInfo !== '0') {
                type = 1;
            } else if (reviveBadge) {
                type = 2;
            }
            if (wapInfo === '0' && !reviveBadge) {
                alert('还魂丹用完了！');
                return false;
            }
            return wapInfo !== '0' || !!reviveBadge;
        }

        // 优化：改用循环代替递归，防止栈溢出
        async function Init() {
            while (isHosting) {
                try {
                    if (isOpenJy) {
                        const isBar = isElementExist('.char-buff-bar');
                        if (!isBar) {
                            isHosting = false;
                            btn.textContent = '升级：关';
                            btn.style.backgroundColor = '#f44336';
                            localStorage.setItem('isTower', true);
                            window.location.href = "https://www.duanwuqiufenmao.top/qpet/inventory";
                            return;
                        }
                    }

                    if (!getRemainingTimes()) {
                        isHosting = false;
                        btn.textContent = '升级：关';
                        btn.style.backgroundColor = '#f44336';
                        return;
                    }

                    const towerGrid = $('.tower-grid > button.tower-floor-btn:last-child');
                    if (!towerGrid) continue;
                    towerGrid.click();
                    await delay(500 + Math.floor(Math.random() * 300));

                    if (type === 2) {
                        const b = $('.el-message-box > .el-message-box__btns >button:last-child');
                        b && b.click();
                    }
                    await delay(2000 + Math.floor(Math.random() * 500));

                    const t = $('.el-dialog.battle-dialog.battle-stage-dialog');
                    if (t) {
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                        await delay(800 + Math.floor(Math.random() * 200));
                        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
                    }
                } catch (e) {
                    await delay(1000);
                }
            }
        }

        window.addEventListener('load', function () {
            const isInventory = JSON.parse(localStorage.getItem('isInventory') || 'false');
            if (!isInventory) return;
            localStorage.removeItem('isInventory');
            const isUseExp = localStorage.getItem('isUseExp');
            if (isUseExp === 'true') {
                setTimeout(() => {
                    isHosting = true;
                    btn.textContent = '升级：开';
                    btn.style.backgroundColor = '#4caf50';
                    Init();
                    localStorage.removeItem('isUseExp');
                }, 1000);
            }
        });
    } else {
        // 背包页面：根据选择的模式吃药水
        function useExp() {
            const invGrid = $('.inv-grid > .inv-card-consumable', true);
            const nameSel = '.inv-item-name';
            const useBtnSel = '.inv-btn.inv-btn-use';
            let used = false;

            switch (waterMode) {
                case 0:
                    // 中瓶优先，没有再用小瓶
                    for (let el of invGrid) {
                        const name = el.querySelector(nameSel)?.textContent;
                        if (name === '中瓶经验水') {
                            el.querySelector(useBtnSel).click();
                            used = true;
                            break;
                        }
                    }
                    if (!used) {
                        for (let el of invGrid) {
                            const name = el.querySelector(nameSel)?.textContent;
                            if (name === '小瓶经验水') {
                                el.querySelector(useBtnSel).click();
                                used = true;
                                break;
                            }
                        }
                    }
                    break;
                case 1:
                    // 只用中瓶
                    for (let el of invGrid) {
                        const name = el.querySelector(nameSel)?.textContent;
                        if (name === '中瓶经验水') {
                            el.querySelector(useBtnSel).click();
                            used = true;
                            break;
                        }
                    }
                    break;
                case 2:
                    // 只用小瓶
                    for (let el of invGrid) {
                        const name = el.querySelector(nameSel)?.textContent;
                        if (name === '小瓶经验水') {
                            el.querySelector(useBtnSel).click();
                            used = true;
                            break;
                        }
                    }
                    break;
            }

            if (used) {
                localStorage.setItem('isUseExp', 'true');
                localStorage.setItem('isInventory', true);
                setTimeout(() => {
                    window.location.href = "https://www.duanwuqiufenmao.top/qpet/tower";
                }, 1000);
            }
        }

        window.addEventListener('load', function () {
            setTimeout(() => {
                const isTower = JSON.parse(localStorage.getItem('isTower') || 'false');
                if (!isTower) return;
                localStorage.removeItem('isTower');
                // 读取保存的模式
                waterMode = parseInt(localStorage.getItem('waterMode') || '0');
                useExp();
            }, 1000);
        });
    }

    // 路由监听
    const originalPush = history.pushState;
    history.pushState = function (...args) {
        originalPush.apply(history, args);
        checkRoute();
    };
    window.addEventListener('popstate', checkRoute);

    async function checkRoute() {
        const path = location.pathname;
        const btn = $('#auto-host-btn');
        const btn1 = $('#auto-host-btn1');
        const btn2 = $('#water-mode-btn');
        if (path !== '/qpet/tower') {
            btn && (btn.style.display = 'none');
            btn1 && (btn1.style.display = 'none');
            btn2 && (btn2.style.display = 'none');
        } else {
            btn && (btn.style.display = 'block');
            btn1 && (btn1.style.display = 'block');
            btn2 && (btn2.style.display = 'block');
        }
    }

})();
