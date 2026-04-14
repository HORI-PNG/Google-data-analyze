import io
from flask import Flask, render_template, jsonify, request, make_response
import pandas as pd
import numpy as np

app = Flask(__name__)

# --- 1. データの読み込みと結合 ---
# 対面用アンケートを読み込み、形式列を追加。参加者区分の列名を統一
df1 = pd.read_csv("【対面】2026入学準備説明会アンケート（回答）.csv")
df1['形式'] = '対面'
df1 = df1.rename(columns={'新入生ご本人様か保護者の方か教えてください。': '参加者区分'})

# オンライン用アンケートを読み込み、形式列を追加。参加者区分の列名を統一
df2 = pd.read_csv("【オンライン】2026入学準備説明会アンケート（回答）.csv")
df2['形式'] = 'オンライン'
df2 = df2.rename(columns={'本日ご参加された方を教えてください。': '参加者区分'})

# df1とdf2を結合（行方向に連結）
df = pd.concat([df1, df2], ignore_index=True)


# --- ★追加: 2. 複数に分かれた「よかった説明」の列を1つに統合する処理 ---
# 結合対象となる列名のリスト（12月・2月用の列も念のため含めておきます）
target_cols = [
    'よかった、ためになった説明を教えてください',
    'よかった、ためになった説明を教えてください【通学編・講義編】',
    'よかった、ためになった説明を教えてください【昼食編】',
    'よかった、ためになった説明を教えてください【通学編】',
    'よかった、ためになった説明を教えてください【昼食編・学外編】',
    'よかった、ためになった説明を教えてください【4年間】'
]

# 各行（回答者1人）ごとに、対象列のデータを拾い集めてカンマでつなぐ関数
def combine_explanations(row):
    exps = []
    for col in target_cols:
        # その列が存在し、かつ空欄(NaN)でない場合に追加
        if col in row and pd.notna(row[col]) and str(row[col]).strip() != '':
            exps.append(str(row[col]))
    return ','.join(exps)

# データフレームの各行に関数を適用し、「よかった説明_統合」という新しい列を作る
df['よかった説明_統合'] = df.apply(combine_explanations, axis=1)


# --- 3. 日付データの作成 ---
df = df.dropna(subset=['タイムスタンプ'])
df['日付'] = pd.to_datetime(df['タイムスタンプ']).dt.date.astype(str)
df['日付'] = df['形式'] + " : " + df['日付']

# トップページ用ルート
@app.route('/')
def index():
    dates = sorted(df['日付'].unique().tolist())
    return render_template('index.html', dates=dates)

# --- 補助関数: よかった説明を集計 ---
def count_explanations(df_subset):
    # ★変更: 分割列を統合して作った「よかった説明_統合」列を使用する
    good_explanations = df_subset['よかった説明_統合'].fillna('')
    all_explanations = []
    
    for items in good_explanations:
        if items:
            all_explanations.extend([i.strip() for i in items.split(',')])
            
    return pd.Series(all_explanations).value_counts().to_dict()


# --- 4. API: データ集計 ---
@app.route('/api/data')
def get_data():
    dates_str = request.args.get('dates')
    if not dates_str:
        return jsonify({"error": "No dates provided"}), 400

    date_list = dates_str.split(',')
    target_df = df[df['日付'].isin(date_list)]
    
    if target_df.empty:
        return jsonify({"error": "Data not found"}), 404

    # --- A. 全体の基本統計 ---
    total_responses = len(target_df)
    col_satisfaction = '本日の説明会の満足度を教えてください'
    satisfaction_mean = target_df[col_satisfaction].mean()
    if np.isnan(satisfaction_mean):
        satisfaction_mean = 0

    start_time_counts = target_df['開始時間はいかがでしたか。'].value_counts().to_dict()
    duration_counts = target_df['説明時間はいかがでしたか。'].value_counts().to_dict()
    category_counts = target_df['受験区分を教えてください'].value_counts().to_dict()

    # --- B. 9パターン（区分 × 居住）のデータ分割 ---
    col_living = '一人暮らし予定か実家通学予定かお答えください'

    # 条件定義
    cond_student = target_df['参加者区分'].str.contains('新入生', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_parent = target_df['参加者区分'].str.contains('保護者', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_both = target_df['参加者区分'].str.contains('両方', na=False)

    cond_alone = target_df[col_living].str.contains('一人暮らし', na=False)
    cond_home = target_df[col_living].str.contains('実家', na=False)
    cond_unsure = target_df[col_living].str.contains('迷っている', na=False)

    # データフレーム分割
    s_a_df = target_df[cond_student & cond_alone]
    s_h_df = target_df[cond_student & cond_home]
    s_u_df = target_df[cond_student & cond_unsure]

    p_a_df = target_df[cond_parent & cond_alone]
    p_h_df = target_df[cond_parent & cond_home]
    p_u_df = target_df[cond_parent & cond_unsure]

    b_a_df = target_df[cond_both & cond_alone]
    b_h_df = target_df[cond_both & cond_home]
    b_u_df = target_df[cond_both & cond_unsure]

    # --- C. 9パターンの回答数と満足度平均の計算 ---
    def get_stat(df_sub):
        c = len(df_sub)
        m = df_sub[col_satisfaction].mean()
        return c, (round(m, 2) if not np.isnan(m) else 0)

    c_s_a, m_s_a = get_stat(s_a_df)
    c_s_h, m_s_h = get_stat(s_h_df)
    c_s_u, m_s_u = get_stat(s_u_df)
    c_p_a, m_p_a = get_stat(p_a_df)
    c_p_h, m_p_h = get_stat(p_h_df)
    c_p_u, m_p_u = get_stat(p_u_df)
    c_b_a, m_b_a = get_stat(b_a_df)
    c_b_h, m_b_h = get_stat(b_h_df)
    c_b_u, m_b_u = get_stat(b_u_df)

    # --- D. よかった説明（19項目）の集計 ---
    labels = [
        "大学生協のご説明", "通学手段", "もしもへのそなえ(共済/保険など)", 
        "高校と大学の勉強の仕方の違い", "生協PC＋アフターケアについて", "iPadについて", 
        "空きコマの過ごし方", "九工大1年間の食事情", "食堂＋店舗の紹介", "ミールカード", 
        "部活/サークル/学生プロジェクト/委員会", "アルバイト", "その他大学生活（遊び/お財布事情など）", 
        "開講までの準備（オリエンテーションなど）", "毎年の過ごし方", "九工大の4年間（TOEIC）", 
        "九工大の4年間（就活、院進）", "後悔の話", "今からできること（必須教科書・教材など）"
    ]

    def get_counts_and_pct(df_sub):
        counts_dict = count_explanations(df_sub)
        data_list = [counts_dict.get(l, 0) for l in labels]
        total = len(df_sub)
        pct_list = [round((v / total) * 100, 1) if total > 0 else 0 for v in data_list]
        return data_list, pct_list

    total_d, total_p = get_counts_and_pct(target_df)
    s_a_d, s_a_p = get_counts_and_pct(s_a_df)
    s_h_d, s_h_p = get_counts_and_pct(s_h_df)
    s_u_d, s_u_p = get_counts_and_pct(s_u_df)
    p_a_d, p_a_p = get_counts_and_pct(p_a_df)
    p_h_d, p_h_p = get_counts_and_pct(p_h_df)
    p_u_d, p_u_p = get_counts_and_pct(p_u_df)
    b_a_d, b_a_p = get_counts_and_pct(b_a_df)
    b_h_d, b_h_p = get_counts_and_pct(b_h_df)
    b_u_d, b_u_p = get_counts_and_pct(b_u_df)

    # --- E. JSONレスポンス ---
    return jsonify({
        "count": total_responses,
        "satisfaction_mean": round(satisfaction_mean, 2),
        "start_time_counts": start_time_counts,
        "duration_counts": duration_counts,
        "category_counts": category_counts,

        # 9パターンの基本データ
        "stats": {
            "s_a": {"c": c_s_a, "m": m_s_a}, "s_h": {"c": c_s_h, "m": m_s_h}, "s_u": {"c": c_s_u, "m": m_s_u},
            "p_a": {"c": c_p_a, "m": m_p_a}, "p_h": {"c": c_p_h, "m": m_p_h}, "p_u": {"c": c_p_u, "m": m_p_u},
            "b_a": {"c": c_b_a, "m": m_b_a}, "b_h": {"c": c_b_h, "m": m_b_h}, "b_u": {"c": c_b_u, "m": m_b_u}
        },

        # よかった説明のデータ
        "explanation_labels": labels,
        "explanation_total": total_d, "explanation_total_pct": total_p,
        "explanation_student_alone": s_a_d, "explanation_student_alone_pct": s_a_p,
        "explanation_student_home": s_h_d, "explanation_student_home_pct": s_h_p,
        "explanation_student_unsure": s_u_d, "explanation_student_unsure_pct": s_u_p,
        "explanation_parent_alone": p_a_d, "explanation_parent_alone_pct": p_a_p,
        "explanation_parent_home": p_h_d, "explanation_parent_home_pct": p_h_p,
        "explanation_parent_unsure": p_u_d, "explanation_parent_unsure_pct": p_u_p,
        "explanation_both_alone": b_a_d, "explanation_both_alone_pct": b_a_p,
        "explanation_both_home": b_h_d, "explanation_both_home_pct": b_h_p,
        "explanation_both_unsure": b_u_d, "explanation_both_unsure_pct": b_u_p
    })

@app.route('/api/download_all_csv')
def download_all_csv():
    # 1. データフレームをCSV形式の「文字列」としてメモリ上に取得
    csv_str = df.to_csv(index=False)
    
    # 2. Excelで文字化けしないように、文字列を「BOM付きUTF-8」のバイト列に変換
    csv_bytes = csv_str.encode('utf-8-sig')
    
    # 3. レスポンスとしてブラウザに返す
    output = make_response(csv_bytes)
    output.headers["Content-Disposition"] = "attachment; filename=all_survey_data.csv"
    output.headers["Content-type"] = "text/csv; charset=utf-8"
    
    return output

if __name__ == '__main__':
    app.run(debug=True)