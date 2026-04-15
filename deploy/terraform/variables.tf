variable "aws_region" {
  description = "AWS Region defining native deployment targets natively"
  type        = string
  default     = "us-east-1"
}

variable "instance_type" {
  description = "EC2 target performance limit safely bounded"
  type        = string
  default     = "t3.medium"
}

variable "s3_bucket_name" {
  description = "The precise name mapped structurally to your elastic S3 limits (Must be globally unique!)"
  type        = string
}

variable "repo_clone_url" {
  description = "Secure git binding URL seamlessly syncing instance source mapping"
  type        = string
  default     = "https://github.com/ewhill/verimus.git"
}

variable "node_count" {
  description = "Number of Verimus nodes to deploy"
  type        = number
  default     = 5
}

variable "keys_dir" {
  description = <<-EOT
    Path to the directory containing pre-generated node key files (node_0.json ... node_N.json).
    Run 'npm run keygen' from the project root to generate these before deploying.
    Each file holds { node, port, address, mnemonic } for that node index.
    This directory is excluded from git via .gitignore.
  EOT
  type        = string
  default     = "../../keys"
}

variable "certs_bucket_name" {
  description = <<-EOT
    Name of the stable S3 bucket used to cache the wildcard Let's Encrypt TLS certificate.
    This bucket should persist across 'terraform destroy' cycles to avoid hitting Let's Encrypt
    rate limits (50 certs/week per domain). Create it once; do not include it in terraform destroy.
    The seed node (node 0) provisions the cert and writes it here; workers read from it.
  EOT
  type        = string
  default     = "verimus-wildcard-tls-cache"
}

