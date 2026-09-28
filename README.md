# Atlas Bank — デジタルバンク デモアプリ

TypeScript で書かれたシンプルなデジタルバンクのデモです。画面と API を 1 つの Next.js アプリにまとめ、データベースは PostgreSQL を Docker Compose で起動します。

```
demo-harness/                 # Next.js 15 (App Router) + TypeScript
├── docker-compose.yml        # db / app の 2 サービス
├── Dockerfile
├── terraform/                # AWS (EKS / ECR / RDS) へのデプロイ
└── src/
    ├── app/                  # 画面
    ├── app/api/              # API（Route Handlers）
    ├── server/               # DB 接続・認証・業務ロジック（サーバー専用）
    ├── instrumentation.ts    # 起動時のスキーマ適用・デモデータ投入
    └── lib/                  # ブラウザ側の API クライアントと共有型
```

## 機能

- メールアドレス / パスワードによるログイン（bcrypt + JWT）
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

- アプリ: http://localhost:3000 （API は同じオリジンの `/api/*`、ヘルスチェック: `/api/health`）
- PostgreSQL: `localhost:5432`（user/password/db はすべて `atlasbank`）

初回起動時にアプリがスキーマを作成し、デモデータを投入します。

### デモアカウント

| メールアドレス       | パスワード    | 口座                                |
| -------------------- | ------------- | ----------------------------------- |
| `tadashi.nemoto@harness.io`（根本 征） | `password123` | `1000-0001` 総合口座 / `1000-0002` 貯蓄口座 |

ログイン後、総合口座から振込先に `1000-0002`（貯蓄口座）を入力すると送金を試せます。

### 停止 / データの初期化

```bash
docker compose down        # 停止（データは残る）
docker compose down -v     # ボリュームごと削除してデータを初期化
```

## ローカル開発（Docker を使わない場合）

DB だけ Docker で起動し、アプリは手元の Node.js（v20 以上）で動かせます。

```bash
docker compose up -d db

yarn install
DATABASE_URL=postgres://atlasbank:atlasbank@localhost:5432/atlasbank JWT_SECRET=dev yarn dev
```

## テスト

ユニットテストは [Vitest](https://vitest.dev/) で書いています。DB はモックしているため、PostgreSQL を起動せずに実行できます。

```bash
yarn test             # 1 回実行
yarn test:watch       # ウォッチモード
```

テストファイルは対象のソースと同じディレクトリに `*.test.ts` として置いています。

## AWS へのデプロイ（Terraform）

`terraform/` に、以下を 1 回の `terraform apply` で作るコードがあります。

- VPC（3 AZ。パブリック / プライベート / DB 用サブネット、NAT Gateway）
- Amazon EKS クラスターとマネージドノードグループ（AL2023, x86_64）
- Amazon ECR リポジトリ（タグ上書き禁止、push 時にスキャン）
- Amazon RDS for PostgreSQL 16（プライベートサブネット、EKS ノードからのみ接続可、SSL 接続で証明書を検証）
- アプリの Kubernetes リソース（Deployment、NLB 経由で公開する Service、PodDisruptionBudget、DB 接続情報と JWT 署名鍵の Secret）

必要なもの: Terraform 1.5 以上、AWS CLI（認証済み）、Docker

```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # 任意
terraform init

# 1. ECR リポジトリだけ先に作る
TAG=$(git rev-parse --short HEAD)
terraform apply -target=aws_ecr_repository.app -var image_tag=$TAG

# 2. イメージをビルドして push する（ノードは x86_64 なので Apple Silicon でも amd64 でビルドする）
ECR=$(terraform output -raw ecr_repository_url)
aws ecr get-login-password --region ap-northeast-1 | docker login --username AWS --password-stdin ${ECR%%/*}
docker build --platform linux/amd64 -t $ECR:$TAG ..
docker push $ECR:$TAG

# 3. 残りをすべて作成してアプリをデプロイする（初回は 20 分ほどかかる）
terraform apply -var image_tag=$TAG
terraform output app_url
```

2 回目以降のデプロイは、新しいタグでイメージを push してから手順 3 を実行します。kubectl を使う場合は `terraform output -raw configure_kubectl` のコマンドを実行してください。

- `acm_certificate_arn` を指定しない場合、アプリは HTTP (80) で公開されます。ログイン情報や JWT が平文で流れるため、検証以外では ACM 証明書を指定して HTTPS にしてください。
- state には DB パスワードと JWT 署名鍵が含まれます。チームで使う場合は `versions.tf` のコメントを参考に、暗号化した S3 バックエンドに保存してください。
- RDS は削除保護が有効です。`terraform destroy` の前に `db_deletion_protection = false` などを設定して apply してください（`terraform.tfvars.example` 参照）。

## API エンドポイント

| メソッド | パス                                   | 説明                                   |
| -------- | -------------------------------------- | -------------------------------------- |
| GET      | `/api/health`                          | ヘルスチェック                         |
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
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"tadashi.nemoto@harness.io","password":"password123"}' | jq -r .token)

curl -s http://localhost:3000/api/accounts -H "Authorization: Bearer $TOKEN" | jq
```

## データモデル

| テーブル       | 主なカラム                                                                 |
| -------------- | -------------------------------------------------------------------------- |
| `users`        | `id`, `email`, `password_hash`, `full_name`                                |
| `accounts`     | `id`, `user_id`, `account_number`, `name`, `kind`, `currency`, `balance`    |
| `transactions` | `id`, `account_id`, `peer_account_id`, `transfer_id`, `direction`, `kind`, `amount`, `balance_after`, `description` |

金額は最小通貨単位の整数（JPY なら円）で保持し、小数計算による誤差を避けています。スキーマはアプリ起動時に `src/server/db/migrate.ts` が冪等に適用します。

## 環境変数

| 変数             | デフォルト                                              | 説明                             |
| ---------------- | ------------------------------------------------------- | -------------------------------- |
| `DATABASE_URL`   | `postgres://atlasbank:atlasbank@localhost:5432/atlasbank` | PostgreSQL 接続文字列            |
| `JWT_SECRET`     | `dev-only-secret-change-me`                             | JWT の署名鍵（本番では必ず変更） |
| `JWT_EXPIRES_IN` | `12h`                                                   | トークンの有効期限               |
| `SEED_DEMO_DATA` | `true`                                                  | 起動時にデモデータを投入するか   |

## デモ向けの割り切り

本番運用を想定した実装ではありません。以下は意図的に簡略化しています。

- JWT を localStorage に保存（本番では HttpOnly Cookie を推奨）
- マイグレーション管理ツールを使わず起動時に `CREATE TABLE IF NOT EXISTS` を実行
- 監査ログ、レート制限、二要素認証、通貨換算、複式簿記の勘定科目は未実装
