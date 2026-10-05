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

# --- ネットワーク ---

variable "vpc_cidr" {
  description = "VPC の CIDR"
  type        = string
  default     = "10.0.0.0/16"
}

variable "az_count" {
  description = "使用する AZ の数（EKS と RDS の要件で 2 以上）"
  type        = number
  default     = 2

  validation {
    condition     = var.az_count >= 2
    error_message = "az_count は 2 以上にしてください"
  }
}

variable "enable_nat_gateway" {
  description = "true ならノードをプライベートサブネットに置き NAT Gateway 経由で外に出す。false ならノードをパブリックサブネットに置き NAT Gateway を作らない"
  type        = bool
  default     = false
}

variable "single_nat_gateway" {
  description = "enable_nat_gateway = true のとき、NAT Gateway を 1 つだけ作る。false なら AZ ごとに作る"
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

variable "cluster_enabled_log_types" {
  description = "CloudWatch Logs に送るコントロールプレーンのログ（例: [\"audit\", \"api\", \"authenticator\"]）"
  type        = list(string)
  default     = []
}

variable "node_ami_type" {
  description = "ワーカーノードの AMI。node_instance_types と CPU アーキテクチャを揃え、イメージも同じアーキテクチャでビルドする"
  type        = string
  default     = "AL2023_ARM_64_STANDARD"
}

variable "node_instance_types" {
  description = "ワーカーノードのインスタンスタイプ。スポットの場合は複数指定すると確保しやすい"
  type        = list(string)
  default     = ["t4g.medium", "t4g.large", "c6g.large", "c7g.large"]
}

variable "node_capacity_type" {
  description = "ON_DEMAND または SPOT"
  type        = string
  default     = "SPOT"

  validation {
    condition     = contains(["ON_DEMAND", "SPOT"], var.node_capacity_type)
    error_message = "node_capacity_type は ON_DEMAND か SPOT を指定してください"
  }
}

variable "node_min_size" {
  type    = number
  default = 1
}

variable "node_desired_size" {
  type    = number
  default = 1
}

variable "node_max_size" {
  type    = number
  default = 3
}

# --- ECR ---

variable "ecr_force_delete" {
  description = "イメージが残っていても ECR リポジトリを削除できるようにする"
  type        = bool
  default     = true
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
  default = 1
}

variable "db_deletion_protection" {
  description = "RDS の削除保護。有効にした場合は terraform destroy の前に false にして apply する"
  type        = bool
  default     = false
}

variable "db_skip_final_snapshot" {
  description = "削除時に最終スナップショットを取らない"
  type        = bool
  default     = true
}

# --- アプリケーションの公開（Deployment は k8s/ で管理） ---

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
