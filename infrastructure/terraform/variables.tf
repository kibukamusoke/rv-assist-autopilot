variable "project_id" {
  description = "Google Cloud project ID."
  type        = string
}

variable "region" {
  description = "Google Cloud region for Cloud Run, co-located with the Phoenix-facing Firestore database."
  type        = string
  default     = "us-west4"
}

variable "image" {
  description = "Immutable container image reference pinned by sha256 digest. Leave null for infrastructure bootstrap."
  type        = string
  default     = null
  nullable    = true

  validation {
    condition     = var.image == null ? true : can(regex("@sha256:[0-9a-f]{64}$", var.image))
    error_message = "image must be null for bootstrap or an immutable image reference ending in @sha256:<64 lowercase hex characters>."
  }
}

variable "gemini_model" {
  description = "Vertex AI Gemini model used by the live Google ADK qualification agent."
  type        = string
  default     = "gemini-2.5-flash"
}
