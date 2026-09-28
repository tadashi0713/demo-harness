locals {
  app_labels = {
    "app.kubernetes.io/name" = var.project
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

resource "kubernetes_config_map_v1" "rds_ca" {
  metadata {
    name      = "rds-ca-bundle"
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  data = {
    (local.rds_ca_file) = data.http.rds_ca_bundle.response_body
  }
}

resource "kubernetes_deployment_v1" "app" {
  metadata {
    name      = var.project
    namespace = kubernetes_namespace_v1.app.metadata[0].name
    labels    = local.app_labels
  }

  spec {
    replicas = var.app_replicas

    selector {
      match_labels = local.app_labels
    }

    strategy {
      type = "RollingUpdate"
      rolling_update {
        max_surge       = "1"
        max_unavailable = "0"
      }
    }

    template {
      metadata {
        labels = local.app_labels
        annotations = {
          # Secret を更新したら Pod を入れ替えて環境変数を読み直させる
          "checksum/secret" = sha256(jsonencode(kubernetes_secret_v1.app.data))
        }
      }

      spec {
        security_context {
          run_as_non_root = true
          run_as_user     = 1000
          run_as_group    = 1000
        }

        topology_spread_constraint {
          max_skew           = 1
          topology_key       = "topology.kubernetes.io/zone"
          when_unsatisfiable = "ScheduleAnyway"
          label_selector {
            match_labels = local.app_labels
          }
        }

        container {
          name  = "app"
          image = "${aws_ecr_repository.app.repository_url}:${var.image_tag}"

          port {
            name           = "http"
            container_port = 3000
          }

          env {
            name  = "NODE_ENV"
            value = "production"
          }
          env {
            name  = "SEED_DEMO_DATA"
            value = tostring(var.seed_demo_data)
          }
          env_from {
            secret_ref {
              name = kubernetes_secret_v1.app.metadata[0].name
            }
          }

          volume_mount {
            name       = "rds-ca"
            mount_path = local.rds_ca_dir
            read_only  = true
          }

          resources {
            requests = {
              cpu    = "250m"
              memory = "256Mi"
            }
            limits = {
              memory = "512Mi"
            }
          }

          # 起動時にマイグレーションを流すため、準備完了まで長めに待つ
          startup_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            period_seconds    = 5
            failure_threshold = 36
          }

          # /api/health は DB に問い合わせるので、DB 障害時はトラフィックから外すだけにする
          readiness_probe {
            http_get {
              path = "/api/health"
              port = "http"
            }
            period_seconds    = 10
            timeout_seconds   = 3
            failure_threshold = 3
          }

          liveness_probe {
            tcp_socket {
              port = "http"
            }
            period_seconds    = 20
            failure_threshold = 3
          }

          security_context {
            allow_privilege_escalation = false
            capabilities {
              drop = ["ALL"]
            }
          }
        }

        volume {
          name = "rds-ca"
          config_map {
            name = kubernetes_config_map_v1.rds_ca.metadata[0].name
          }
        }
      }
    }
  }

  depends_on = [aws_vpc_security_group_ingress_rule.db_from_eks_nodes]
}

resource "kubernetes_pod_disruption_budget_v1" "app" {
  metadata {
    name      = var.project
    namespace = kubernetes_namespace_v1.app.metadata[0].name
  }

  spec {
    min_available = 1
    selector {
      match_labels = local.app_labels
    }
  }
}

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
    selector                    = local.app_labels
    load_balancer_source_ranges = var.app_allowed_cidrs

    port {
      name        = local.tls_enabled ? "https" : "http"
      port        = local.service_port
      target_port = "http"
    }
  }
}
