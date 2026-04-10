output "verimus_static_eip" {
  description = "The deterministic IPv4 string resolving the public perimeter"
  value       = aws_eip.node_static_ip[*].public_ip
}

output "verimus_dashboard_url" {
  description = "Physical UI portal bounding HTTPS endpoint dynamically"
  value       = [for i in range(length(aws_eip.node_static_ip)) : "https://n${i}.verimus.io/"]
}

output "s3_bucket_mapped" {
  description = "Elastic isolated payload array"
  value       = aws_s3_bucket.verimus_storage.bucket
}

output "verimus_hosted_zone_nameservers" {
  description = "CRITICAL: The explicit Route53 Name Servers bound strictly to your active Hosted Zone natively securely flawlessly dynamically correctly organically"
  value       = data.aws_route53_zone.verimus.name_servers
}
