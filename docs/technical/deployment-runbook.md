# Deployment runbook

## Current target

- Project: `rv-assist-autopilot`
- Region: `us-west4`
- Runtime: private Cloud Run service
- Database: deletion-protected Firestore Native `(default)` database in `us-west4`
- Container tooling: Apple `container`, not Docker Desktop

## Build and push

Cloud Run requires `linux/amd64`. Google Cloud Build is the supported path: it builds and pushes inside Google's infrastructure, produces the correct architecture without Rosetta, and needs no local container runtime. Every release since 2026-08-17 has been published this way.

```bash
IMAGE_TAG="us-west4-docker.pkg.dev/rv-assist-autopilot/rv-assist-autopilot/app:$(git rev-parse --short HEAD)"
gcloud builds submit --tag "${IMAGE_TAG}" .

gcloud artifacts docker images describe "${IMAGE_TAG}" \
  --format='value(image_summary.digest)'
```

### Fallback: Apple container

Apple's `container` CLI builds a valid `linux/amd64` image on Apple silicon, but its registry upload has stalled without creating a tag. Prefer Cloud Build; use this only when Cloud Build is unavailable.

```bash
gcloud auth print-access-token \
  | container registry login \
      --username oauth2accesstoken \
      --password-stdin us-west4-docker.pkg.dev

IMAGE_TAG="us-west4-docker.pkg.dev/rv-assist-autopilot/rv-assist-autopilot/app:VERSION-amd64"
container build --arch amd64 --tag "${IMAGE_TAG}" .
container image push "${IMAGE_TAG}"
```

Pin the returned digest in the ignored `infrastructure/terraform/terraform.tfvars`. Never deploy a placeholder or mutable tag through Terraform.

## Plan and apply

```bash
cd infrastructure/terraform
terraform validate
terraform plan -input=false -out=/tmp/rvassist.tfplan
terraform apply -input=false /tmp/rvassist.tfplan
terraform plan -input=false -detailed-exitcode
```

Only apply after confirming zero unexpected destroys. Cloud Run deletion protection must remain enabled.

## Rollback

Rollback is an in-place image update:

1. Select a previously verified AMD64 digest from Artifact Registry or `deployment-history.md`.
2. Put that immutable digest in `terraform.tfvars`.
3. Review a plan showing only an in-place Cloud Run image update.
4. Apply and rerun the authenticated smoke tests.

Do not delete or recreate Firestore as part of an application rollback.

## Known recovery cases

- **Cloud Run rejects the manifest:** rebuild with `container build --arch amd64` and use the new digest.
- **Failed creation leaves the service tainted:** verify the state, then use `terraform untaint 'google_cloud_run_v2_service.autopilot[0]'` so a valid image can update in place. Do not disable deletion protection merely to replace a recoverable service.
- **Provider reports an inconsistent Pub/Sub endpoint:** rerun a fresh plan after Cloud Run has a stable URL, then apply only the remaining addition.
- **Apple container push stalls without creating a tag:** stop it and publish with `gcloud builds submit` instead. This has happened more than once and is the reason Cloud Build is the primary path.
- **Apple container push returns `401`:** refresh `container registry login` with a new `gcloud auth print-access-token`.
- **Shell note:** command blocks in this repository are written without `#` comments because the maintainer's interactive zsh does not treat `#` as a comment.
- **Cloud Tasks reports missing `iam.serviceAccounts.actAs`:** confirm the runtime and Cloud Tasks service agent both have `roles/iam.serviceAccountUser` on the dedicated invoker account.
