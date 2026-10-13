# Harness の AI Verify が canary の健全性を判定するためのメトリクス基盤。
# アプリの Pod は k8s/base/deployment.yaml の prometheus.io/* アノテーションで収集対象になる
resource "helm_release" "prometheus" {
  name             = "prometheus"
  repository       = "https://prometheus-community.github.io/helm-charts"
  chart            = "prometheus"
  version          = "29.36.1"
  namespace        = "monitoring"
  create_namespace = true

  values = [yamlencode({
    server = {
      # 既定の 1m だと rate(...[1m]) にサンプルが 2 点そろわず、AI Verify の分析粒度にも粗すぎる
      global = {
        scrape_interval = "15s"
      }
      # クラスターに EBS CSI ドライバーが無いため PVC は使えない。Pod 再作成でメトリクスは消える
      persistentVolume = { enabled = false }
      retention        = "3d"
      resources = {
        requests = { cpu = "100m", memory = "512Mi" }
        limits   = { memory = "1Gi" }
      }
    }
    alertmanager             = { enabled = false }
    prometheus-pushgateway   = { enabled = false }
    prometheus-node-exporter = { enabled = false }
    kube-state-metrics       = { enabled = true }
  })]
}
