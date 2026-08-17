locals {
  service_name   = "rv-assist-autopilot"
  deploy_service = var.image != null
  required_apis = toset([
    "aiplatform.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudtasks.googleapis.com",
    "firestore.googleapis.com",
    "pubsub.googleapis.com",
    "run.googleapis.com",
  ])
}

data "google_project" "current" {
  project_id = var.project_id
}

resource "google_project_service" "required" {
  for_each           = local.required_apis
  project            = var.project_id
  service            = each.value
  disable_on_destroy = false
}

resource "google_service_account" "runtime" {
  account_id   = "rv-autopilot-runtime"
  display_name = "RV Assist Autopilot runtime"
}

resource "google_service_account" "pubsub_invoker" {
  account_id   = "rv-autopilot-pubsub"
  display_name = "RV Assist Autopilot Pub/Sub invoker"
}

resource "google_artifact_registry_repository" "app" {
  project       = var.project_id
  location      = var.region
  repository_id = local.service_name
  description   = "Container images for RV Assist Autopilot"
  format        = "DOCKER"

  depends_on = [google_project_service.required["artifactregistry.googleapis.com"]]
}

resource "google_pubsub_topic" "workflow" {
  name       = "rv-assist-workflow-events"
  depends_on = [google_project_service.required]
}

resource "google_cloud_run_v2_service" "autopilot" {
  count = local.deploy_service ? 1 : 0

  name                = local.service_name
  location            = var.region
  deletion_protection = true
  ingress             = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.runtime.email
    containers {
      image = var.image
      resources { limits = { cpu = "1", memory = "512Mi" } }
      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "STATE_STORE"
        value = "firestore"
      }
      env {
        name  = "EVENT_BUS"
        value = "pubsub"
      }
      env {
        name  = "WORKFLOW_SCHEDULER"
        value = "cloud-tasks"
      }
      env {
        name  = "NICHEWAVE_ADAPTER"
        value = "mock"
      }
      env {
        name  = "OUTREACH_ADAPTER"
        value = "mock"
      }
      env {
        name  = "QUALIFIER_MODE"
        value = "adk"
      }
      env {
        name  = "GEMINI_MODEL"
        value = var.gemini_model
      }
      env {
        name  = "GEMINI_TIMEOUT_MS"
        value = "15000"
      }
      env {
        name  = "GOOGLE_GENAI_USE_VERTEXAI"
        value = "true"
      }
      env {
        name  = "GOOGLE_CLOUD_PROJECT"
        value = var.project_id
      }
      env {
        name  = "GOOGLE_CLOUD_LOCATION"
        value = "global"
      }
      env {
        name  = "PUBSUB_WORKFLOW_TOPIC"
        value = google_pubsub_topic.workflow.name
      }
      env {
        name  = "CLOUD_TASKS_PROJECT"
        value = var.project_id
      }
      env {
        name  = "CLOUD_TASKS_LOCATION"
        value = var.region
      }
      env {
        name  = "CLOUD_TASKS_QUEUE"
        value = "rv-assist-response-deadlines"
      }
      env {
        name  = "CLOUD_TASKS_TARGET_URL"
        value = "https://placeholder.invalid/v1/events/tasks"
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }
  depends_on = [
    google_project_iam_member.runtime_vertex_ai,
    google_project_service.required,
  ]
}

resource "google_cloud_run_v2_service_iam_member" "pubsub_invoker" {
  count = local.deploy_service ? 1 : 0

  location = google_cloud_run_v2_service.autopilot[0].location
  name     = google_cloud_run_v2_service.autopilot[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.pubsub_invoker.email}"
}

resource "google_project_iam_member" "pubsub_service_agent_token_creator" {
  project = var.project_id
  role    = "roles/iam.serviceAccountTokenCreator"
  member  = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-pubsub.iam.gserviceaccount.com"

  depends_on = [google_project_service.required["pubsub.googleapis.com"]]
}

resource "google_project_iam_member" "runtime_firestore" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_pubsub" {
  project = var.project_id
  role    = "roles/pubsub.publisher"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_cloud_tasks" {
  project = var.project_id
  role    = "roles/cloudtasks.enqueuer"
  member  = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_project_iam_member" "runtime_vertex_ai" {
  project = var.project_id
  role    = "roles/aiplatform.user"
  member  = "serviceAccount:${google_service_account.runtime.email}"

  depends_on = [google_project_service.required["aiplatform.googleapis.com"]]
}

resource "google_service_account_iam_member" "cloud_tasks_service_agent_user" {
  service_account_id = google_service_account.pubsub_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:service-${data.google_project.current.number}@gcp-sa-cloudtasks.iam.gserviceaccount.com"

  depends_on = [google_project_service.required["cloudtasks.googleapis.com"]]
}

resource "google_service_account_iam_member" "runtime_cloud_tasks_service_account_user" {
  service_account_id = google_service_account.pubsub_invoker.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.runtime.email}"
}

resource "google_cloud_tasks_queue" "response_deadlines" {
  count = local.deploy_service ? 1 : 0

  project  = var.project_id
  name     = "rv-assist-response-deadlines"
  location = var.region

  rate_limits {
    max_concurrent_dispatches = 10
    max_dispatches_per_second = 10
  }

  retry_config {
    max_attempts       = 5
    max_retry_duration = "3600s"
    min_backoff        = "10s"
    max_backoff        = "300s"
    max_doublings      = 4
  }

  http_target {
    http_method = "POST"
    uri_override {
      scheme                    = "HTTPS"
      host                      = trimprefix(google_cloud_run_v2_service.autopilot[0].uri, "https://")
      uri_override_enforce_mode = "ALWAYS"
    }
    header_overrides {
      header {
        key   = "Content-Type"
        value = "application/json"
      }
    }
    oidc_token {
      service_account_email = google_service_account.pubsub_invoker.email
      audience              = google_cloud_run_v2_service.autopilot[0].uri
    }
  }

  stackdriver_logging_config {
    sampling_ratio = 1
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_project_service.required["cloudtasks.googleapis.com"],
    google_service_account_iam_member.cloud_tasks_service_agent_user,
  ]
}

resource "google_pubsub_subscription" "workflow_push" {
  count = local.deploy_service ? 1 : 0

  name                 = "rv-assist-workflow-push"
  topic                = google_pubsub_topic.workflow.id
  ack_deadline_seconds = 60
  push_config {
    push_endpoint = "${google_cloud_run_v2_service.autopilot[0].uri}/v1/events/pubsub"
    oidc_token { service_account_email = google_service_account.pubsub_invoker.email }
  }
  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  depends_on = [
    google_cloud_run_v2_service_iam_member.pubsub_invoker,
    google_project_iam_member.pubsub_service_agent_token_creator,
  ]
}
