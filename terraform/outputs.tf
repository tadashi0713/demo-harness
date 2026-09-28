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

output "rds_endpoint" {
  value = aws_db_instance.app.address
}
