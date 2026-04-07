from flask import Flask, render_template, jsonify, request
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

    # 基本データの集計
    total_responses = len(target_df)
    satisfaction_mean = target_df['本日の説明会の満足度を教えてください'].mean()
    if np.isnan(satisfaction_mean):
        satisfaction_mean = 0

    start_time_counts = target_df['開始時間はいかがでしたか。'].value_counts().to_dict()
    duration_counts = target_df['説明時間はいかがでしたか。'].value_counts().to_dict()
    category_counts = target_df['受験区分を教えてください'].value_counts().to_dict()

    # --- 参加者区分(3つ) × 居住予定(3つ) の 9通りに分割 ---
    col_living = '一人暮らし予定か実家通学予定かお答えください'

    cond_student = target_df['参加者区分'].str.contains('新入生', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_parent = target_df['参加者区分'].str.contains('保護者', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_both = target_df['参加者区分'].str.contains('両方', na=False)

    cond_alone = target_df[col_living].str.contains('一人暮らし', na=False)
    cond_home = target_df[col_living].str.contains('実家', na=False)
    cond_unsure = target_df[col_living].str.contains('迷っている', na=False)

    student_alone_df = target_df[cond_student & cond_alone]
    student_home_df  = target_df[cond_student & cond_home]
    student_unsure_df = target_df[cond_student & cond_unsure]

    parent_alone_df = target_df[cond_parent & cond_alone]
    parent_home_df  = target_df[cond_parent & cond_home]
    parent_unsure_df = target_df[cond_parent & cond_unsure]

    both_alone_df = target_df[cond_both & cond_alone]
    both_home_df  = target_df[cond_both & cond_home]
    both_unsure_df = target_df[cond_both & cond_unsure]

    # 集計実行
    total_counts = count_explanations(target_df)
    student_alone_counts = count_explanations(student_alone_df)
    student_home_counts = count_explanations(student_home_df)
    student_unsure_counts = count_explanations(student_unsure_df)
    parent_alone_counts = count_explanations(parent_alone_df)
    parent_home_counts = count_explanations(parent_home_df)
    parent_unsure_counts = count_explanations(parent_unsure_df)
    both_alone_counts = count_explanations(both_alone_df)
    both_home_counts = count_explanations(both_home_df)
    both_unsure_counts = count_explanations(both_unsure_df)

    # ★変更: 3月用の19項目に書き換え
    labels = [
        "大学生協のご説明", "通学手段", "もしもへのそなえ(共済/保険など)", 
        "高校と大学の勉強の仕方の違い", "生協PC＋アフターケアについて", "iPadについて", 
        "空きコマの過ごし方", "九工大1年間の食事情", "食堂＋店舗の紹介", "ミールカード", 
        "部活/サークル/学生プロジェクト/委員会", "アルバイト", "その他大学生活（遊び/お財布事情など）", 
        "開講までの準備（オリエンテーションなど）", "毎年の過ごし方", "九工大の4年間（TOEIC）", 
        "九工大の4年間（就活、院進）", "後悔の話", "今からできること（必須教科書・教材など）"
    ]
    
    # データを配列化
    total_data = [total_counts.get(label, 0) for label in labels]
    student_alone_data = [student_alone_counts.get(label, 0) for label in labels]
    student_home_data = [student_home_counts.get(label, 0) for label in labels]
    student_unsure_data = [student_unsure_counts.get(label, 0) for label in labels]
    parent_alone_data = [parent_alone_counts.get(label, 0) for label in labels]
    parent_home_data = [parent_home_counts.get(label, 0) for label in labels]
    parent_unsure_data = [parent_unsure_counts.get(label, 0) for label in labels]
    both_alone_data = [both_alone_counts.get(label, 0) for label in labels]
    both_home_data = [both_home_counts.get(label, 0) for label in labels]
    both_unsure_data = [both_unsure_counts.get(label, 0) for label in labels]

    # 割合の算出
    def calc_pct(data_list, df_subset):
        total = len(df_subset)
        return [round((v / total) * 100, 1) if total > 0 else 0 for v in data_list]

    total_pct = calc_pct(total_data, target_df)
    student_alone_pct = calc_pct(student_alone_data, student_alone_df)
    student_home_pct = calc_pct(student_home_data, student_home_df)
    student_unsure_pct = calc_pct(student_unsure_data, student_unsure_df)
    parent_alone_pct = calc_pct(parent_alone_data, parent_alone_df)
    parent_home_pct = calc_pct(parent_home_data, parent_home_df)
    parent_unsure_pct = calc_pct(parent_unsure_data, parent_unsure_df)
    both_alone_pct = calc_pct(both_alone_data, both_alone_df)
    both_home_pct = calc_pct(both_home_data, both_home_df)
    both_unsure_pct = calc_pct(both_unsure_data, both_unsure_df)

    return jsonify({
        "count": total_responses,
        "satisfaction_mean": round(satisfaction_mean, 2),
        "start_time_counts": start_time_counts,
        "duration_counts": duration_counts,
        "category_counts": category_counts,
        
        "explanation_labels": labels,
        "explanation_total": total_data,
        
        "explanation_student_alone": student_alone_data,
        "explanation_student_home": student_home_data,
        "explanation_student_unsure": student_unsure_data,
        "explanation_parent_alone": parent_alone_data,
        "explanation_parent_home": parent_home_data,
        "explanation_parent_unsure": parent_unsure_data,
        "explanation_both_alone": both_alone_data,
        "explanation_both_home": both_home_data,
        "explanation_both_unsure": both_unsure_data,
        
        "explanation_total_pct": total_pct,
        "explanation_student_alone_pct": student_alone_pct,
        "explanation_student_home_pct": student_home_pct,
        "explanation_student_unsure_pct": student_unsure_pct,
        "explanation_parent_alone_pct": parent_alone_pct,
        "explanation_parent_home_pct": parent_home_pct,
        "explanation_parent_unsure_pct": parent_unsure_pct,
        "explanation_both_alone_pct": both_alone_pct,
        "explanation_both_home_pct": both_home_pct,
        "explanation_both_unsure_pct": both_unsure_pct
    })

if __name__ == '__main__':
    app.run(debug=True)