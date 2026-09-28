variable "region" {
  description = "デプロイ先の AWS リージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "project" {
  description = "リソース名の接頭辞（EKS クラスター名・ECR リポジトリ名・RDS 識別子にも使う）"
  type        = string
  default     = "atlasbank"
}

variable "image_tag" {
  description = "デプロイするコンテナイメージのタグ（ECR に push 済みのもの）"
  type        = string
}

# --- ネットワーク ---

variable "vpc_cidr" {
  description = "VPC の CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "single_nat_gateway" {
  description = "NAT Gateway を 1 つだけ作る（コスト削減）。false なら AZ ごとに作る"
  type        = bool
  default     = true
}

# --- EKS ---

variable "kubernetes_version" {
  description = "EKS の Kubernetes バージョン"
  type        = string
  default     = "1.34"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "EKS API エンドポイントへのアクセスを許可する CIDR"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "node_instance_types" {
  description = "ワーカーノードのインスタンスタイプ（x86_64）"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_min_size" {
  type    = number
  default = 2
}

variable "node_desired_size" {
  type    = number
  default = 2
}

variable "node_max_size" {
  type    = number
  default = 4
}

# --- ECR ---

variable "ecr_force_delete" {
  description = "イメージが残っていても ECR リポジトリを削除できるようにする"
  type        = bool
  default     = false
}

# --- RDS ---

variable "db_engine_version" {
  description = "RDS for PostgreSQL のメジャーバージョン"
  type        = string
  default     = "16"
}

variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage" {
  description = "初期ストレージ (GiB)"
  type        = number
  default     = 20
}

variable "db_max_allocated_storage" {
  description = "ストレージ自動拡張の上限 (GiB)"
  type        = number
  default     = 100
}

variable "db_multi_az" {
  type    = bool
  default = false
}

variable "db_backup_retention_days" {
  type    = number
  default = 7
}

variable "db_deletion_protection" {
  description = "RDS の削除保護。terraform destroy する前に false にして apply する"
  type        = bool
  default     = true
}

variable "db_skip_final_snapshot" {
  description = "削除時に最終スナップショットを取らない"
  type        = bool
  default     = false
}

# --- アプリケーション ---

variable "app_replicas" {
  type    = number
  default = 2
}

variable "seed_demo_data" {
  description = "起動時にデモユーザーを投入する（users テーブルが空のときだけ）"
  type        = bool
  default     = true
}

variable "acm_certificate_arn" {
  description = "指定すると NLB で TLS を終端し 443 で公開する。未指定なら 80 (HTTP) で公開する"
  type        = string
  default     = null
}

variable "app_allowed_cidrs" {
  description = "ロードバランサーへのアクセスを許可する CIDR"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}
