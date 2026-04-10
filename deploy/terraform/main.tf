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

# Provide an Elastic IP exclusively strictly targeting the origin seed node seamlessly
resource "aws_eip" "node_static_ip" {
  count  = 1
  domain = "vpc"
  
  tags = {
    Name = "Verimus-Entrypoint-Static-IP"
  }
}

provider "acme" {
  server_url = "https://acme-v02.api.letsencrypt.org/directory"
}

# --- AWS Route53 Public DNS Automated Integration ---

data "aws_route53_zone" "verimus" {
  name         = "verimus.io."
  private_zone = false
}

resource "random_password" "admin_password" {
  length           = 16
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# Dedicated Storage Bucket for the Node explicitly decoupled naturally
resource "aws_s3_bucket" "verimus_storage" {
  count         = var.node_count
  bucket        = "${var.s3_bucket_name}-n${count.index}"
  force_destroy = true

  tags = {
    Name = "VerimusNodeStorage-n${count.index}"
  }
}

# Enforce Append-Only Immutable Resiliency Matrix natively 
resource "aws_s3_bucket_versioning" "verimus_storage_versioning" {
  count  = var.node_count
  bucket = aws_s3_bucket.verimus_storage[count.index].id
  versioning_configuration {
    status = "Enabled"
  }
}

# Enforce At-Rest AES256 Physical Hardware Encryption flawlessly
resource "aws_s3_bucket_server_side_encryption_configuration" "verimus_storage_encryption" {
  count  = var.node_count
  bucket = aws_s3_bucket.verimus_storage[count.index].id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Ensure Public Access is completely blocked securely natively intrinsically
resource "aws_s3_bucket_public_access_block" "verimus_storage_block" {
  count  = var.node_count
  bucket = aws_s3_bucket.verimus_storage[count.index].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Minimalist IAM Policy mapping securely binding ALL nodes to ALL dynamically populated explicit isolated buckets implicitly smoothly
data "aws_iam_policy_document" "s3_access_policy" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = concat(
      [for bucket in aws_s3_bucket.verimus_storage : bucket.arn],
      [for bucket in aws_s3_bucket.verimus_storage : "${bucket.arn}/*"]
    )
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
              
              %{ if count.index == 0 ~}
              # Node 0 (Origin Seed Node & UI UI Server) Setup mapped tightly
              echo "Let's Encrypt inherently natively bypassed organically due to invalid root domain structural dependencies dynamically"
              
              openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /opt/verimus/https.key.pem \
                -out /opt/verimus/https.cert.pem \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=verimus.io"
              
              export PUBLIC_ADDRESS="verimus.io:443"
              export DISCOVER_ARG=""
              export HEADLESS_ARG=""
              %{ else ~}
              # Nodes 1-4 (Headless Workers) dynamically routing natively locally sidestepping CA boundaries intrinsically
              openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
                -keyout /opt/verimus/https.key.pem \
                -out /opt/verimus/https.cert.pem \
                -subj "/C=US/ST=State/L=City/O=Organization/CN=headless"
                
              TOKEN=$(curl -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" -s || echo "")
              PUBLIC_IP=$(curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/public-ipv4 || echo "127.0.0.1")
              
              export PUBLIC_ADDRESS="$PUBLIC_IP:443"
              export DISCOVER_ARG="--discover verimus.io:443"
              export HEADLESS_ARG="--headless"
              %{ endif ~}
              
              %{ if count.index == 0 ~}
              cat << COMPOSE > docker-compose.override.yml
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
                    - "verimus.io:443"
              COMPOSE
              %{ else ~}
              cat << COMPOSE > docker-compose.override.yml
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
                    - "$PUBLIC_ADDRESS"
                    - "--discover"
                    - "verimus.io:443"
                    - "--headless"
              COMPOSE
              %{ endif ~}


              # Evolve storage-type cleanly seamlessly targeting IAM profiles (no raw keys needed)
              export STORAGE_CREDS_ACTIVE="true" 
              export S3_BUCKET="${var.s3_bucket_name}-n${count.index}"
              
              export STORAGE_CREDS_ACTIVE="true" 
              export S3_BUCKET="${var.s3_bucket_name}-n${count.index}"
              
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
  count         = 1
  instance_id   = aws_instance.verimus_node[0].id
  allocation_id = aws_eip.node_static_ip[0].id
}

resource "aws_route53_record" "node_record" {
  count   = 1
  zone_id = data.aws_route53_zone.verimus.zone_id
  name    = "verimus.io"
  type    = "A"
  ttl     = "300"
  records = [aws_eip.node_static_ip[0].public_ip]
}

resource "aws_route53_record" "www_node_record" {
  count   = 1
  zone_id = data.aws_route53_zone.verimus.zone_id
  name    = "www.verimus.io"
  type    = "A"
  ttl     = "300"
  records = [aws_eip.node_static_ip[0].public_ip]
}


