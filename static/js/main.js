// データラベルの有効化
Chart.register(ChartDataLabels);

// グラフのインスタンスを保存する変数
let charts = {
    A: { expl: null, cat: null, explPct: null, start: null, duration: null },
    B: { expl: null, cat: null, explPct: null, start: null, duration: null }
};

// --- タブ切り替え機能 ---
function switchTab(tabId, btnElement) {
    // 全タブコンテンツを非表示
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    // 選択されたタブを表示
    document.getElementById(tabId).classList.add('active');
    
    // タブボタンの色（Active状態）を変更
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    btnElement.classList.add('active');
}

// オブジェクトを文字列に変換する補助関数
function formatCounts(countsObj) {
    return Object.entries(countsObj).map(([key, val]) => `${key}(${val}人)`).join(' / ');
}

// --- データ取得と画面更新 ---
async function updateData(side, dateStr) {
    if (!dateStr) {
        document.getElementById(`basic${side}`).innerHTML = "データを選択してください";
        if (charts[side].expl) charts[side].expl.destroy();
        if (charts[side].cat) charts[side].cat.destroy();
        if (charts[side].explPct) charts[side].explPct.destroy();
        if (charts[side].start) charts[side].start.destroy();
        if (charts[side].duration) charts[side].duration.destroy();
        return;
    }

    const response = await fetch(`/api/data/${dateStr}`);
    const data = await response.json();

    // 1. 基本データタブの更新
    document.getElementById(`basic${side}`).innerHTML = `
        <div class="stat-box">
            <h3>${dateStr} の結果</h3>
            <p>回答数: <strong>${data.count}</strong> 人</p>
            <p>満足度平均: <strong>${data.satisfaction_mean}</strong></p>
            <p>開始時間の評価: ${formatCounts(data.start_time_counts)}</p>
            <p>説明時間の評価: ${formatCounts(data.duration_counts)}</p>
        </div>
    `;

    // 2. よかった説明グラフ（人数）の描画
    drawExplChart(side, data, dateStr);

    // 3. よかった説明グラフ（割合）
    drawExplPctChart(side, data, dateStr);

    // 3. 受験区分グラフ（円グラフ）の描画
    // 3. 受験区分グラフ（円グラフ）の描画
    if (data.category_counts) { // ★データが存在するかチェックする
        drawCategoryChart(side, data.category_counts, dateStr);
    };

    if (data.start_time_counts && data.duration_counts) {
        drawTimeCharts(side, data.start_time_counts, data.duration_counts, dateStr);
    }
}

// --- グラフ描画関数（よかった説明） ---
function drawExplChart(side, data, dateStr) {
    const ctx = document.getElementById(`chartExpl${side}`).getContext('2d');
    if (charts[side].expl) charts[side].expl.destroy();

    const colorTotal = 'rgba(150, 150, 150, 0.4)';
    const colorStudent = side === 'A' ? 'rgba(54, 162, 235, 0.6)' : 'rgba(75, 192, 192, 0.6)';
    const colorParent = side === 'A' ? 'rgba(255, 99, 132, 0.6)' : 'rgba(255, 159, 64, 0.6)';

    charts[side].expl = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels,
            datasets: [
                { label: '全体', data: data.explanation_total, backgroundColor: colorTotal },
                { label: '新入生のみ', data: data.explanation_student, backgroundColor: colorStudent },
                { label: '保護者のみ', data: data.explanation_parent, backgroundColor: colorParent }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, // ★追加：CSSの高さに合わせて柔軟に伸びるようにする
            layout: { 
                padding: { top: 30 } 
            },
            scales: {
                x: {
                    ticks: {
                        autoSkip: false,  // ★追加：文字が勝手に省略されるのを防ぐ
                        maxRotation: 45,  // ★追加：文字を45度傾ける
                        minRotation: 45,  // ★追加：最低でも45度傾ける
                        font: { size: 11 } // ★追加：文字サイズを少し調整
                    }
                },
                y: {
                    beginAtZero: true // Y軸が必ず0から始まるようにする
                }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${dateStr} - よかった説明` },
                datalabels: {
                    color: '#444', 
                    anchor: 'end', 
                    align: 'top', 
                    font: { size: 10 },
                    formatter: value => value > 0 ? value + '人' : ''
                }
            }
        }
    });
}

function drawExplPctChart(side, data, dateStr) {
    const ctx = document.getElementById(`chartExplPct${side}`).getContext('2d');
    if (charts[side].explPct) charts[side].explPct.destroy();

    const colorTotal = 'rgba(150, 150, 150, 0.4)';
    const colorStudent = side === 'A' ? 'rgba(54, 162, 235, 0.6)' : 'rgba(75, 192, 192, 0.6)';
    const colorParent = side === 'A' ? 'rgba(255, 99, 132, 0.6)' : 'rgba(255, 159, 64, 0.6)';

    charts[side].explPct = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels,
            datasets: [
                { label: '全体 (%)', data: data.explanation_total_pct, backgroundColor: colorTotal },
                { label: '新入生のみ (%)', data: data.explanation_student_pct, backgroundColor: colorStudent },
                { label: '保護者のみ (%)', data: data.explanation_parent_pct, backgroundColor: colorParent }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 30 } },
            scales: {
                x: {
                    ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 11 } }
                },
                y: {
                    beginAtZero: true
                    // 割合なので max: 100 を設定しても良いですが、項目が多いと1つの割合が小さくなるので自動（未設定）がおすすめです。
                }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${dateStr} - よかった説明 (割合)` },
                datalabels: {
                    color: '#444', 
                    anchor: 'end', 
                    align: 'top', 
                    font: { size: 10 },
                    formatter: value => value > 0 ? value + '%' : '' // ★「人」ではなく「%」にする
                }
            }
        }
    });
}

// --- グラフ描画関数（受験区分：円グラフ） ---
function drawCategoryChart(side, categoryCounts, dateStr) {
    const ctx = document.getElementById(`chartCat${side}`).getContext('2d');
    if (charts[side].cat) charts[side].cat.destroy();

    const labels = Object.keys(categoryCounts);
    const values = Object.values(categoryCounts);

    charts[side].cat = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    'rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 
                    'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)'
                ]
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: `${dateStr} - 受験区分の割合` },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 14 },
                    formatter: value => value + '人'
                }
            }
        }
    });
}

// --- グラフ描画関数（時間評価：円グラフ） ---
function drawTimeCharts(side, startCounts, durationCounts, dateStr) {
    // 1. 開始時間のグラフ
    const ctxStart = document.getElementById(`chartStart${side}`).getContext('2d');
    if (charts[side].start) charts[side].start.destroy();

    charts[side].start = new Chart(ctxStart, {
        type: 'pie',
        data: {
            labels: Object.keys(startCounts),
            datasets: [{
                data: Object.values(startCounts),
                backgroundColor: ['rgba(75, 192, 192, 0.7)', 'rgba(54, 162, 235, 0.7)', 'rgba(153, 102, 255, 0.7)', 'rgba(201, 203, 207, 0.7)']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: `${dateStr} - 開始時間の評価`, font: { size: 16 } },
                datalabels: { color: '#fff', font: { weight: 'bold', size: 14 }, formatter: value => value + '人' }
            }
        }
    });

    // 2. 説明時間のグラフ
    const ctxDuration = document.getElementById(`chartDuration${side}`).getContext('2d');
    if (charts[side].duration) charts[side].duration.destroy();

    charts[side].duration = new Chart(ctxDuration, {
        type: 'pie',
        data: {
            labels: Object.keys(durationCounts),
            datasets: [{
                data: Object.values(durationCounts),
                backgroundColor: ['rgba(255, 159, 64, 0.7)', 'rgba(255, 99, 132, 0.7)', 'rgba(255, 205, 86, 0.7)', 'rgba(201, 203, 207, 0.7)']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: `${dateStr} - 説明時間の評価`, font: { size: 16 } },
                datalabels: { color: '#fff', font: { weight: 'bold', size: 14 }, formatter: value => value + '人' }
            }
        }
    });
}