data "aws_caller_identity" "current" {}

data "aws_iam_session_context" "current" {
  arn = data.aws_caller_identity.current.arn
}

locals {
  # キー cluster_creator は、以前 enable_cluster_creator_admin_permissions で作ったエントリと同じキー。
  # キーを変えると access entry が作り直しになる
  cluster_admin_principal_arns = merge(
    { cluster_creator = coalesce(var.cluster_admin_principal_arn, data.aws_iam_session_context.current.issuer_arn) },
    var.iacm_role_arn == null ? {} : { iacm = var.iacm_role_arn },
  )
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 20.37"

  cluster_name    = var.project
  cluster_version = var.kubernetes_version

  cluster_endpoint_public_access       = true
  cluster_endpoint_public_access_cidrs = var.cluster_endpoint_public_access_cidrs

  # 実行した IAM プリンシパルを管理者にすると、手元と Harness IaCM で実行者が変わるたびに
  # 管理者が入れ替わるため、管理者は明示的に指定する
  enable_cluster_creator_admin_permissions = false
  access_entries = {
    for key, arn in local.cluster_admin_principal_arns : key => {
      principal_arn = arn
      policy_associations = {
        admin = {
          policy_arn   = "arn:aws:eks::aws:cluster-access-policy/AmazonEKSClusterAdminPolicy"
          access_scope = { type = "cluster" }
        }
      }
    }
  }

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
