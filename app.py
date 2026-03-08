from flask import Flask, render_template, jsonify, request
import pandas as pd
import numpy as np

app = Flask(__name__)

# --- 1. データの読み込みと結合 ---
df1 = pd.read_csv("【対面】2026入学準備説明会アンケート（回答）.csv")
df1['形式'] = '対面'
# ★追加：列名を「参加者区分」に統一
df1 = df1.rename(columns={'新入生ご本人様か保護者の方か教えてください。': '参加者区分'})

df2 = pd.read_csv("【オンライン】2026入学準備説明会アンケート（回答）.csv")
df2['形式'] = 'オンライン'
# ★追加：列名を「参加者区分」に統一
df2 = df2.rename(columns={'本日ご参加された方を教えてください。': '参加者区分'})

df = pd.concat([df1, df2], ignore_index=True)

# --- 2. 日付データの作成 ---
# 「タイムスタンプ」から日付を抽出
df['日付'] = pd.to_datetime(df['タイムスタンプ']).dt.date.astype(str)
df = df.dropna(subset=['タイムスタンプ'])

# プルダウンで選ぶときに「対面かオンラインか」が分かるように、日付の前に形式をくっつける
# 例：「2025-12-14」 → 「対面 : 2025-12-14」
df['日付'] = df['形式'] + " : " + df['日付']

@app.route('/')
def index():
    dates = sorted(df['日付'].unique().tolist())
    return render_template('index.html', dates=dates)

# --- よかった説明を集計する補助関数 ---
def count_explanations(df_subset):
    good_explanations = df_subset['よかった、ためになった説明を教えてください'].fillna('')
    all_explanations = []
    for items in good_explanations:
        if items:
            all_explanations.extend([i.strip() for i in items.split(',')])
    return pd.Series(all_explanations).value_counts().to_dict()

@app.route('/api/data')
def get_data():
    dates_str = request.args.get('dates')
    
    if not dates_str:
        return jsonify({"error": "No dates provided"}), 400

    # カンマ区切りの文字列をリスト（配列）に変換
    date_list = dates_str.split(',')

    # 選ばれた複数の日付（date_list）に含まれるデータをすべて抽出
    target_df = df[df['日付'].isin(date_list)]
    
    if target_df.empty:
        return jsonify({"error": "Data not found"}), 404

    total_responses = len(target_df)
    satisfaction_mean = target_df['本日の説明会の満足度を教えてください'].mean()
    if np.isnan(satisfaction_mean):
        satisfaction_mean = 0

    start_time_counts = target_df['開始時間はいかがでしたか。'].value_counts().to_dict()
    duration_counts = target_df['説明時間はいかがでしたか。'].value_counts().to_dict()

    # 受験区分の集計
    category_counts = target_df['受験区分を教えてください'].value_counts().to_dict()

    # ★変更：参加者区分で3つに分ける（「両方」を含まないように条件を設定）
    student_df = target_df[target_df['参加者区分'].str.contains('新入生', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)]
    parent_df = target_df[target_df['参加者区分'].str.contains('保護者', na=False) & ~target_df['参加者区分'].str.contains('両方', na=False)]
    both_df = target_df[target_df['参加者区分'].str.contains('両方', na=False)]

    total_counts = count_explanations(target_df)
    student_counts = count_explanations(student_df)
    parent_counts = count_explanations(parent_df)
    both_counts = count_explanations(both_df)

    # 順番を固定
    labels = [
        "大学生協のご説明",
        "九工大生の一日（通学編）",
        "九工大生の一日（講義編）",
        "九工大生の一日（昼食編）",
        "九工大生の一日（学外編）",
        "九工大での4年間"
    ]
    
    # 1. 人数（カウント）のデータ
    total_data = [total_counts.get(label, 0) for label in labels]
    student_data = [student_counts.get(label, 0) for label in labels]
    parent_data = [parent_counts.get(label, 0) for label in labels]
    both_data = [both_counts.get(label, 0) for label in labels]

    # 2. 割合（%）のデータ（人数で割って100を掛け、小数第1位で丸める）
    total_people = len(target_df)
    student_people = len(student_df)
    parent_people = len(parent_df)
    both_people = len(both_df)

    total_pct = [round((v / total_people) * 100, 1) if total_people > 0 else 0 for v in total_data]
    student_pct = [round((v / student_people) * 100, 1) if student_people > 0 else 0 for v in student_data]
    parent_pct = [round((v / parent_people) * 100, 1) if parent_people > 0 else 0 for v in parent_data]
    both_pct = [round((v / both_people) * 100, 1) if both_people > 0 else 0 for v in both_data]

    return jsonify({
        "count": total_responses,
        "satisfaction_mean": round(satisfaction_mean, 2),
        "start_time_counts": start_time_counts,
        "duration_counts": duration_counts,
        "category_counts": category_counts,
        
        # 人数のデータ
        "explanation_labels": labels,
        "explanation_total": total_data,
        "explanation_student": student_data,
        "explanation_parent": parent_data,
        "explanation_both": both_data,
        
        # 割合のデータ
        "explanation_total_pct": total_pct,
        "explanation_student_pct": student_pct,
        "explanation_parent_pct": parent_pct,
        "explanation_both_pct": both_pct
    })

if __name__ == '__main__':
    app.run(debug=True)