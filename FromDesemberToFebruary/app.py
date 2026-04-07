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

# df1とdf2を結合（行方向に連結）し、インデックスを振り直す
df = pd.concat([df1, df2], ignore_index=True)

# --- 2. 日付データの作成 ---
# タイムスタンプが空の行を削除し、日付部分のみを抽出して文字列に変換
df = df.dropna(subset=['タイムスタンプ'])
df['日付'] = pd.to_datetime(df['タイムスタンプ']).dt.date.astype(str)

# プルダウンで選びやすいよう「対面 : 2025-12-14」のような表記にする
df['日付'] = df['形式'] + " : " + df['日付']

# トップページへのアクセス時、重複のない日付リストをテンプレートに渡す
@app.route('/')
def index():
    dates = sorted(df['日付'].unique().tolist())
    return render_template('index.html', dates=dates)

# --- よかった説明を集計する補助関数 ---
def count_explanations(df_subset):
    # NaN（空データ）を空文字に変換
    good_explanations = df_subset['よかった、ためになった説明を教えてください'].fillna('')
    all_explanations = []
    
    # 各回答者のカンマ区切りの文字列を分割し、1つの巨大なリストに集約
    for items in good_explanations:
        if items:
            all_explanations.extend([i.strip() for i in items.split(',')])
            
    # pandasの機能を使って各項目の出現回数をカウントし、辞書型で返す
    return pd.Series(all_explanations).value_counts().to_dict()

# --- API: 選択された日付のデータを集計して返す ---
@app.route('/api/data')
def get_data():
    dates_str = request.args.get('dates')
    
    if not dates_str:
        return jsonify({"error": "No dates provided"}), 400

    # カンマ区切りの文字列をリストに変換
    date_list = dates_str.split(',')

    # 選ばれた日付に含まれるデータを抽出
    target_df = df[df['日付'].isin(date_list)]
    
    if target_df.empty:
        return jsonify({"error": "Data not found"}), 404

    # 全体回答数と満足度平均の算出
    total_responses = len(target_df)
    satisfaction_mean = target_df['本日の説明会の満足度を教えてください'].mean()
    if np.isnan(satisfaction_mean):
        satisfaction_mean = 0

    # 評価などの集計
    start_time_counts = target_df['開始時間はいかがでしたか。'].value_counts().to_dict()
    duration_counts = target_df['説明時間はいかがでしたか。'].value_counts().to_dict()
    category_counts = target_df['受験区分を教えてください'].value_counts().to_dict()

    # ==============================================================
    # ★変更：参加者区分(3つ) × 居住予定(3つ) で 9つのデータフレームに分ける
    # ==============================================================
    col_living = '一人暮らし予定か実家通学予定かお答えください'

    # 1. 参加者区分の条件（「両方」が部分一致しないように排他処理を行う）
    cond_student = target_df['参加者区分'].str.contains('新入生', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_parent = target_df['参加者区分'].str.contains('保護者', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)
    cond_both = target_df['参加者区分'].str.contains('両方', na=False)

    # 2. 居住予定の条件
    cond_alone = target_df[col_living].str.contains('一人暮らし', na=False)
    cond_home = target_df[col_living].str.contains('実家', na=False)
    cond_unsure = target_df[col_living].str.contains('迷っている', na=False)

    # 3. 条件を組み合わせて9通りのデータフレームを作成
    student_alone_df = target_df[cond_student & cond_alone]
    student_home_df  = target_df[cond_student & cond_home]
    student_unsure_df = target_df[cond_student & cond_unsure]

    parent_alone_df = target_df[cond_parent & cond_alone]
    parent_home_df  = target_df[cond_parent & cond_home]
    parent_unsure_df = target_df[cond_parent & cond_unsure]

    both_alone_df = target_df[cond_both & cond_alone]
    both_home_df  = target_df[cond_both & cond_home]
    both_unsure_df = target_df[cond_both & cond_unsure]

    # 4. それぞれの「よかった説明」を集計（全体 + 9通り）
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

    # 順番を固定するためのラベルリスト
    labels = [
        "大学生協のご説明",
        "九工大生の一日（通学編）",
        "九工大生の一日（講義編）",
        "九工大生の一日（昼食編）",
        "九工大生の一日（学外編）",
        "九工大での4年間"
    ]
    
    # 5. 人数（カウント）のデータ化（全体 + 9通り）
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

    # 6. 割合（%）を計算する補助関数
    def calc_pct(data_list, df_subset):
        total = len(df_subset)
        return [round((v / total) * 100, 1) if total > 0 else 0 for v in data_list]

    # 割合のデータ化（全体 + 9通り）
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

    # 抽出したすべてのデータをJSON形式でフロントエンドに返す
    return jsonify({
        "count": total_responses,
        "satisfaction_mean": round(satisfaction_mean, 2),
        "start_time_counts": start_time_counts,
        "duration_counts": duration_counts,
        "category_counts": category_counts,
        
        "explanation_labels": labels,
        "explanation_total": total_data,
        
        # 人数のデータ (9通り)
        "explanation_student_alone": student_alone_data,
        "explanation_student_home": student_home_data,
        "explanation_student_unsure": student_unsure_data,
        "explanation_parent_alone": parent_alone_data,
        "explanation_parent_home": parent_home_data,
        "explanation_parent_unsure": parent_unsure_data,
        "explanation_both_alone": both_alone_data,
        "explanation_both_home": both_home_data,
        "explanation_both_unsure": both_unsure_data,
        
        # 割合のデータ (9通り)
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