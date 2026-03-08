from flask import Flask, render_template, jsonify
import pandas as pd
import numpy as np

app = Flask(__name__)

# CSVデータの読み込み
df = pd.read_csv("【対面】2026入学準備説明会アンケート（回答）.csv")

# 「タイムスタンプ」から日付を抽出
df['日付'] = pd.to_datetime(df['タイムスタンプ']).dt.date.astype(str)
df = df.dropna(subset=['タイムスタンプ'])

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

@app.route('/api/data/<date_str>')
def get_data(date_str):
    target_df = df[df['日付'] == date_str]
    
    if target_df.empty:
        return jsonify({"error": "Data not found"}), 404

    total_responses = len(target_df)
    satisfaction_mean = target_df['本日の説明会の満足度を教えてください'].mean()
    if np.isnan(satisfaction_mean):
        satisfaction_mean = 0

    start_time_counts = target_df['開始時間はいかがでしたか。'].value_counts().to_dict()
    duration_counts = target_df['説明時間はいかがでしたか。'].value_counts().to_dict()

    # ★ここを復活！ 受験区分の集計
    category_counts = target_df['受験区分を教えてください'].value_counts().to_dict()

    student_df = target_df[target_df['新入生ご本人様か保護者の方か教えてください。'].str.contains('新入生', na=False)]
    parent_df = target_df[target_df['新入生ご本人様か保護者の方か教えてください。'].str.contains('保護者', na=False)]

    total_counts = count_explanations(target_df)
    student_counts = count_explanations(student_df)
    parent_counts = count_explanations(parent_df)

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

    # len() を使って、その日に参加した全体・新入生・保護者の実際の人数を取得
    total_people = len(target_df)
    student_people = len(student_df)
    parent_people = len(parent_df)

    # ★変更：各項目の選ばれた回数を、上記の「人数」で割って100を掛ける
    total_pct = [round((v / total_people) * 100, 1) if total_people > 0 else 0 for v in total_data]
    student_pct = [round((v / student_people) * 100, 1) if student_people > 0 else 0 for v in student_data]
    parent_pct = [round((v / parent_people) * 100, 1) if parent_people > 0 else 0 for v in parent_data]
    
    return jsonify({
        "date_str": date_str,
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
        
        # ★追加：割合のデータ
        "explanation_total_pct": total_pct,
        "explanation_student_pct": student_pct,
        "explanation_parent_pct": parent_pct
    })

if __name__ == '__main__':
    app.run(debug=True)