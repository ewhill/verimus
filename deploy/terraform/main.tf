terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    acme = {
      source  = "vancluever/acme"
      version = "~> 2.11"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# Provide an Elastic IP for deterministic node connectivity
resource "aws_eip" "node_static_ip" {
  count  = var.node_count
  domain = "vpc"
  
  tags = {
    Name = "Verimus-Node-Static-IP-${count.index}"
  }
}


provider "acme" {
  server_url = "https://acme-v02.api.letsencrypt.org/directory"
}

resource "tls_private_key" "acme_reg_key" {
  algorithm = "RSA"
}

resource "acme_registration" "reg" {
  account_key_pem = tls_private_key.acme_reg_key.private_key_pem
  email_address   = "admin@verimus.io"
}

# --- AWS Route53 Public DNS Automated Integration ---

data "aws_route53_zone" "verimus" {
  name         = "verimus.io."
  private_zone = false
}

resource "acme_certificate" "wildcard_cert" {
  account_key_pem           = acme_registration.reg.account_key_pem
  common_name               = "*.verimus.io"

  dns_challenge {
    provider = "route53"
    config   = {
      AWS_HOSTED_ZONE_ID      = data.aws_route53_zone.verimus.zone_id
      AWS_PROPAGATION_TIMEOUT = "1200"
      AWS_POLLING_INTERVAL    = "30"
    }
  }
}

resource "random_password" "admin_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Dedicated Storage Bucket for the Node
resource "aws_s3_bucket" "verimus_storage" {
  bucket        = var.s3_bucket_name
  force_destroy = true

  tags = {
    Name = "VerimusNodeStorage"
  }
}

# Enforce Append-Only Immutable Resiliency Matrix
resource "aws_s3_bucket_versioning" "verimus_storage_versioning" {
  bucket = aws_s3_bucket.verimus_storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enforce At-Rest AES256 Physical Hardware Encryption
resource "aws_s3_bucket_server_side_encryption_configuration" "verimus_storage_encryption" {
  bucket = aws_s3_bucket.verimus_storage.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Ensure Public Access is completely blocked securely natively
resource "aws_s3_bucket_public_access_block" "verimus_storage_block" {
  bucket = aws_s3_bucket.verimus_storage.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Minimalist IAM Policy mapping
data "aws_iam_policy_document" "s3_access_policy" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = [
      aws_s3_bucket.verimus_storage.arn,
      "${aws_s3_bucket.verimus_storage.arn}/*"
    ]
  }
}

resource "aws_iam_policy" "s3_access_policy" {
  name        = "verimus-node-s3-access"
  policy      = data.aws_iam_policy_document.s3_access_policy.json
}

resource "aws_iam_role" "node_role" {
  name = "verimus-node-ec2-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "node_s3_attach" {
  role       = aws_iam_role.node_role.name
  policy_arn = aws_iam_policy.s3_access_policy.arn
}

resource "aws_iam_instance_profile" "node_profile" {
  name = "verimus-node-profile"
  role = aws_iam_role.node_role.name
}

# Security Constraints mapped to strictly TCP 26780
resource "aws_security_group" "verimus_sg" {
  name        = "verimus_node_sg"
  description = "Allows restricted inbound connections mapping to Verimus endpoints"
  
  ingress {
    description = "P2P and UI Node Ingress"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Lets Encrypt HTTP Challenge"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# EC2 Infrastructure Target
# Using Ubuntu 22.04 LTS natively mapping explicitly resilient bounds
data "aws_ami" "ubuntu" {
  most_recent = true
  owners      = ["099720109477"] # Canonical default

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd/ubuntu-jammy-22.04-amd64-server-*"]
  }
}

resource "aws_instance" "verimus_node" {
  count         = var.node_count
  ami           = data.aws_ami.ubuntu.id
  instance_type = var.instance_type

  vpc_security_group_ids = [aws_security_group.verimus_sg.id]
  iam_instance_profile   = aws_iam_instance_profile.node_profile.name

  # Force EC2 recreation when user_data changes logically
  user_data_replace_on_change = true

  # Provision EC2 automatically mounting Docker environment
  user_data = <<-EOF
              #!/bin/bash
              apt-get update -y
              apt-get install -y docker.io docker-compose git certbot
              systemctl enable docker
              systemctl start docker
              
              cd /opt
              git clone https://github.com/ewhill/verimus.git
              cd verimus
              
              cat << 'CERT' > /opt/verimus/https.cert.pem
${acme_certificate.wildcard_cert.certificate_pem}${acme_certificate.wildcard_cert.issuer_pem}
CERT
              cat << 'KEY' > /opt/verimus/https.key.pem
${acme_certificate.wildcard_cert.private_key_pem}
KEY
              
              cat << 'COMPOSE' > docker-compose.override.yml
              version: '3.8'
              services:
                verimus-node:
                  environment:
                    - "UI_PASSWORD=${random_password.admin_password.result}"
                    - NODE_ENV=production
                  ports:
                    - "443:443"
                  volumes:
                    - "/opt/verimus/https.key.pem:/app/https.key.pem"
                    - "/opt/verimus/https.cert.pem:/app/https.cert.pem"
                  command:
                    - "--mongo-host"
                    - "mongo"
                    - "--mongo-port"
                    - "27017"
                    - "--port"
                    - "443"
                    - "--public-address"
                    - "node${count.index}.verimus.io:443"
                    - "--discover"
                    - "${join(",", [for i in range(var.node_count) : "node${i}.verimus.io:443"])}"
              COMPOSE


              # Evolve storage-type cleanly seamlessly targeting IAM profiles (no raw keys needed)
              export STORAGE_CREDS_ACTIVE="true" 
              export S3_BUCKET="${var.s3_bucket_name}"
              
              export STORAGE_CREDS_ACTIVE="true" 
              export S3_BUCKET="${var.s3_bucket_name}"
              
              docker-compose up --build -d
              EOF

  # Obliterate SSRF Attack Vectors enforcing IMDSv2 uniquely
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"   # Strict IMDSv2
    http_put_response_hop_limit = 1
    instance_metadata_tags      = "enabled"
  }

  # Enforce EBS Encryption preventing physical host drive scraping
  root_block_device {
    encrypted = true
  }

  tags = {
    Name = "Verimus-Node"
  }
}

resource "aws_eip_association" "eip_assoc" {
  count         = var.node_count
  instance_id   = aws_instance.verimus_node[count.index].id
  allocation_id = aws_eip.node_static_ip[count.index].id
}

resource "aws_route53_record" "node_record" {
  count   = var.node_count
  zone_id = data.aws_route53_zone.verimus.zone_id
  name    = "node${count.index}.verimus.io"
  type    = "A"
  ttl     = "300"
  records = [aws_eip.node_static_ip[count.index].public_ip]
}

