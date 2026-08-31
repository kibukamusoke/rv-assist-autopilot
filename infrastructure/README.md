# Infrastructure

Terraform describes the intended Artifact Registry, Cloud Run, Pub/Sub, Cloud Tasks, IAM, and runtime configuration. It assumes the deletion-protected `(default)` Firestore Native database already exists in `us-west4`, so applying this stack cannot accidentally replace or reconfigure the database.

Deployment is intentionally split into two stages. The first apply creates the supporting infrastructure without trying to deploy a nonexistent container image.

## 1. Bootstrap infrastructure

```bash
cd infrastructure/terraform
terraform init
cp terraform.tfvars.example terraform.tfvars
terraform plan
terraform apply
```

With `image = null`, this creates the APIs, Artifact Registry repository, service accounts, IAM grants, and Pub/Sub topic. It does not create Cloud Run, the Cloud Tasks queue, or the push subscription.

## 2. Build and push with Cloud Build

Cloud Run requires `linux/amd64`. Cloud Build produces that architecture inside Google's infrastructure and needs no local container runtime, which is why it is the supported path here. Apple `container` can build the same image locally but its registry upload has stalled without creating a tag; see the deployment runbook for that fallback.

```bash
IMAGE_TAG="us-west4-docker.pkg.dev/rv-assist-autopilot/rv-assist-autopilot/app:$(git rev-parse --short HEAD)"
gcloud builds submit --tag "$IMAGE_TAG" .

gcloud artifacts docker images describe "$IMAGE_TAG" \
  --format='value(image_summary.digest)'
```

Set `image` in `terraform.tfvars` to the same repository path pinned to the returned digest, for example:

```hcl
image = "us-west4-docker.pkg.dev/rv-assist-autopilot/rv-assist-autopilot/app@sha256:<64-character-digest>"
```

Then run `terraform plan` and `terraform apply` again. The second apply creates Cloud Run, its authenticated Pub/Sub push subscription, and an authenticated Cloud Tasks queue for exact technician-response deadlines. Pub/Sub remains the general event ingress; Cloud Tasks prevents future deadlines from being implemented as repeated `503` retries.

The default Cloud Run region is `us-west4`, matching the Phoenix-facing Firestore database. Review every plan before applying. `deletion_protection` is enabled on Cloud Run. The initial deployment deliberately keeps the synthetic NicheWave adapter and deterministic qualifier until the external API contract, Gemini qualification, and secret management are implemented.
