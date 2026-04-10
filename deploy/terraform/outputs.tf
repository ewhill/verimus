output "verimus_static_eip" {
  description = "The deterministic IPv4 string resolving the public perimeter"
  value       = aws_eip.node_static_ip[*].public_ip
}

output "verimus_dashboard_url" {
  description = "Physical UI portal bounding HTTPS endpoint dynamically"
  value       = [for ip in aws_eip.node_static_ip : "https://${ip.public_ip}:26780/"]
}

output "s3_bucket_mapped" {
  description = "Elastic isolated payload array"
  value       = aws_s3_bucket.verimus_storage.bucket
}
