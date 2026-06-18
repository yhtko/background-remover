# 背景削除ツール

GitHub Pages で公開する単機能フロントと、Cloud Run で動かす `rembg` ベースの背景削除 API です。

## 構成

- `index.html` / `styles.css` / `app.js`: GitHub Pages 用の静的フロント
- `config.js`: Cloud Run API URL の初期値
- `api/`: Cloud Run 用 FastAPI アプリ
- `.github/workflows/pages.yml`: GitHub Pages デプロイ

## フロントの公開

このフォルダーを独立リポジトリとして GitHub に push すると、`main` ブランチへの push で GitHub Pages にデプロイされます。

Cloud Run の URL が確定したら `config.js` を更新します。

```js
window.BACKGROUND_REMOVER_CONFIG = {
  apiEndpoint: "https://your-service.run.app/remove-background"
};
```

画面上の API URL 入力欄に入れて保存することもできます。

## Cloud Run API

ローカル確認:

```bash
cd api
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8080
```

Cloud Run へのデプロイ例:

```bash
gcloud run deploy background-remover-api \
  --source ./api \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-env-vars ALLOWED_ORIGINS=https://YOUR_USER.github.io \
  --memory 1Gi \
  --cpu 1 \
  --max-instances 1
```

API エンドポイントは `/remove-background` です。

## 制限

- 入力: PNG / JPG / JPEG
- 最大サイズ: 5MB
- 利用回数: 1分あたり3回
- 出力: 透過 PNG
- アップロード画像は保存しません

## Tools ポータルへの追加

GitHub Pages の URL が決まったら、既存 Tools ポータルにリンクを追加してください。
