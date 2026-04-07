// データラベルとアニメーションの設定
Chart.register(ChartDataLabels);
Chart.defaults.animation = false;

let charts = {
    A: { expl: null, cat: null, explPct: null, start: null, duration: null },
    B: { expl: null, cat: null, explPct: null, start: null, duration: null }
};

// タブ切り替え機能
function switchTab(btnElement, targetId) {
    const panel = btnElement.closest('.panel');
    panel.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    panel.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(targetId).classList.add('active');
    btnElement.classList.add('active');
}

function formatCounts(countsObj) {
    return Object.entries(countsObj).map(([key, val]) => `${key}(${val}人)`).join(' / ');
}

// データ取得と画面更新
async function updateData(side, selectElement) {
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

    document.getElementById(`basic${side}`).innerHTML = `
        <div class="stat-box">
            <h3>${dateStr} の結果</h3>
            <p>回答数: <strong>${data.count}</strong> 人</p>
            <p>満足度平均: <strong>${data.satisfaction_mean}</strong></p>
            <p>開始時間の評価: ${formatCounts(data.start_time_counts)}</p>
            <p>説明時間の評価: ${formatCounts(data.duration_counts)}</p>
        </div>
    `;

    drawExplChart(side, data, dateStr);
    drawExplPctChart(side, data, dateStr);
    if (data.category_counts) drawCategoryChart(side, data.category_counts, dateStr);
    if (data.start_time_counts && data.duration_counts) drawTimeCharts(side, data.start_time_counts, data.duration_counts, dateStr);
}

// グラフ描画関数（よかった説明 - 人数）
function drawExplChart(side, data, dateStr) {
    const ctx = document.getElementById(`chartExpl${side}`).getContext('2d');
    if (charts[side].expl) charts[side].expl.destroy();

    charts[side].expl = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels, // 19項目が自動的に入ります
            datasets: [
                { label: '全体', data: data.explanation_total, backgroundColor: 'rgba(150, 150, 150, 0.4)' },
                { label: '新入生(一人)', data: data.explanation_student_alone, backgroundColor: 'rgba(54, 162, 235, 0.9)' },
                { label: '新入生(実家)', data: data.explanation_student_home, backgroundColor: 'rgba(54, 162, 235, 0.5)' },
                { label: '新入生(迷い)', data: data.explanation_student_unsure, backgroundColor: 'rgba(54, 162, 235, 0.2)' },
                { label: '保護者(一人)', data: data.explanation_parent_alone, backgroundColor: 'rgba(255, 99, 132, 0.9)' },
                { label: '保護者(実家)', data: data.explanation_parent_home, backgroundColor: 'rgba(255, 99, 132, 0.5)' },
                { label: '保護者(迷い)', data: data.explanation_parent_unsure, backgroundColor: 'rgba(255, 99, 132, 0.2)' },
                { label: '両方(一人)', data: data.explanation_both_alone, backgroundColor: 'rgba(75, 192, 75, 0.9)' },
                { label: '両方(実家)', data: data.explanation_both_home, backgroundColor: 'rgba(75, 192, 75, 0.5)' },
                { label: '両方(迷い)', data: data.explanation_both_unsure, backgroundColor: 'rgba(75, 192, 75, 0.2)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false, 
            layout: { padding: { top: 30 } },
            scales: {
                // 19項目になるため、ラベルが重ならないよう斜め表示設定にしています
                x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10 } } },
                y: { beginAtZero: true, grace: '10%' }
            },
            plugins: {
                legend: { position: 'top' },
                title: { display: true, text: `${dateStr} - よかった説明(人数)` },
                datalabels: {
                    color: '#444', anchor: 'end', align: 'top', font: { size: 8 }, // 文字サイズを小さめに
                    formatter: value => value > 0 ? value : ''
                }
            }
        }
    });
}

// グラフ描画関数（よかった説明 - 割合）
function drawExplPctChart(side, data, dateStr) {
    const ctx = document.getElementById(`chartExplPct${side}`).getContext('2d');
    if (charts[side].explPct) charts[side].explPct.destroy();

    charts[side].explPct = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.explanation_labels,
            datasets: [
                { label: '全体 (%)', data: data.explanation_total_pct, backgroundColor: 'rgba(150, 150, 150, 0.4)' },
                { label: '新入生(一人)%', data: data.explanation_student_alone_pct, backgroundColor: 'rgba(54, 162, 235, 0.9)' },
                { label: '新入生(実家)%', data: data.explanation_student_home_pct, backgroundColor: 'rgba(54, 162, 235, 0.5)' },
                { label: '新入生(迷い)%', data: data.explanation_student_unsure_pct, backgroundColor: 'rgba(54, 162, 235, 0.2)' },
                { label: '保護者(一人)%', data: data.explanation_parent_alone_pct, backgroundColor: 'rgba(255, 99, 132, 0.9)' },
                { label: '保護者(実家)%', data: data.explanation_parent_home_pct, backgroundColor: 'rgba(255, 99, 132, 0.5)' },
                { label: '保護者(迷い)%', data: data.explanation_parent_unsure_pct, backgroundColor: 'rgba(255, 99, 132, 0.2)' },
                { label: '両方(一人)%', data: data.explanation_both_alone_pct, backgroundColor: 'rgba(75, 192, 75, 0.9)' },
                { label: '両方(実家)%', data: data.explanation_both_home_pct, backgroundColor: 'rgba(75, 192, 75, 0.5)' },
                { label: '両方(迷い)%', data: data.explanation_both_unsure_pct, backgroundColor: 'rgba(75, 192, 75, 0.2)' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 40 } }, 
            scales: {
                x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, font: { size: 10 } } },
                y: { beginAtZero: true, max: 115 }
            },
            plugins: {
                legend: { position: 'top', labels: { padding: 20 } },
                title: { display: true, text: `${dateStr} - よかった説明 (割合)` },
                datalabels: {
                    color: '#444', anchor: 'end', align: 'top', font: { size: 7 }, // 文字サイズを小さめに
                    formatter: value => value > 0 ? value + '%' : ''
                }
            }
        }
    });
}

// 円グラフ描画（受験区分）
function drawCategoryChart(side, categoryCounts, dateStr) {
    const ctx = document.getElementById(`chartCat${side}`).getContext('2d');
    if (charts[side].cat) charts[side].cat.destroy();

    charts[side].cat = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: Object.keys(categoryCounts),
            datasets: [{
                data: Object.values(categoryCounts),
                backgroundColor: ['rgba(255, 99, 132, 0.6)', 'rgba(54, 162, 235, 0.6)', 'rgba(255, 206, 86, 0.6)', 'rgba(75, 192, 192, 0.6)']
            }]
        },
        options: {
            responsive: true,
            plugins: {
                title: { display: true, text: `${dateStr} - 受験区分の割合` },
                datalabels: { color: '#fff', font: { weight: 'bold', size: 14 }, formatter: value => value + '人' }
            }
        }
    });
}

// 円グラフ描画（時間評価）
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
                title: { display: true, text: `${dateStr} - 開始時間の評価` },
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
                title: { display: true, text: `${dateStr} - 説明時間の評価` },
                datalabels: { color: '#fff', font: { weight: 'bold', size: 14 }, formatter: value => value + '人' }
            }
        }
    });
}

// PDF出力機能
async function downloadPDF(side, btnElement) {
    const { jsPDF } = window.jspdf;
    const panelElement = btnElement.closest('.panel');
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

        tabContents.forEach(content => content.style.animation = 'none');

        for (let i = 0; i < tabContents.length; i++) {
            tabBtns.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            tabBtns[i].classList.add('active');
            tabContents[i].classList.add('active');
            await new Promise(resolve => setTimeout(resolve, 150));

            const canvas = await html2canvas(panelElement, { scale: 2, backgroundColor: "#ffffff" });
            const imgData = canvas.toDataURL('image/png');
            const printHeight = (canvas.height * printWidth) / canvas.width;

            if (i > 0) pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, margin, printWidth, printHeight);
        }

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

// Excel出力機能
async function downloadExcel(side, btnElement) {
    const panelElement = btnElement.closest('.panel');
    const selectElement = panelElement.querySelector('select');
    const selectedOptions = Array.from(selectElement.selectedOptions).map(opt => opt.value);

    if (selectedOptions.length === 0) {
        alert("データを出力するには、対象の日付を選択してください。");
        return;
    }

    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = "⏳ 出力中...";
    btnElement.disabled = true;

    try {
        const datesQuery = selectedOptions.join(',');
        const response = await fetch(`/api/data?dates=${datesQuery}`);
        const data = await response.json();

        const wb = XLSX.utils.book_new();

        // 基本データ
        const basicData = [
            ["項目", "値"],
            ["対象日付", selectedOptions.join(' & ')],
            ["回答数", data.count],
            ["満足度平均", data.satisfaction_mean]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(basicData), "基本データ");

        // よかった説明（19項目対応）
        const explRows = [
            ["説明項目", 
             "全体(人)", "新入生一人(人)", "新入生実家(人)", "新入生迷(人)", 
             "保護者一人(人)", "保護者実家(人)", "保護者迷(人)", 
             "両方一人(人)", "両方実家(人)", "両方迷(人)",
             "全体(%)", "新入生一人(%)", "新入生実家(%)", "新入生迷(%)", 
             "保護者一人(%)", "保護者実家(%)", "保護者迷(%)", 
             "両方一人(%)", "両方実家(%)", "両方迷(%)"]
        ];
        
        for (let i = 0; i < data.explanation_labels.length; i++) {
            explRows.push([
                data.explanation_labels[i],
                data.explanation_total[i],
                data.explanation_student_alone[i], data.explanation_student_home[i], data.explanation_student_unsure[i],
                data.explanation_parent_alone[i], data.explanation_parent_home[i], data.explanation_parent_unsure[i],
                data.explanation_both_alone[i], data.explanation_both_home[i], data.explanation_both_unsure[i],
                data.explanation_total_pct[i],
                data.explanation_student_alone_pct[i], data.explanation_student_home_pct[i], data.explanation_student_unsure_pct[i],
                data.explanation_parent_alone_pct[i], data.explanation_parent_home_pct[i], data.explanation_parent_unsure_pct[i],
                data.explanation_both_alone_pct[i], data.explanation_both_home_pct[i], data.explanation_both_unsure_pct[i]
            ]);
        }
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(explRows), "よかった説明");

        // 属性・時間評価
        const otherRows = [];
        otherRows.push(["【受験区分】", "人数"]);
        if (data.category_counts) Object.entries(data.category_counts).forEach(([k, v]) => otherRows.push([k, v]));
        
        otherRows.push(["", ""]); 
        otherRows.push(["【開始時間の評価】", "人数"]);
        if (data.start_time_counts) Object.entries(data.start_time_counts).forEach(([k, v]) => otherRows.push([k, v]));
        
        otherRows.push(["", ""]); 
        otherRows.push(["【説明時間の評価】", "人数"]);
        if (data.duration_counts) Object.entries(data.duration_counts).forEach(([k, v]) => otherRows.push([k, v]));
        
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(otherRows), "属性・時間評価");

        const dateText = selectedOptions.join('_').replace(/ /g, '');
        XLSX.writeFile(wb, `入説集計データ_パネル${side}_${dateText}.xlsx`);

    } catch (error) {
        console.error("Excel生成エラー:", error);
        alert("Excelの出力に失敗しました。");
    } finally {
        btnElement.innerHTML = originalText;
        btnElement.disabled = false;
    }
}

// 個別グラフ画像保存機能
function saveChartImage(canvasId, chartTypeName) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        alert("グラフが見つかりません。");
        return;
    }

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const ctx = tempCanvas.getContext('2d');
    
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
    ctx.drawImage(canvas, 0, 0);

    const imageDataUrl = tempCanvas.toDataURL('image/png');
    const panelSide = canvasId.endsWith('A') ? 'A' : 'B';
    const panelElement = canvas.closest('.panel');
    const selectElement = panelElement.querySelector('select');
    
    let dateText = "未選択";
    if (selectElement.selectedOptions.length > 0) {
        dateText = Array.from(selectElement.selectedOptions).map(opt => opt.value.replace(/ /g, '')).join('_');
    }

    const link = document.createElement('a');
    link.href = imageDataUrl;
    link.download = `グラフ_${panelSide}_${chartTypeName}_${dateText}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}