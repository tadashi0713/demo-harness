module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  cluster_name    = var.project
  cluster_version = var.kubernetes_version

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # terraform を実行した IAM プリンシパルにクラスター管理者権限を付与する
  enable_cluster_creator_admin_permissions = true

  cluster_enabled_log_types   = var.cluster_enabled_log_types
  create_cloudwatch_log_group = length(var.cluster_enabled_log_types) > 0

  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets

  cluster_addons = {
    coredns    = {}
    kube-proxy = {}
    vpc-cni = {
      before_compute = true
    }
  }

  eks_managed_node_groups = {
    default = {
      ami_type       = var.node_ami_type
      instance_types = var.node_instance_types
      capacity_type  = var.node_capacity_type
      subnet_ids     = var.enable_nat_gateway ? module.vpc.private_subnets : module.vpc.public_subnets

      min_size     = var.node_min_size
      desired_size = var.node_desired_size
      max_size     = var.node_max_size
    }
  }
}
