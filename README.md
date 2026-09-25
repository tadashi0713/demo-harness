# Atlas Bank — デジタルバンク デモアプリ

TypeScript で書かれたシンプルなデジタルバンクのデモです。フロントエンド（Next.js）と API（Express）を分離し、データベースは PostgreSQL を Docker Compose で起動します。

```
demo-harness/
├── docker-compose.yml   # db / api / web の 3 サービス
├── api/                 # Express + TypeScript + node-postgres
└── web/                 # Next.js 15 (App Router) + TypeScript
```

## 機能

- メールアドレス / パスワードによる新規登録・ログイン（bcrypt + JWT）
- 口座一覧・総資産の表示
- 口座ごとの明細（取引履歴）とサマリー
- 口座番号を指定した振込（受取人の自動照会つき）
- デモ用の入金
- 振込は 1 トランザクション内で両口座を `SELECT ... FOR UPDATE` してから更新するため、残高が壊れない（残高不足時はロールバック）

## 起動

```bash
cp .env.example .env      # 任意（未作成でもデフォルト値で動きます）
docker compose up --build
```

- Web: http://localhost:3000
- API: http://localhost:4000 （ヘルスチェック: `/health`）
- PostgreSQL: `localhost:5432`（user/password/db はすべて `atlasbank`）

初回起動時に API がスキーマを作成し、デモデータを投入します。

### デモアカウント

| メールアドレス       | パスワード    | 口座                                |
| -------------------- | ------------- | ----------------------------------- |
| `hanako@example.com` | `password123` | `1000-0001` 総合口座 / `1000-0002` 貯蓄口座 |
| `taro@example.com`   | `password123` | `2000-0001` 総合口座                |

`hanako` でログインし、振込先に `2000-0001` を入力すると送金を試せます。

### 停止 / データの初期化

```bash
docker compose down        # 停止（データは残る）
docker compose down -v     # ボリュームごと削除してデータを初期化
```

## ローカル開発（Docker を使わない場合）

DB だけ Docker で起動し、API と Web は手元の Node.js（v20 以上）で動かせます。

```bash
docker compose up -d db

# API
cd api && npm install
DATABASE_URL=postgres://atlasbank:atlasbank@localhost:5432/atlasbank JWT_SECRET=dev npm run dev

# Web（別ターミナル）
cd web && npm install
NEXT_PUBLIC_API_URL=http://localhost:4000 npm run dev
```

## API エンドポイント

| メソッド | パス                                   | 説明                                   |
| -------- | -------------------------------------- | -------------------------------------- |
| GET      | `/health`                              | ヘルスチェック                         |
| POST     | `/api/auth/register`                   | 新規登録（総合口座を自動開設）         |
| POST     | `/api/auth/login`                      | ログイン（JWT を返す）                 |
| GET      | `/api/auth/me`                         | ログイン中のユーザー情報               |
| GET      | `/api/accounts`                        | 口座一覧と総資産                       |
| GET      | `/api/accounts/:id`                    | 口座詳細                               |
| GET      | `/api/accounts/:id/transactions`       | 口座の取引履歴（`?limit=`）            |
| POST     | `/api/accounts/:id/deposit`            | デモ入金 `{ amount, description? }`    |
| GET      | `/api/transactions`                    | 全口座の最近の取引（`?limit=`）        |
| GET      | `/api/transfers/payee?accountNumber=`  | 振込先の受取人照会                     |
| POST     | `/api/transfers`                       | 振込 `{ fromAccountId, toAccountNumber, amount, description? }` |

認証が必要なエンドポイントは `Authorization: Bearer <token>` ヘッダーを付けてください。

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"hanako@example.com","password":"password123"}' | jq -r .token)

curl -s http://localhost:4000/api/accounts -H "Authorization: Bearer $TOKEN" | jq
```

## データモデル

| テーブル       | 主なカラム                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `users`        | `id`, `email`, `password_hash`, `full_name`                                |
| `accounts`     | `id`, `user_id`, `account_number`, `name`, `kind`, `currency`, `balance`    |
| `transactions` | `id`, `account_id`, `peer_account_id`, `transfer_id`, `direction`, `kind`, `amount`, `balance_after`, `description` |

金額は最小通貨単位の整数（JPY なら円）で保持し、小数計算による誤差を避けています。スキーマは API 起動時に `api/src/db/migrate.ts` が冪等に適用します。

## 環境変数

| 変数                  | 対象 | デフォルト                      | 説明                                     |
| --------------------- | ---- | ------------------------------- | ---------------------------------------- |
| `DATABASE_URL`        | api  | —                               | PostgreSQL 接続文字列                    |
| `JWT_SECRET`          | api  | `dev-only-secret-change-me`     | JWT の署名鍵（本番では必ず変更）         |
| `JWT_EXPIRES_IN`      | api  | `12h`                           | トークンの有効期限                       |
| `CORS_ORIGIN`         | api  | `http://localhost:3000`         | 許可するオリジン（カンマ区切り）         |
| `SEED_DEMO_DATA`      | api  | `true`                          | 起動時にデモデータを投入するか           |
| `NEXT_PUBLIC_API_URL` | web  | `http://localhost:4000`         | ブラウザから見た API の URL（ビルド時に埋め込み） |

## デモ向けの割り切り

本番運用を想定した実装ではありません。以下は意図的に簡略化しています。

- JWT を localStorage に保存（本番では HttpOnly Cookie を推奨）
- マイグレーション管理ツールを使わず起動時に `CREATE TABLE IF NOT EXISTS` を実行
- 監査ログ、レート制限、二要素認証、通貨換算、複式簿記の勘定科目は未実装
