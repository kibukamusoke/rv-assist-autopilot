output "service_url" {
  value       = try(google_cloud_run_v2_service.autopilot[0].uri, null)
  description = "Cloud Run service URL, or null before an image is configured."
}

output "workflow_topic" {
  value       = google_pubsub_topic.workflow.name
  description = "Pub/Sub workflow event topic."
}

output "response_deadline_queue" {
  value       = try(google_cloud_tasks_queue.response_deadlines[0].id, null)
  description = "Cloud Tasks queue providing durable technician response deadlines."
}

output "artifact_registry_repository" {
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
  description = "Artifact Registry repository used for application images."
}
