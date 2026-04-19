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
    time = {
      source  = "hashicorp/time"
      version = "~> 0.11"
    }
  }
}

# Anchor Genesis logically consistently without shifting automatically on future apply passes
resource "time_static" "genesis" {}

provider "aws" {
  region = var.aws_region
}

# Derive storage bucket names from the AWS account ID so they are globally unique
# without requiring a manually-managed timestamp suffix.
data "aws_caller_identity" "current" {}

# Read pre-generated node key files produced by 'npm run keygen'.
# Each keys/node_N.json holds { node, port, address, mnemonic }.
locals {
  node_keys = [
    for i in range(var.node_count) : jsondecode(file("${path.root}/${var.keys_dir}/node_${i}.json"))
  ]

  # Stable, globally-unique S3 prefix: <base>-<account_id>-n<index>
  storage_bucket_prefix = "${var.s3_bucket_name}-${data.aws_caller_identity.current.account_id}"
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
  length           = 20
  special          = true
  override_special = "-"
}

# Dedicated Storage Bucket for the Node explicitly decoupled naturally
resource "aws_s3_bucket" "verimus_storage" {
  count         = var.node_count
  bucket        = "${local.storage_bucket_prefix}-n${count.index}"
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

# Ensure Public Access is completely blocked securely
resource "aws_s3_bucket_public_access_block" "verimus_storage_block" {
  count  = var.node_count
  bucket = aws_s3_bucket.verimus_storage[count.index].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Wildcard TLS cert cache — persists across terraform destroy cycles to avoid Let's Encrypt rate limits.
# Hardened to match the storage bucket security posture: private, encrypted, versioned.
resource "aws_s3_bucket" "verimus_certs" {
  bucket        = var.certs_bucket_name
  force_destroy = false

  tags = {
    Name = "VerimusCertCache"
  }
}

resource "aws_s3_bucket_versioning" "verimus_certs_versioning" {
  bucket = aws_s3_bucket.verimus_certs.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "verimus_certs_encryption" {
  bucket = aws_s3_bucket.verimus_certs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_public_access_block" "verimus_certs_block" {
  bucket = aws_s3_bucket.verimus_certs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM policy — storage buckets, wildcard TLS cert S3 cache, and Route53 DNS-01 for certbot
data "aws_iam_policy_document" "s3_access_policy" {
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"]
    resources = concat(
      [for bucket in aws_s3_bucket.verimus_storage : bucket.arn],
      [for bucket in aws_s3_bucket.verimus_storage : "${bucket.arn}/*"]
    )
  }

  # Certs bucket — seed writes the wildcard cert; workers read it. No CreateBucket needed (Terraform manages it).
  statement {
    actions   = ["s3:PutObject", "s3:GetObject", "s3:ListBucket"]
    resources = [
      aws_s3_bucket.verimus_certs.arn,
      "${aws_s3_bucket.verimus_certs.arn}/*"
    ]
  }

  # Route53 DNS-01 challenge — scoped to the minimum required resources.
  # ChangeResourceRecordSets and ListResourceRecordSets are zone-scoped.
  statement {
    actions = [
      "route53:ChangeResourceRecordSets",
      "route53:ListResourceRecordSets"
    ]
    resources = ["arn:aws:route53:::hostedzone/${data.aws_route53_zone.verimus.zone_id}"]
  }

  # GetChange is change-set scoped; ListHostedZones has no resource-level support.
  statement {
    actions   = ["route53:GetChange", "route53:ListHostedZones"]
    resources = ["*"]
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

resource "aws_iam_role_policy_attachment" "node_ssm_attach" {
  role       = aws_iam_role.node_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
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
              # Force Build Ref: Client Memory Fix 7
              apt-get update -y
              apt-get install -y docker.io docker-compose git python3-pip unzip
              systemctl enable docker
              systemctl start docker
              
              curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
              unzip -q awscliv2.zip
              ./aws/install
              
              cd /opt
              git clone https://github.com/ewhill/verimus.git
              cd verimus
              
              %{ if count.index == 0 ~}
              # Seed node: provision *.verimus.io wildcard cert via certbot DNS-01 + Route53.
              # Caches cert to S3 so subsequent redeploys skip Let's Encrypt entirely.
              #
              # Use pip3 to install certbot — the Ubuntu 22.04 apt packages (certbot 1.21 +
              # python3-certbot-dns-route53 1.3) are version-mismatched. pip3 always resolves
              # the latest compatible plugin alongside certbot.
              pip3 install --quiet certbot certbot-dns-route53

              mkdir -p /opt/verimus
              CERT_VALID=false
              if aws s3 ls s3://${var.certs_bucket_name}/certs/fullchain.pem > /dev/null 2>&1; then
                aws s3 cp s3://${var.certs_bucket_name}/certs/fullchain.pem /opt/verimus/https.cert.pem
                aws s3 cp s3://${var.certs_bucket_name}/certs/privkey.pem /opt/verimus/https.key.pem
                if openssl x509 -checkend 2592000 -noout -in /opt/verimus/https.cert.pem 2>/dev/null; then
                  echo "[*] Reusing cached wildcard cert (>30 days remaining). Skipping Let's Encrypt."
                  CERT_VALID=true
                else
                  echo "[!] Cached cert expiring within 30 days — requesting renewal."
                fi
              fi
              if [ "$CERT_VALID" = "false" ]; then
                certbot certonly \
                  --dns-route53 \
                  -d verimus.io \
                  -d "*.verimus.io" \
                  --non-interactive \
                  --agree-tos \
                  --email admin@verimus.io || {
                    echo "[ERROR] certbot provisioning failed. Letsencrypt log:"
                    cat /var/log/letsencrypt/letsencrypt.log 2>/dev/null || true
                    exit 1
                  }
                cp /etc/letsencrypt/live/verimus.io/fullchain.pem /opt/verimus/https.cert.pem
                cp /etc/letsencrypt/live/verimus.io/privkey.pem /opt/verimus/https.key.pem
                aws s3 cp /opt/verimus/https.cert.pem s3://${var.certs_bucket_name}/certs/fullchain.pem
                aws s3 cp /opt/verimus/https.key.pem s3://${var.certs_bucket_name}/certs/privkey.pem
                echo "[*] Wildcard cert provisioned and cached to S3."
              fi

              export DISCOVER_ARG=""
              export HEADLESS_ARG=""
              %{ else ~}
              # Worker nodes: download the shared wildcard cert from S3 (written by seed node).
              mkdir -p /opt/verimus
              MAX_CERT_RETRIES=40
              for attempt in $(seq 1 $MAX_CERT_RETRIES); do
                if aws s3 ls s3://${var.certs_bucket_name}/certs/fullchain.pem > /dev/null 2>&1; then
                  aws s3 cp s3://${var.certs_bucket_name}/certs/fullchain.pem /opt/verimus/https.cert.pem
                  aws s3 cp s3://${var.certs_bucket_name}/certs/privkey.pem /opt/verimus/https.key.pem
                  echo "[*] Wildcard cert downloaded from S3 (attempt $attempt)."
                  break
                fi
                echo "[...] Cert not yet in S3 (attempt $attempt/$MAX_CERT_RETRIES). Retrying in 15s..."
                sleep 15
              done

              if [ ! -f "/opt/verimus/https.cert.pem" ]; then
                echo "[ERROR] Failed to download wildcard cert from S3 after $MAX_CERT_RETRIES attempts. Aborting."
                exit 1
              fi

              export DISCOVER_ARG="--discover verimus.io:443"
              export HEADLESS_ARG="--headless"
              %{ endif ~}
              
              %{ if count.index == 0 ~}
              cat << 'COMPOSE' > docker-compose.override.yml
              version: '3.8'
              services:
                verimus-node:
                  environment:
                    - "UI_PASSWORD=${random_password.admin_password.result}"
                    - "EVM_WALLET_MNEMONIC=${local.node_keys[count.index].mnemonic}"
                    - "S3_BUCKET=${local.storage_bucket_prefix}-n${count.index}"
                    - "S3_REGION=${var.aws_region}"
                    - "STORAGE_CREDS_ACTIVE=true"
                    - "VERIMUS_GENESIS_TIMESTAMP=${time_static.genesis.unix}000"
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
                    - "--storage-type"
                    - "s3"
              COMPOSE
              %{ else ~}
              cat << 'COMPOSE' > docker-compose.override.yml
              version: '3.8'
              services:
                verimus-node:
                  environment:
                    - "UI_PASSWORD=${random_password.admin_password.result}"
                    - "EVM_WALLET_MNEMONIC=${local.node_keys[count.index].mnemonic}"
                    - "S3_BUCKET=${local.storage_bucket_prefix}-n${count.index}"
                    - "S3_REGION=${var.aws_region}"
                    - "STORAGE_CREDS_ACTIVE=true"
                    - "VERIMUS_GENESIS_TIMESTAMP=${time_static.genesis.unix}000"
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
                    - "verimus.io:443"
                    - "--headless"
                    - "--storage-type"
                    - "s3"
              COMPOSE
              %{ endif ~}


              # Deduplicate storage export
              export STORAGE_CREDS_ACTIVE="true"
              export S3_BUCKET="${local.storage_bucket_prefix}-n${count.index}"

              %{ if count.index > 0 ~}
              # Worker nodes wait for the seed node to be fully reachable before joining.
              # This breaks the race condition between EC2 boot time and network convergence.
              echo "[*] Waiting for seed node verimus.io:443 to become reachable..."
              MAX_RETRIES=40
              for attempt in $(seq 1 $MAX_RETRIES); do
                STATUS=$(curl -sk --max-time 10 -o /dev/null -w "%%{http_code}" "https://verimus.io/health" 2>/dev/null || echo "000")
                if [ "$STATUS" = "200" ]; then
                  echo "[✓] Seed node is healthy (attempt $attempt). Proceeding..."
                  break
                fi
                echo "[...] Attempt $attempt/$MAX_RETRIES — seed returned HTTP $STATUS. Retrying in 30s..."
                sleep 30
              done
              %{ endif ~}

              # Setup OS-level Jittered CRON Updater
              cat << 'UPDATESCRIPT' > /opt/verimus/auto_update.sh
              #!/bin/bash
              # Jitter linearly safely mapped to 0-1800 seconds (30 minute maximum random offset delays)
              sleep $((RANDOM % 1800))
              cd /opt/verimus || exit
              echo "[$(date)] Executing structural OS-Level OTA Update natively..."
              git pull origin main
              docker-compose up --build -d
              docker image prune -a -f
              docker builder prune -a -f
              echo "[$(date)] Update bounds seamlessly recompiled!"
              UPDATESCRIPT

              chmod +x /opt/verimus/auto_update.sh
              echo "0 * * * * root /opt/verimus/auto_update.sh >> /var/log/verimus_auto_update.log 2>&1" > /etc/cron.d/verimus_update

              docker-compose up --build -d
              EOF

  # Obliterate SSRF Attack Vectors enforcing IMDSv2 uniquely
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"   # Strict IMDSv2
    http_put_response_hop_limit = 2            # Allows Docker containers (1 hop) to pull instance credentials securely natively
    instance_metadata_tags      = "enabled"
  }

  # Enforce EBS Encryption preventing physical host drive scraping and scale gracefully
  root_block_device {
    encrypted   = true
    volume_size = 30
  }

  tags = {
    Name = "Verimus-Node-${count.index}"
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

# node0.verimus.io — seed node, pinned to the Elastic IP for DNS stability
resource "aws_route53_record" "node0_record" {
  zone_id = data.aws_route53_zone.verimus.zone_id
  name    = "node0.verimus.io"
  type    = "A"
  ttl     = "300"
  records = [aws_eip.node_static_ip[0].public_ip]
}

# node1.verimus.io ... nodeN.verimus.io — headless worker subdomains
# All are covered by the *.verimus.io wildcard cert provisioned by node 0
resource "aws_route53_record" "worker_node_record" {
  count   = var.node_count - 1
  zone_id = data.aws_route53_zone.verimus.zone_id
  name    = "node${count.index + 1}.verimus.io"
  type    = "A"
  ttl     = "300"
  records = [aws_instance.verimus_node[count.index + 1].public_ip]
}
