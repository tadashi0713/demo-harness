output "app_url" {
  description = "アプリケーションの URL（DNS の反映に数分かかる）"
  value = format(
    "%s://%s",
    local.tls_enabled ? "https" : "http",
    kubernetes_service_v1.app.status[0].load_balancer[0].ingress[0].hostname,
  )
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "configure_kubectl" {
  description = "kubectl を EKS クラスターに接続するコマンド"
  value       = "aws eks update-kubeconfig --region ${var.region} --name ${module.eks.cluster_name}"
}

output "prometheus_url" {
  description = "Harness の Prometheus コネクターに設定する URL（クラスター内のデリゲートから参照する）"
  value       = "http://prometheus-server.${helm_release.prometheus.namespace}.svc.cluster.local"
}

output "rds_endpoint" {
  value = aws_db_instance.app.address
}

output "db_jdbc_url" {
  description = "Harness Database DevOps の JDBC コネクターに設定する URL"
  value = format(
    "jdbc:postgresql://%s:%d/%s?sslmode=require",
    aws_db_instance.app.address,
    aws_db_instance.app.port,
    aws_db_instance.app.db_name,
  )
}

output "db_username" {
  value = aws_db_instance.app.username
}

output "db_password" {
  description = "Harness のシークレットに登録する。terraform output -raw db_password で表示する"
  value       = random_password.db.result
  sensitive   = true
}
