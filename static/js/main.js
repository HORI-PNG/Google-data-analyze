// データラベルの有効化
Chart.register(ChartDataLabels);
Chart.defaults.animation = false;

// グラフのインスタンスを保存する変数
let charts = {
    A: { expl: null, cat: null, explPct: null, start: null, duration: null },
    B: { expl: null, cat: null, explPct: null, start: null, duration: null }
};

// --- タブ切り替え機能 ---
function switchTab(btnElement, targetId) {
    // 1. クリックされたボタンが所属している親パネル（AまたはB）を探す
    const panel = btnElement.closest('.panel');
    
    // 2. そのパネルの中にあるコンテンツとボタンのアクティブ状態をすべてリセット
    panel.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    panel.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    // 3. クリックされたボタンと、対象のコンテンツだけをアクティブにする
    document.getElementById(targetId).classList.add('active');
    btnElement.classList.add('active');
}

// オブジェクトを文字列に変換する補助関数
function formatCounts(countsObj) {
    return Object.entries(countsObj).map(([key, val]) => `${key}(${val}人)`).join(' / ');
}

// --- データ取得と画面更新 ---
async function updateData(side, selectElement) {
    // 選択されたすべてのオプション（日付）を配列として取得
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);

    if (selectedOptions.length === 0) {
        document.getElementById(`basic${side}`).innerHTML = "データを選択してください";
        if (charts[side].expl) charts[side].expl.destroy();
        if (charts[side].cat) charts[side].cat.destroy();
        if (charts[side].explPct) charts[side].explPct.destroy();
        if (charts[side].start) charts[side].start.destroy();
        if (charts[side].duration) charts[side].duration.destroy();
        return;
    }

    const datesQuery = selectedOptions.join(',');
    const dateStr = selectedOptions.join(' & ');

    const response = await fetch(`/api/data?dates=${datesQuery}`);
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

    // 3. よかった説明グラフ（割合）の描画
    drawExplPctChart(side, data, dateStr);

    // 4. 受験区分グラフ（円グラフ）の描画
    if (data.category_counts) {
        drawCategoryChart(side, data.category_counts, dateStr);
    }

    // 5. 時間評価グラフ（円グラフ）の描画
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
    const colorBoth = side === 'A' ? 'rgba(75, 192, 75, 0.6)' : 'rgba(153, 102, 255, 0.6)'; // ★追加：両方の色

    charts[side].expl = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels,
            datasets: [
                { label: '全体', data: data.explanation_total, backgroundColor: colorTotal },
                { label: '新入生のみ', data: data.explanation_student, backgroundColor: colorStudent },
                { label: '保護者のみ', data: data.explanation_parent, backgroundColor: colorParent },
                { label: '両方(ｵﾝﾗｲﾝ)', data: data.explanation_both, backgroundColor: colorBoth } // ★追加
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
                    beginAtZero: true,
                    grace: '10%'
                 }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${dateStr} - よかった説明` },
                datalabels: {
                    color: '#444', anchor: 'end', align: 'top', font: { size: 10 },
                    formatter: value => value > 0 ? value + '人' : ''
                }
            }
        }
    });
}

// --- グラフ描画関数（よかった説明 - 割合） ---
// --- グラフ描画関数（よかった説明 - 割合） ---
function drawExplPctChart(side, data, dateStr) {
    // ★ ここから下の5行が消えてしまっていたので復活させます！
    const ctx = document.getElementById(`chartExplPct${side}`).getContext('2d');
    if (charts[side].explPct) charts[side].explPct.destroy();

    const colorTotal = 'rgba(150, 150, 150, 0.4)';
    const colorStudent = side === 'A' ? 'rgba(54, 162, 235, 0.6)' : 'rgba(75, 192, 192, 0.6)';
    const colorParent = side === 'A' ? 'rgba(255, 99, 132, 0.6)' : 'rgba(255, 159, 64, 0.6)';
    const colorBoth = side === 'A' ? 'rgba(75, 192, 75, 0.6)' : 'rgba(153, 102, 255, 0.6)'; 

    charts[side].explPct = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels,
            datasets: [
                { label: '全体 (%)', data: data.explanation_total_pct, backgroundColor: colorTotal },
                { label: '新入生のみ (%)', data: data.explanation_student_pct, backgroundColor: colorStudent },
                { label: '保護者のみ (%)', data: data.explanation_parent_pct, backgroundColor: colorParent },
                { label: '両方 (%)', data: data.explanation_both_pct, backgroundColor: colorBoth }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // 上部のパディングを少し増やして余裕を持たせる（30 → 40）
            layout: { padding: { top: 40 } }, 
            scales: {
                x: {
                    ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 11 } }
                },
                y: { 
                    beginAtZero: true,
                    // Y軸の最大値を115くらいに設定して、100%の棒の上に隙間を作る
                    max: 115 
                }
            },
            plugins: {
                legend: { 
                    position: 'top',
                    // 凡例（全体、新入生などの四角）の下に余白を作る
                    labels: { padding: 20 } 
                },
                title: { display: true, text: `${dateStr} - よかった説明 (割合)` },
                datalabels: {
                    color: '#444', anchor: 'end', align: 'top', font: { size: 8 },
                    formatter: value => value > 0 ? value + '%' : ''
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

// --- PDF出力機能 (全データ出力版) ---
async function downloadPDF(side, btnElement) {
    const { jsPDF } = window.jspdf;
    const panelElement = btnElement.closest('.panel');

    // 処理中はボタンの文字を変えて連打を防止
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳ 全データ出力中...";
    btnElement.disabled = true;

    try {
        const pdf = new jsPDF('p', 'mm', 'a4');
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const margin = 10;
        const printWidth = pdfWidth - (margin * 2);

        const activeBtn = panelElement.querySelector('.tab-btn.active');
        const activeContent = panelElement.querySelector('.tab-content.active');

        const tabBtns = Array.from(panelElement.querySelectorAll('.tab-btn'));
        const tabContents = Array.from(panelElement.querySelectorAll('.tab-content'));

        // ★追加：撮影中だけ、CSSの「フワッと表示」アニメーションを無効化する！
        tabContents.forEach(content => content.style.animation = 'none');

        for (let i = 0; i < tabContents.length; i++) {
            
            tabBtns.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            tabBtns[i].classList.add('active');
            tabContents[i].classList.add('active');

            // グラフの描画が完了するまで一瞬待つ
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(panelElement, { 
                scale: 2, 
                backgroundColor: "#ffffff" 
            });
            const imgData = canvas.toDataURL('image/png');
            const printHeight = (canvas.height * printWidth) / canvas.width;

            if (i > 0) {
                pdf.addPage();
            }
            
            pdf.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight);
        }

        // ★追加：すべての撮影が終わったら、アニメーションの設定を元に戻す
        tabContents.forEach(content => content.style.animation = '');

        tabBtns.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
        if (activeContent) activeContent.classList.add('active');

        const dateText = panelElement.querySelector('select').value || '未選択';
        pdf.save(`入説レポート_パネル${side}_${dateText.replace(/ /g, '')}.pdf`);

    } catch (error) {
        console.error("PDF生成エラー:", error);
        alert("PDFの出力に失敗しました。");
    } finally {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

// --- (既存のコードの末尾に追加) ---

// --- Excel出力機能 ---
async function downloadExcel(side, btnElement) {
    const panelElement = btnElement.closest('.panel');
    const selectElement = panelElement.querySelector('select');
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);

    if (selectedOptions.length === 0) {
        alert("データを出力するには、対象の日付を選択してください。");
        return;
    }

    // 処理中はボタン状態を変更
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳ 出力中...";
    btnElement.disabled = true;

    try {
        // APIから対象のデータを再取得
        const datesQuery = selectedOptions.join(',');
        const response = await fetch(`/api/data?dates=${datesQuery}`);
        const data = await response.json();

        // エクセルのワークブック（ファイル本体）を作成
        const wb = XLSX.utils.book_new();

        // --- シート1: 基本データ ---
        const basicData = [
            ["項目", "値"],
            ["対象日付", selectedOptions.join(' & ')],
            ["回答数", data.count],
            ["満足度平均", data.satisfaction_mean]
        ];
        const wsBasic = XLSX.utils.aoa_to_sheet(basicData);
        XLSX.utils.book_append_sheet(wb, wsBasic, "基本データ");

        // --- シート2: よかった説明 ---
        // ヘッダー行
        const explRows = [
            ["説明項目", "全体(人)", "新入生のみ(人)", "保護者のみ(人)", "両方(人)", "全体(%)", "新入生のみ(%)", "保護者のみ(%)", "両方(%)"]
        ];
        // データ行
        for (let i = 0; i < data.explanation_labels.length; i++) {
            explRows.push([
                data.explanation_labels[i],
                data.explanation_total[i],
                data.explanation_student[i],
                data.explanation_parent[i],
                data.explanation_both[i],
                data.explanation_total_pct[i],
                data.explanation_student_pct[i],
                data.explanation_parent_pct[i],
                data.explanation_both_pct[i]
            ]);
        }
        const wsExpl = XLSX.utils.aoa_to_sheet(explRows);
        XLSX.utils.book_append_sheet(wb, wsExpl, "よかった説明");

        // --- シート3: 属性・時間評価 ---
        const otherRows = [];
        
        otherRows.push(["【受験区分】", "人数"]);
        if (data.category_counts) {
            Object.entries(data.category_counts).forEach(([k, v]) => otherRows.push([k, v]));
        }
        otherRows.push(["", ""]); // 空行
        
        otherRows.push(["【開始時間の評価】", "人数"]);
        if (data.start_time_counts) {
            Object.entries(data.start_time_counts).forEach(([k, v]) => otherRows.push([k, v]));
        }
        otherRows.push(["", ""]); // 空行
        
        otherRows.push(["【説明時間の評価】", "人数"]);
        if (data.duration_counts) {
            Object.entries(data.duration_counts).forEach(([k, v]) => otherRows.push([k, v]));
        }
        const wsOther = XLSX.utils.aoa_to_sheet(otherRows);
        XLSX.utils.book_append_sheet(wb, wsOther, "属性・時間評価");

        // --- ファイル出力 ---
        const dateText = selectedOptions.join('_').replace(/ /g, '');
        const fileName = `入説集計データ_パネル${side}_${dateText}.xlsx`;
        
        // Excelファイルとしてダウンロード
        XLSX.writeFile(wb, fileName);

    } catch (error) {
        console.error("Excel生成エラー:", error);
        alert("Excelの出力に失敗しました。");
    } finally {
        // ボタン状態を元に戻す
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}