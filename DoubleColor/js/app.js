/**
 * 主应用逻辑 - 新UI版本
 */

// 全局状态
let appData = {
    lotteryHistory: null,
    aiPredictions: null,
    predictionsHistory: null
};

// 初始化应用
async function initApp() {
    try {
        await loadAllData();
        renderHeroBanner();
        renderModelsGrid();
        renderHistoryTab();
        renderTripleStats();
        setupTabs();
        hideLoadingScreen();
    } catch (error) {
        console.error('初始化失败:', error);
        alert('数据加载失败，请刷新页面重试');
    }
}

function setupTabs() {
    const allItems = document.querySelectorAll('.nav-item, .mobile-nav-item');
    const allContents = document.querySelectorAll('.tab-content');

    allItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;
            allItems.forEach(i => {
                i.classList.toggle('active', i.dataset.tab === tab);
            });
            allContents.forEach(c => {
                c.classList.toggle('active', c.dataset.tab === tab);
            });

            if (tab === 'triple') {
                renderTripleStats();
            } else if (tab === 'quad') {
                renderQuadTab();
            } else if (tab === 'quint') {
                renderQuintTab();
            } else if (tab === 'sextet') {
                renderSextetTab();
            } else if (tab === 'double') {
                renderDoubleTab();
            }
        });
    });
}

// 加载所有数据
async function loadAllData() {
    try {
        const [lotteryHistory, aiPredictions, predictionsHistory] = await Promise.all([
            DataLoader.loadLotteryHistory(),
            DataLoader.loadPredictions(),
            DataLoader.loadPredictionsHistory()
        ]);

        appData.lotteryHistory = lotteryHistory;
        appData.aiPredictions = aiPredictions;
        appData.predictionsHistory = predictionsHistory;
    } catch (error) {
        console.error('数据加载失败:', error);
        throw error;
    }
}

// 渲染Hero Banner
function renderHeroBanner() {
    if (!appData.lotteryHistory || !appData.aiPredictions) return;

    const nextDraw = appData.lotteryHistory.next_draw;

    // 更新期号
    const heroPeriodEl = document.getElementById('heroPeriod');
    if (heroPeriodEl) heroPeriodEl.textContent = nextDraw.next_period;

    // 更新日期显示
    const heroDateDisplayEl = document.getElementById('heroDateDisplay');
    if (heroDateDisplayEl) heroDateDisplayEl.textContent = nextDraw.next_date_display;

    // 更新开奖时间
    const heroDrawTimeEl = document.getElementById('heroDrawTime');
    if (heroDrawTimeEl) heroDrawTimeEl.textContent = `${nextDraw.draw_time} 开奖`;

    // 更新预测日期
    const heroPredictionDateEl = document.getElementById('heroPredictionDate');
    if (heroPredictionDateEl) heroPredictionDateEl.textContent = appData.aiPredictions.prediction_date;

    // 倒计时 (可选功能)
    const heroCountdownEl = document.getElementById('heroCountdown');
    if (heroCountdownEl) {
        const daysUntil = calculateDaysUntil(nextDraw.next_date);
        heroCountdownEl.textContent = daysUntil > 0 ? `距离开奖仅剩 ${daysUntil} 天` : '即将开奖';
    }
}

// 渲染模型网格
function renderModelsGrid() {
    if (!appData.aiPredictions) return;

    const modelsGridEl = document.getElementById('modelsGrid');
    if (!modelsGridEl) return;

    // 清空现有内容
    modelsGridEl.innerHTML = '';

    // 检测预测期号是否已开奖
    const targetPeriod = appData.aiPredictions.target_period;
    const latestDraw = appData.lotteryHistory?.data?.[0];
    let actualResult = null;

    if (latestDraw && parseInt(targetPeriod) <= parseInt(latestDraw.period)) {
        // 预测期号已开奖，查找对应的开奖结果
        actualResult = appData.lotteryHistory.data.find(draw => draw.period === targetPeriod);

        if (actualResult) {
            // 在网格前添加状态提示
            const statusBanner = createDrawnStatusBanner(actualResult);
            modelsGridEl.appendChild(statusBanner);
        }
    }

    // 渲染每个模型
    appData.aiPredictions.models.forEach(model => {
        const modelCard = Components.createModelCard(model, actualResult);
        modelsGridEl.appendChild(modelCard);
    });
}

// 创建已开奖状态横幅
function createDrawnStatusBanner(actualResult) {
    const banner = document.createElement('div');
    banner.className = 'drawn-status-banner';
    banner.innerHTML = `
        <div class="drawn-status-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
            </svg>
        </div>
        <div class="drawn-status-content">
            <h3 class="drawn-status-title">第 ${actualResult.period} 期已开奖</h3>
            <p class="drawn-status-subtitle">以下为预测命中情况对比</p>
        </div>
        <div class="drawn-status-balls">
            ${actualResult.red_balls.map(num => `<span class="mini-result-ball red">${num}</span>`).join('')}
            <span class="mini-result-ball blue">${actualResult.blue_ball}</span>
        </div>
    `;
    return banner;
}

// 渲染历史统计
function renderHistoryTab() {
    renderStatisticsCards();
    renderFrequencyStats();
}

// 渲染三球统计
function renderTripleStats() {
    if (!appData.lotteryHistory) return;
    const data = appData.lotteryHistory.data;
    const totalPossible = (33 * 32 * 31) / 6; // C(33,3) = 4,455
    const comboCount = {};
    const appearedKeys = new Set();

    data.forEach(d => {
        const reds = d.red_balls.map(x => parseInt(x)).sort((a, c) => a - c);
        for (let i = 0; i < reds.length; i++) {
            for (let j = i + 1; j < reds.length; j++) {
                for (let k = j + 1; k < reds.length; k++) {
                    const key = reds[i].toString().padStart(2, '0') + '.' + reds[j].toString().padStart(2, '0') + '.' + reds[k].toString().padStart(2, '0');
                    comboCount[key] = (comboCount[key] || 0) + 1;
                    appearedKeys.add(key);
                }
            }
        }
    });

    // 计算从未出现的组合
    const missing = [];
    for (let r1 = 1; r1 <= 33; r1++) {
        for (let r2 = r1 + 1; r2 <= 33; r2++) {
            for (let r3 = r2 + 1; r3 <= 33; r3++) {
                const key = r1.toString().padStart(2, '0') + '.' + r2.toString().padStart(2, '0') + '.' + r3.toString().padStart(2, '0');
                if (!appearedKeys.has(key)) {
                    missing.push([r1, r2, r3]);
                }
            }
        }
    }

    renderTripleTable(comboCount, data.length);

    // 更新摘要
    const triTotal = document.getElementById('statTripleTotal');
    if (triTotal) triTotal.textContent = totalPossible.toLocaleString();
    const statTriTotal = document.getElementById('statTriTotal');
    if (statTriTotal) statTriTotal.textContent = data.length;

    // 缺失统计卡片
    document.getElementById('statTripleAll').textContent = totalPossible.toLocaleString();
    document.getElementById('statTripleSeen').textContent = appearedKeys.size.toLocaleString();
    document.getElementById('statTripleMissing').textContent = missing.length.toLocaleString();
    document.getElementById('missingComboCount').textContent = missing.length.toLocaleString() + ' 种';

    renderMissingTripleCombos(missing);
    renderMissingPairs(missing, totalPossible);
}

// 渲染从未出现的三球组合
function renderMissingTripleCombos(missing) {
    const el = document.getElementById('missingCombosGrid');
    if (!el) return;
    el.innerHTML = '';

    if (missing.length === 0) {
        el.innerHTML = '<div class="missing-combos-empty">所有 C(33,3) 组合均已出现 ✅</div>';
        return;
    }

    // 只展示前 500 个，防止页面卡死
    const show = missing.slice(0, 500);
    show.forEach(([r1, r2, r3]) => {
        const item = document.createElement('div');
        item.className = 'missing-combo-item';
        item.innerHTML =
            '<span class="ball-dot red">' + r1.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r2.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r3.toString().padStart(2, '0') + '</span>';
        el.appendChild(item);
    });

    if (missing.length > 500) {
        const more = document.createElement('div');
        more.className = 'missing-combos-more';
        more.textContent = '… 还有 ' + (missing.length - 500).toLocaleString() + ' 种，请查阅详细统计';
        el.appendChild(more);
    }
}

// 在从未出现的三球组合中统计2球组合出现次数 Top 100
function renderMissingPairs(missing, totalPossible) {
    const el = document.getElementById('missingPairsTable');
    if (!el) return;
    el.innerHTML = '';

    if (missing.length === 0) {
        el.innerHTML = '<tr><td colspan="4">无缺失组合</td></tr>';
        return;
    }

    const pairCount = {};
    const totalMissing = missing.length;

    missing.forEach(([r1, r2, r3]) => {
        // 每个缺失三球组合产生 C(3,2)=3 对
        const pairs = [[r1, r2], [r1, r3], [r2, r3]];
        pairs.forEach(([a, b]) => {
            const key = a.toString().padStart(2, '0') + '.' + b.toString().padStart(2, '0');
            pairCount[key] = (pairCount[key] || 0) + 1;
        });
    });

    const sorted = Object.entries(pairCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    sorted.forEach(([pair, cnt], idx) => {
        const nums = pair.split('.');
        const pct = (cnt / totalMissing * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + nums[0] + '</span>' +
                '<span class="ball-dot red">' + nums[1] + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 渲染四球统计
function renderQuadTab() {
    if (!appData.lotteryHistory) return;
    const data = appData.lotteryHistory.data;
    const totalPossible = (33 * 32 * 31 * 30) / 24; // C(33,4) = 40,920
    const comboCount = {};
    const appearedKeys = new Set();

    data.forEach(d => {
        const reds = d.red_balls.map(x => parseInt(x)).sort((a, c) => a - c);
        // C(6,4) = 15 个四球组合
        for (let i = 0; i < reds.length; i++) {
            for (let j = i + 1; j < reds.length; j++) {
                for (let k = j + 1; k < reds.length; k++) {
                    for (let l = k + 1; l < reds.length; l++) {
                        const key = reds[i].toString().padStart(2, '0') + '.' +
                            reds[j].toString().padStart(2, '0') + '.' +
                            reds[k].toString().padStart(2, '0') + '.' +
                            reds[l].toString().padStart(2, '0');
                        comboCount[key] = (comboCount[key] || 0) + 1;
                        appearedKeys.add(key);
                    }
                }
            }
        }
    });

    // 计算从未出现的四球组合
    const missing = [];
    for (let r1 = 1; r1 <= 33; r1++) {
        for (let r2 = r1 + 1; r2 <= 33; r2++) {
            for (let r3 = r2 + 1; r3 <= 33; r3++) {
                for (let r4 = r3 + 1; r4 <= 33; r4++) {
                    const key = r1.toString().padStart(2, '0') + '.' +
                        r2.toString().padStart(2, '0') + '.' +
                        r3.toString().padStart(2, '0') + '.' +
                        r4.toString().padStart(2, '0');
                    if (!appearedKeys.has(key)) {
                        missing.push([r1, r2, r3, r4]);
                    }
                }
            }
        }
    }

    // 更新摘要
    const statQuadTotal = document.getElementById('statQuadTotal');
    if (statQuadTotal) statQuadTotal.textContent = data.length;
    const statQuadPossible = document.getElementById('statQuadPossible');
    if (statQuadPossible) statQuadPossible.textContent = totalPossible.toLocaleString();
    document.getElementById('statQuadAll').textContent = totalPossible.toLocaleString();
    document.getElementById('statQuadSeen').textContent = appearedKeys.size.toLocaleString();
    document.getElementById('statQuadMissing').textContent = missing.length.toLocaleString();
    document.getElementById('quadMissingCount').textContent = missing.length.toLocaleString() + ' 种';

    renderQuadTable(comboCount, data.length);
    renderQuadMissingCombos(missing);
    renderQuadMissingTriples(missing, totalPossible);
}

function renderQuadTable(comboCount, totalDraws) {
    const el = document.getElementById('freqQuadTable');
    if (!el) return;
    el.innerHTML = '';
    const sorted = Object.entries(comboCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    sorted.forEach(([quad, cnt], idx) => {
        const nums = quad.split('.');
        const pct = (cnt / totalDraws * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + nums[0] + '</span>' +
                '<span class="ball-dot red">' + nums[1] + '</span>' +
                '<span class="ball-dot red">' + nums[2] + '</span>' +
                '<span class="ball-dot red">' + nums[3] + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 渲染从未出现的四球组合
function renderQuadMissingCombos(missing) {
    const el = document.getElementById('quadMissingCombosGrid');
    if (!el) return;
    el.innerHTML = '';

    if (missing.length === 0) {
        el.innerHTML = '<div class="missing-combos-empty">所有 C(33,4) 组合均已出现 ✅</div>';
        return;
    }

    const show = missing.slice(0, 500);
    show.forEach(([r1, r2, r3, r4]) => {
        const item = document.createElement('div');
        item.className = 'missing-combo-item';
        item.innerHTML =
            '<span class="ball-dot red">' + r1.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r2.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r3.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r4.toString().padStart(2, '0') + '</span>';
        el.appendChild(item);
    });

    if (missing.length > 500) {
        const more = document.createElement('div');
        more.className = 'missing-combos-more';
        more.textContent = '… 还有 ' + (missing.length - 500).toLocaleString() + ' 种，请查阅详细统计';
        el.appendChild(more);
    }
}

// 在从未出现的四球组合中统计3球组合出现次数 Top 100
function renderQuadMissingTriples(missing, totalPossible) {
    const el = document.getElementById('quadMissingTriplesTable');
    if (!el) return;
    el.innerHTML = '';

    if (missing.length === 0) {
        el.innerHTML = '<tr><td colspan="4">无缺失组合</td></tr>';
        return;
    }

    const tripleCount = {};
    const totalMissing = missing.length;

    missing.forEach(([r1, r2, r3, r4]) => {
        // 每个缺失四球组合产生 C(4,3)=4 个三球组合
        const triples = [[r1, r2, r3], [r1, r2, r4], [r1, r3, r4], [r2, r3, r4]];
        triples.forEach(tr => {
            const key = tr.map(x => x.toString().padStart(2, '0')).join('.');
            tripleCount[key] = (tripleCount[key] || 0) + 1;
        });
    });

    const sorted = Object.entries(tripleCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    sorted.forEach(([triple, cnt], idx) => {
        const nums = triple.split('.');
        const pct = (cnt / totalMissing * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + nums[0] + '</span>' +
                '<span class="ball-dot red">' + nums[1] + '</span>' +
                '<span class="ball-dot red">' + nums[2] + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 渲染两红一蓝统计
function renderDoubleTab() {
    if (!appData.lotteryHistory) return;
    const data = appData.lotteryHistory.data;
    const pairCount = {};
    const comboCount = {};
    const totalPossiblePairs = (33 * 32) / 2; // 496

    data.forEach(d => {
        const reds = d.red_balls.map(x => parseInt(x)).sort((a, c) => a - c);
        // C(6,2) = 15 对红球
        for (let i = 0; i < reds.length; i++) {
            for (let j = i + 1; j < reds.length; j++) {
                const key = reds[i].toString().padStart(2, '0') + '.' + reds[j].toString().padStart(2, '0');
                pairCount[key] = (pairCount[key] || 0) + 1;
                // 红对 + 蓝球
                const comboKey = key + '+' + d.blue_ball;
                comboCount[comboKey] = (comboCount[comboKey] || 0) + 1;
            }
        }
    });

    document.getElementById('statDoubleTotal').textContent = data.length;
    renderDoublePairTable(pairCount, data.length);
    renderDoubleComboTable(comboCount);
    renderDoubleMissingPairs(pairCount, totalPossiblePairs);
}

// 通用 N 球统计渲染引擎
// n: 球数; pick: 每期选出的球数（均为 6）
// config: { totalEl, possibleEl, allEl, seenEl, missingEl, countEl, tableEl, combosGridEl, subTableEl }
function renderNBallTab(n, pick, config) {
    if (!appData.lotteryHistory) return;
    const data = appData.lotteryHistory.data;
    const totalPossible = combinations(33, n);
    const comboCount = {};
    const appearedKeys = new Set();

    // 统计每期产生的 N 球组合
    data.forEach(d => {
        const reds = d.red_balls.map(x => parseInt(x)).sort((a, c) => a - c);
        const keys = combosFromIndices(reds, n, 0, []);
        keys.forEach(key => {
            comboCount[key] = (comboCount[key] || 0) + 1;
            appearedKeys.add(key);
        });
    });

    // 生成所有 C(33,n) 组合，找出缺失的（用索引表示，避免大量字符串拼接）
    const allPossibleIdxs = [];
    const allIdxs = [];
    (function build(start, cur) {
        if (cur.length === n) {
            allIdxs.push(cur.slice());
            return;
        }
        for (let i = start; i <= 33 - (n - cur.length); i++) {
            cur.push(i);
            build(i + 1, cur);
            cur.pop();
        }
    })(1, []);

    const missing = [];
    allIdxs.forEach(idx => {
        const key = idx.map(x => x.toString().padStart(2, '0')).join('.');
        if (!appearedKeys.has(key)) {
            missing.push(idx); // 存索引 [1..33]，避免字符串 split
        }
    });

    // 更新摘要
    const t = data.length;
    document.getElementById(config.totalEl).textContent = t;
    document.getElementById(config.possibleEl).textContent = totalPossible.toLocaleString();
    document.getElementById(config.allEl).textContent = totalPossible.toLocaleString();
    document.getElementById(config.seenEl).textContent = appearedKeys.size.toLocaleString();
    document.getElementById(config.missingEl).textContent = missing.length.toLocaleString();
    document.getElementById(config.countEl).textContent = missing.length.toLocaleString() + ' 种';

    renderNDataTable(config.tableEl, comboCount, t);
    renderNMissingCombosIdx(config.combosGridEl, missing);
    renderNMissingSubsIdx(config.subTableEl, missing, n - 1);
}

// 二项式系数 C(n, k)
function combinations(n, k) {
    if (k > n || k < 0) return 0;
    if (k === 0 || k === n) return 1;
    if (k > n / 2) k = n - k;
    let r = 1;
    for (let i = 1; i <= k; i++) r = Math.round(r * (n - k + i) / i);
    return r;
}

// 从数字数组中生成 n 长组合的 key，start 为起始索引
function combosFromIndices(arr, n, start, cur) {
    if (cur.length === n) {
        return [cur.map(x => x.toString().padStart(2, '0')).join('.')];
    }
    const keys = [];
    for (let i = start; i <= arr.length - (n - cur.length); i++) {
        cur.push(arr[i]);
        keys.push(...combosFromIndices(arr, n, i + 1, cur));
        cur.pop();
    }
    return keys;
}

// 渲染 N 球 Top 100 表格
function renderNDataTable(tableElId, comboCount, totalDraws) {
    const el = document.getElementById(tableElId);
    if (!el) return;
    el.innerHTML = '';
    const sorted = Object.entries(comboCount).sort((a, b) => b[1] - a[1]).slice(0, 100);
    sorted.forEach(([key, cnt], idx) => {
        const nums = key.split('.');
        const pct = (cnt / totalDraws * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                nums.map(n => '<span class="ball-dot red">' + n + '</span>').join('') +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 渲染缺失 N 球组合网格（idx 为 [1..33] 的数组）
function renderNMissingCombosIdx(gridElId, missing) {
    const el = document.getElementById(gridElId);
    if (!el) return;
    el.innerHTML = '';
    if (missing.length === 0) {
        el.innerHTML = '<div class="missing-combos-empty">所有组合均已出现 ✅</div>';
        return;
    }
    const show = missing.slice(0, 500);
    show.forEach(idx => {
        const item = document.createElement('div');
        item.className = 'missing-combo-item';
        item.innerHTML = idx.map(x => '<span class="ball-dot red">' + x.toString().padStart(2, '0') + '</span>').join('');
        el.appendChild(item);
    });
    if (missing.length > 500) {
        const more = document.createElement('div');
        more.className = 'missing-combos-more';
        more.textContent = '… 还有 ' + (missing.length - 500).toLocaleString() + ' 种，请查阅详细统计';
        el.appendChild(more);
    }
}

// 在缺失 N 球组合中统计 (subN) 球组合 Top 100（idx 为 [1..33] 数组）
function renderNMissingSubsIdx(tableElId, missing, subN) {
    const el = document.getElementById(tableElId);
    if (!el) return;
    el.innerHTML = '';
    if (missing.length === 0) {
        el.innerHTML = '<tr><td colspan="4">无缺失组合</td></tr>';
        return;
    }
    const subCount = {};
    const totalMissing = missing.length;
    missing.forEach(idx => {
        // 枚举 idx 中所有 subN 长度组合
        (function build(start, cur) {
            if (cur.length === subN) {
                const key = cur.map(x => x.toString().padStart(2, '0')).join('.');
                subCount[key] = (subCount[key] || 0) + 1;
                return;
            }
            for (let i = start; i <= idx.length - (subN - cur.length); i++) {
                cur.push(idx[i]);
                build(i + 1, cur);
                cur.pop();
            }
        })(0, []);
    });
    const sorted = Object.entries(subCount).sort((a, b) => b[1] - a[1]).slice(0, 100);
    sorted.forEach(([key, cnt], idx) => {
        const nums = key.split('.');
        const pct = (cnt / totalMissing * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                nums.map(n => '<span class="ball-dot red">' + n + '</span>').join('') +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 五球统计入口
function renderQuintTab() {
    const indicator = document.getElementById('quintComputingIndicator');
    if (indicator) indicator.style.display = 'flex';
    // 异步计算避免阻塞 UI
    setTimeout(function() {
        renderNBallTab(5, 6, {
            totalEl: 'statQuintTotal',
            possibleEl: 'statQuintPossible',
            allEl: 'statQuintAll',
            seenEl: 'statQuintSeen',
            missingEl: 'statQuintMissing',
            countEl: 'quintMissingCount',
            tableEl: 'freqQuintTable',
            combosGridEl: 'quintMissingCombosGrid',
            subTableEl: 'quintMissingFoursTable'
        });
        if (indicator) indicator.style.display = 'none';
    }, 50);
}

// 六球统计入口
function renderSextetTab() {
    const indicator = document.getElementById('sextetComputingIndicator');
    if (indicator) indicator.style.display = 'flex';
    setTimeout(function() {
        renderNBallTab(6, 6, {
            totalEl: 'statSextetTotal',
            possibleEl: 'statSextetPossible',
            allEl: 'statSextetAll',
            seenEl: 'statSextetSeen',
            missingEl: 'statSextetMissing',
            countEl: 'sextetMissingCount',
            tableEl: 'freqSextetTable',
            combosGridEl: 'sextetMissingCombosGrid',
            subTableEl: 'sextetMissingFivesTable'
        });
        if (indicator) indicator.style.display = 'none';
    }, 50);
}

function renderDoublePairTable(pairCount, totalDraws) {
    const el = document.getElementById('doublePairTable');
    if (!el) return;
    el.innerHTML = '';
    const sorted = Object.entries(pairCount).sort((a, b) => b[1] - a[1]).slice(0, 50);
    sorted.forEach(([pair, cnt], idx) => {
        const nums = pair.split('.');
        const pct = (cnt / totalDraws * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + nums[0] + '</span>' +
                '<span class="ball-dot red">' + nums[1] + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

function renderDoubleComboTable(comboCount) {
    const el = document.getElementById('doubleComboTable');
    if (!el) return;
    el.innerHTML = '';
    const sorted = Object.entries(comboCount).sort((a, b) => b[1] - a[1]).slice(0, 30);
    const totalDraws = Object.keys(comboCount).length;
    sorted.forEach(([combo, cnt], idx) => {
        const parts = combo.split('+');
        const [r1, r2] = parts[0].split('.');
        const blue = parts[1];
        const pct = (cnt / sorted.length * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + r1 + '</span>' +
                '<span class="ball-dot red">' + r2 + '</span>' +
                '<span class="ball-plus">+</span>' +
                '<span class="ball-dot blue">' + blue + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

function renderDoubleMissingPairs(pairCount, totalPossible) {
    const el = document.getElementById('doubleMissingGrid');
    if (!el) return;
    el.innerHTML = '';
    const appearedKeys = Object.keys(pairCount);
    const missing = [];
    for (let r1 = 1; r1 <= 33; r1++) {
        for (let r2 = r1 + 1; r2 <= 33; r2++) {
            const key = r1.toString().padStart(2, '0') + '.' + r2.toString().padStart(2, '0');
            if (!appearedKeys.includes(key)) {
                missing.push([r1, r2]);
            }
        }
    }
    const info = document.getElementById('doubleMissingInfo');
    if (info) info.textContent = missing.length + ' / ' + totalPossible + ' 种未出现';
    if (missing.length === 0) {
        el.innerHTML = '<div class="freq-missing-empty">所有红球对均已出现 ✅</div>';
        return;
    }
    missing.forEach(([r1, r2]) => {
        const item = document.createElement('div');
        item.className = 'double-missing-item';
        item.innerHTML =
            '<span class="ball-dot red">' + r1.toString().padStart(2, '0') + '</span>' +
            '<span class="ball-dot red">' + r2.toString().padStart(2, '0') + '</span>' +
            '<span class="freq-missing-count">0</span>';
        el.appendChild(item);
    });
}

// 渲染字数频率统计
function renderFrequencyStats() {
    if (!appData.lotteryHistory) return;
    const data = appData.lotteryHistory.data;

    const redCount = {};
    for (let i = 1; i <= 33; i++) redCount[i] = 0;
    const blueCount = {};
    for (let i = 1; i <= 16; i++) blueCount[i] = 0;
    const comboCount = {};

    data.forEach(d => {
        const reds = d.red_balls.map(x => parseInt(x)).sort((a, c) => a - c);
        reds.forEach(r => { redCount[r]++; });
        const b = parseInt(d.blue_ball);
        blueCount[b]++;
        for (let i = 0; i < reds.length; i++) {
            for (let j = i + 1; j < reds.length; j++) {
                const key = reds[i].toString().padStart(2, '0') + '-' + reds[j].toString().padStart(2, '0') + '+' + d.blue_ball;
                comboCount[key] = (comboCount[key] || 0) + 1;
            }
        }
    });

    document.getElementById('freqTotalDraws').textContent = data.length;
    renderFreqTable('freqRedTable', redCount, 'red', 33, data.length);
    renderFreqTable('freqBlueTable', blueCount, 'blue', 16, data.length);
    renderFreqComboTable(comboCount);

    // 计算未出现的组合
    const appearedKeys = Object.keys(comboCount);
    const allKeys = [];
    for (let r1 = 1; r1 <= 33; r1++) {
        for (let r2 = r1 + 1; r2 <= 33; r2++) {
            for (let b = 1; b <= 16; b++) {
                allKeys.push(r1.toString().padStart(2, '0') + '-' + r2.toString().padStart(2, '0') + '+' + b.toString().padStart(2, '0'));
            }
        }
    }
    const missing = allKeys.filter(k => !appearedKeys.includes(k));
    renderMissingCombos(missing, allKeys.length);
}

function renderFreqTable(containerId, counts, color, maxNum, totalDraws) {
    const el = document.getElementById(containerId);
    if (!el) return;
    el.innerHTML = '';

    const sorted = Object.entries(counts)
        .sort((a, b) => b[1] - a[1]);

    sorted.forEach(([num, cnt]) => {
        const pct = (cnt / totalDraws * 100).toFixed(2);
        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-num-cell"><span class="ball-dot ' + color + '">' + num.toString().padStart(2, '0') + '</span></td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

function renderFreqComboTable(comboCount) {
    const el = document.getElementById('freqComboTable');
    if (!el) return;
    el.innerHTML = '';

    const sorted = Object.entries(comboCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30);

    const max = sorted.length > 0 ? sorted[0][1] : 1;
    const total = Object.keys(comboCount).length;

    sorted.forEach(([combo, cnt], idx) => {
        const parts = combo.split('+');
        const [r1, r2] = parts[0].split('-');
        const blue = parts[1];
        const pct = (cnt / total * 100).toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + r1.padStart(2, '0') + '</span>' +
                '<span class="ball-dot red">' + r2.padStart(2, '0') + '</span>' +
                '<span class="ball-plus">+</span>' +
                '<span class="ball-dot blue">' + blue.padStart(2, '0') + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });
}

// 渲染三球组合 Top 100
function renderTripleTable(comboCount, totalDraws) {
    const el = document.getElementById('freqTripleTable');
    if (!el) return;
    el.innerHTML = '';

    const sorted = Object.entries(comboCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 100);

    const max = sorted.length > 0 ? sorted[0][1] : 1;
    const total = Object.keys(comboCount).length;

    sorted.forEach(([triple, cnt], idx) => {
        const nums = triple.split('.');
        const pct = (cnt / totalDraws * 100).toFixed(2);

        const tr = document.createElement('tr');
        tr.innerHTML =
            '<td class="freq-rank-cell">' + (idx + 1) + '</td>' +
            '<td class="freq-balls-cell">' +
                '<span class="ball-dot red">' + nums[0] + '</span>' +
                '<span class="ball-dot red">' + nums[1] + '</span>' +
                '<span class="ball-dot red">' + nums[2] + '</span>' +
            '</td>' +
            '<td class="freq-cnt-cell">' + cnt + '</td>' +
            '<td class="freq-pct-cell">' + pct + '%</td>';
        el.appendChild(tr);
    });

    document.getElementById('statTriTotal').textContent = totalDraws;
}

// 渲染未出现组合
function renderMissingCombos(missing, totalPossible) {
    const el = document.getElementById('freqMissingGrid');
    if (!el) return;
    el.innerHTML = '';

    const info = document.getElementById('freqMissingInfo');
    if (info) {
        info.textContent = missing.length + ' / ' + totalPossible + ' 种未出现';
    }

    if (missing.length === 0) {
        el.innerHTML = '<div class="freq-missing-empty">所有组合均已出现 ✅</div>';
        return;
    }

    missing.forEach(combo => {
        const parts = combo.split('+');
        const [r1, r2] = parts[0].split('-');
        const blue = parts[1];

        const item = document.createElement('div');
        item.className = 'freq-missing-item';
        item.innerHTML =
            '<span class="ball-dot red">' + r1 + '</span>' +
            '<span class="ball-dot red">' + r2 + '</span>' +
            '<span class="ball-plus">+</span>' +
            '<span class="ball-dot blue">' + blue + '</span>' +
            '<span class="freq-missing-count">0</span>';
        el.appendChild(item);
    });
}

// 渲染准确度图表
function renderAccuracyChart() {
    if (!appData.predictionsHistory) return;

    const chartEl = document.getElementById('accuracyChart');
    if (!chartEl) return;

    // 准备图表数据
    const chartData = prepareChartData();

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'line',
        data: {
            labels: chartData.labels,
            datasets: chartData.datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 7,
                    ticks: {
                        stepSize: 1
                    },
                    title: {
                        display: true,
                        text: '命中球数'
                    }
                }
            }
        }
    });
}

// 准备图表数据
function prepareChartData() {
    const history = appData.predictionsHistory.predictions_history;
    const labels = [];
    const modelsData = {};

    // 反转以显示时间顺序
    const reversedHistory = [...history].reverse();

    reversedHistory.forEach(record => {
        labels.push(record.target_period);

        record.models.forEach(model => {
            if (!modelsData[model.model_name]) {
                modelsData[model.model_name] = [];
            }

            // 找到最佳命中数
            const bestHit = Math.max(...model.predictions.map(p => p.hit_result?.total_hits || 0));
            modelsData[model.model_name].push(bestHit);
        });
    });

    // 转换为Chart.js数据集格式
    const colors = {
        'sensenova-6.7-flash-lite': '#06b6d4',
        'GPT-5': '#10b981',
        'Claude 4.5': '#8b5cf6',
        'Gemini 2.5': '#3b82f6',
        'DeepSeek R1': '#f59e0b'
    };

    const datasets = Object.keys(modelsData).map(modelName => ({
        label: modelName,
        data: modelsData[modelName],
        borderColor: colors[modelName] || '#6b7280',
        backgroundColor: colors[modelName] || '#6b7280',
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 7,
        tension: 0.1
    }));

    return { labels, datasets };
}

// 渲染准确度卡片
function renderAccuracyCards() {
    if (!appData.predictionsHistory) return;

    const containerEl = document.getElementById('accuracyCardsContainer');
    if (!containerEl) return;

    // 清空现有内容
    containerEl.innerHTML = '';

    // 渲染每个记录
    appData.predictionsHistory.predictions_history.forEach(record => {
        const card = Components.createAccuracyCard(record);
        containerEl.appendChild(card);
    });
}

// 渲染历史表格
function renderHistoryTable() {
    if (!appData.lotteryHistory) return;

    const tableBodyEl = document.getElementById('historyTableBody');
    if (!tableBodyEl) return;

    // 清空现有内容
    tableBodyEl.innerHTML = '';

    // 渲染每一行
    appData.lotteryHistory.data.forEach(draw => {
        const row = Components.createHistoryTableRow(draw);
        tableBodyEl.appendChild(row);
    });
}

// 渲染频率图表 (分析标签页)
function renderFrequencyChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('frequencyChart');
    if (!chartEl) return;

    // 计算红球频率
    const frequency = {};
    for (let i = 1; i <= 33; i++) {
        frequency[i.toString().padStart(2, '0')] = 0;
    }

    appData.lotteryHistory.data.forEach(draw => {
        draw.red_balls.forEach(ball => {
            frequency[ball] = (frequency[ball] || 0) + 1;
        });
    });

    const labels = Object.keys(frequency).sort();
    const data = labels.map(label => frequency[label]);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: '#fca5a5',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 渲染统计卡片
function renderStatisticsCards() {
    if (!appData.lotteryHistory) return;

    // 计算红球频率
    const redFrequency = {};
    for (let i = 1; i <= 33; i++) {
        redFrequency[i.toString().padStart(2, '0')] = 0;
    }

    // 计算蓝球频率
    const blueFrequency = {};
    for (let i = 1; i <= 16; i++) {
        blueFrequency[i.toString().padStart(2, '0')] = 0;
    }

    // 计算和值
    let totalSum = 0;

    appData.lotteryHistory.data.forEach(draw => {
        // 红球
        draw.red_balls.forEach(ball => {
            redFrequency[ball] = (redFrequency[ball] || 0) + 1;
        });
        // 蓝球
        blueFrequency[draw.blue_ball] = (blueFrequency[draw.blue_ball] || 0) + 1;
        // 和值
        const sum = draw.red_balls.reduce((acc, ball) => acc + parseInt(ball), 0);
        totalSum += sum;
    });

    // 找出最热红球
    const hottestRed = Object.entries(redFrequency).sort((a, b) => b[1] - a[1])[0];

    // 找出最热蓝球
    const hottestBlue = Object.entries(blueFrequency).sort((a, b) => b[1] - a[1])[0];

    // 平均和值
    const avgSum = Math.round(totalSum / appData.lotteryHistory.data.length);

    // 更新UI
    const totalDrawsEl = document.getElementById('statTotalDraws');
    if (totalDrawsEl) totalDrawsEl.textContent = `${appData.lotteryHistory.data.length} 期`;

    const hottestRedEl = document.getElementById('statHottestRed');
    if (hottestRedEl) hottestRedEl.textContent = `${hottestRed[0]} (${hottestRed[1]}次)`;

    const hottestBlueEl = document.getElementById('statHottestBlue');
    if (hottestBlueEl) hottestBlueEl.textContent = `${hottestBlue[0]} (${hottestBlue[1]}次)`;

    const avgSumEl = document.getElementById('statAvgSum');
    if (avgSumEl) avgSumEl.textContent = avgSum;
}

// 渲染蓝球频率图表
function renderBlueFrequencyChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('blueFrequencyChart');
    if (!chartEl) return;

    // 计算蓝球频率
    const frequency = {};
    for (let i = 1; i <= 16; i++) {
        frequency[i.toString().padStart(2, '0')] = 0;
    }

    appData.lotteryHistory.data.forEach(draw => {
        frequency[draw.blue_ball] = (frequency[draw.blue_ball] || 0) + 1;
    });

    const labels = Object.keys(frequency).sort();
    const data = labels.map(label => frequency[label]);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: '#93c5fd',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1
                    }
                }
            }
        }
    });
}

// 渲染奇偶比图表
function renderOddEvenChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('oddEvenChart');
    if (!chartEl) return;

    // 计算奇偶比分布
    const ratioCount = {};

    appData.lotteryHistory.data.forEach(draw => {
        const oddCount = draw.red_balls.filter(ball => parseInt(ball) % 2 === 1).length;
        const evenCount = 6 - oddCount;
        const ratio = `${oddCount}:${evenCount}`;
        ratioCount[ratio] = (ratioCount[ratio] || 0) + 1;
    });

    // 按常见比例排序
    const commonRatios = ['0:6', '1:5', '2:4', '3:3', '4:2', '5:1', '6:0'];
    const labels = commonRatios.filter(r => ratioCount[r]);
    const data = labels.map(label => ratioCount[label] || 0);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'doughnut',
        data: {
            labels: labels.map(l => `${l} (奇:偶)`),
            datasets: [{
                data: data,
                backgroundColor: [
                    '#ef4444', '#f97316', '#f59e0b',
                    '#10b981', '#3b82f6', '#8b5cf6', '#ec4899'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 11
                        }
                    }
                }
            }
        }
    });
}

// 渲染和值走势图表
function renderSumTrendChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('sumTrendChart');
    if (!chartEl) return;

    // 取最近30期
    const recentDraws = appData.lotteryHistory.data.slice(0, 30).reverse();

    const labels = recentDraws.map(draw => draw.period);
    const sums = recentDraws.map(draw =>
        draw.red_balls.reduce((acc, ball) => acc + parseInt(ball), 0)
    );

    // 计算平均线
    const avgSum = sums.reduce((a, b) => a + b, 0) / sums.length;

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '红球和值',
                    data: sums,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.3,
                    fill: true
                },
                {
                    label: '平均值',
                    data: Array(sums.length).fill(avgSum),
                    borderColor: '#94a3b8',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    tension: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 60,
                    max: 180
                }
            }
        }
    });
}

// 渲染区间分布图表
function renderZoneDistributionChart() {
    if (!appData.lotteryHistory) return;

    const chartEl = document.getElementById('zoneDistributionChart');
    if (!chartEl) return;

    // 计算区间分布 (01-11, 12-22, 23-33)
    const zones = {
        '01-11': 0,
        '12-22': 0,
        '23-33': 0
    };

    appData.lotteryHistory.data.forEach(draw => {
        draw.red_balls.forEach(ball => {
            const num = parseInt(ball);
            if (num >= 1 && num <= 11) zones['01-11']++;
            else if (num >= 12 && num <= 22) zones['12-22']++;
            else if (num >= 23 && num <= 33) zones['23-33']++;
        });
    });

    const labels = Object.keys(zones);
    const data = Object.values(zones);

    // 使用Chart.js渲染
    new Chart(chartEl, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: '出现次数',
                data: data,
                backgroundColor: ['#fca5a5', '#93c5fd', '#d8b4fe'],
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 10
                    }
                }
            }
        }
    });
}

// 隐藏加载屏幕
function hideLoadingScreen() {
    const loadingScreen = document.getElementById('loadingScreen');
    const mainApp = document.getElementById('mainApp');

    if (loadingScreen) {
        loadingScreen.style.display = 'none';
    }

    if (mainApp) {
        mainApp.style.display = 'block';
    }
}

// 计算距离目标日期的天数
function calculateDaysUntil(targetDateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays;
}

// 页面加载完成后初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
