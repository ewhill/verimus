output "verimus_static_eip" {
  description = "The deterministic IPv4 string resolving the public perimeter"
  value       = aws_eip.node_static_ip[*].public_ip
}

output "verimus_dashboard_url" {
  description = "Physical UI portal bounding HTTPS endpoint dynamically"
  value       = "https://verimus.io/"
}

output "s3_bucket_mapped" {
  description = "Elastic isolated payload array"
  value       = aws_s3_bucket.verimus_storage[*].bucket
}

output "verimus_hosted_zone_nameservers" {
  description = "CRITICAL: The explicit Route53 Name Servers bound strictly to your active Hosted Zone natively securely flawlessly dynamically correctly organically"
  value       = data.aws_route53_zone.verimus.name_servers
}

output "verimus_ui_admin_password" {
  description = "The dynamic randomized UI strictly mapped admin password natively."
  value       = random_password.admin_password.result
  sensitive   = true
}

output "node_wallet_identities" {
  description = <<-EOT
    EVM wallet addresses for each deployed node, derived from the pre-generated key files in keys/.
    Mnemonics are stored only in keys/node_N.json on your local filesystem (git-ignored).
    Retrieve with: terraform output -json node_wallet_identities
  EOT
  value = [
    for i in range(var.node_count) : {
      node    = i
      address = local.node_keys[i].address
    }
  ]
}
