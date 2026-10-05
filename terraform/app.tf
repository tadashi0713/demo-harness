locals {
  # アプリの Deployment は k8s/ のマニフェストで管理する。Pod のラベルと揃えること
  app_selector = {
    "app.kubernetes.io/name" = "atlasbank"
  }

  rds_ca_dir  = "/etc/rds-ca"
  rds_ca_file = "rds-ca-bundle.pem"

  # pg は sslrootcert のファイルを読み込み、証明書とホスト名を検証する
  database_url = format(
    "postgres://%s:%s@%s:%d/%s?sslmode=verify-full&sslrootcert=%s/%s",
    aws_db_instance.app.username,
    urlencode(random_password.db.result),
    aws_db_instance.app.address,
    aws_db_instance.app.port,
    aws_db_instance.app.db_name,
    local.rds_ca_dir,
    local.rds_ca_file,
  )

  tls_enabled  = var.acm_certificate_arn != null
  service_port = local.tls_enabled ? 443 : 80
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

data "http" "rds_ca_bundle" {
  url = "https://truststore.pki.rds.amazonaws.com/${var.region}/${var.region}-bundle.pem"

  lifecycle {
    postcondition {
      condition     = self.status_code == 200
      error_message = "RDS の CA 証明書バンドルを取得できませんでした"
    }
  }
}

resource "kubernetes_namespace_v1" "app" {
  metadata {
    name = var.project
  }
}

# k8s/base/deployment.yaml が envFrom で読み込む
resource "kubernetes_secret_v1" "app" {
  metadata {
    name      = "${var.project}-env"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  data = {
    DATABASE_URL = local.database_url
    JWT_SECRET   = random_password.jwt_secret.result
  }
}

# k8s/base/deployment.yaml が /etc/rds-ca にマウントする
resource "kubernetes_config_map_v1" "rds_ca" {
  metadata {
    name      = "rds-ca-bundle"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  data = {
    (local.rds_ca_file) = data.http.rds_ca_bundle.response_body
  }
}

# NLB は DNS (CNAME) と ACM 証明書に結び付くため、アプリとは分けて Terraform で管理する
resource "kubernetes_service_v1" "app" {
  metadata {
    name      = var.project
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    annotations = merge(
      {
        "service.beta.kubernetes.io/aws-load-balancer-type"                              = "nlb"
        "service.beta.kubernetes.io/aws-load-balancer-cross-zone-load-balancing-enabled" = "true"
      },
      local.tls_enabled ? {
        "service.beta.kubernetes.io/aws-load-balancer-ssl-cert"  = var.acm_certificate_arn
        "service.beta.kubernetes.io/aws-load-balancer-ssl-ports" = "443"
      } : {},
    )
  }

  spec {
    type                        = "LoadBalancer"
    selector                    = local.app_selector
    load_balancer_source_ranges = var.app_allowed_cidrs

    port {
      name        = local.tls_enabled ? "https" : "http"
      port        = local.service_port
      target_port = "http"
    }
  }
}
