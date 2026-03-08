アンケート結果（CSVデータ）を読み込み、ブラウザ上で視覚的に比較・分析ができるWebダッシュボードアプリケーションです。
Python (Flask) と JavaScript (Chart.js) を使用して構築されており、結果のPDFレポート出力機能も備えています。

## 実行環境の推奨設定
* OS: Ubuntu (WSL環境を含む) または macOS を推奨
* 言語: Python 3.x

## セットアップと実行手順

**1. リポジトリの取得**
GitHubページの右上にある緑色の「Code」ボタンをクリックし、「Download ZIP」を選択して解凍するか、以下のコマンドでローカルにクローンを作成します。

**2. ローカルで実行する準備**
python3 -m venv venv
source venv/bin/activate

**3. 必要なパッケージのインストール**
pip install Flask pandas numpy

**4. アプリの実行**
python app.py を実行し、http://127.0.0.1:5000 にアクセス
