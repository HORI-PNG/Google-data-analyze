アンケート結果（CSVデータ）を読み込み、ブラウザ上で視覚的に比較・分析ができるWebダッシュボードアプリケーション

## 実行環境の推奨設定
* OS: Ubuntu を推奨 
* 言語: Python 3

## セットアップと実行手順

**1. リポジトリの取得**
GitHubページの右上にある緑色の「Code」ボタンをクリックし、「Download ZIP」を選択して解凍

**2. ローカルで実行する準備**
python3 -m venv venv
source venv/bin/activate

**3. 必要なパッケージのインストール**
pip install Flask pandas numpy

**4. アプリの実行**
python app.py を実行し、http://127.0.0.1:5000 にアクセス
