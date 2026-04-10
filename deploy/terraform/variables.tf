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
