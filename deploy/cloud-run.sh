#!/usr/bin/env bash
# Deploy the committed tree (HEAD) to Google Cloud Run as one service.
# Needs `gcloud auth login` and a project with billing enabled (the demo stays inside the
# free tier: request-based billing, scale to zero, at most one instance).
#   deploy/cloud-run.sh            build, push, deploy
#   deploy/cloud-run.sh --secret   (re)store NEBIUS_API_KEY from .env in Secret Manager first
set -euo pipefail

PROJECT="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-europe-west1}"
SERVICE=verdict
REPO=verdict
[ -n "$PROJECT" ] || { echo "No project: gcloud config set project <id>" >&2; exit 1; }

ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# The demo Dockerfile duplicates the verifier pins; refuse to ship if they drifted.
pins() { grep -oE 'sha256:[0-9a-f]{64}|(VERSION|CONFIG_VERSION)=[^ ]+' "$1" | sort; }
if ! diff <(pins services/verifier/Dockerfile) <(pins deploy/Dockerfile) >/dev/null; then
  echo "Verifier pins differ between services/verifier/Dockerfile and deploy/Dockerfile" >&2
  exit 1
fi

gcloud services enable run.googleapis.com artifactregistry.googleapis.com \
  secretmanager.googleapis.com --project "$PROJECT" --quiet

if [ "${1:-}" = "--secret" ]; then
  # The key goes from .env straight into Secret Manager; it is never echoed or logged.
  key="$(grep -E '^NEBIUS_API_KEY=' .env | head -1 | cut -d= -f2-)"
  [ -n "$key" ] || { echo "NEBIUS_API_KEY is empty in .env" >&2; exit 1; }
  if gcloud secrets describe nebius-api-key --project "$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$key" | gcloud secrets versions add nebius-api-key --data-file=- --project "$PROJECT" >/dev/null
  else
    printf '%s' "$key" | gcloud secrets create nebius-api-key --data-file=- \
      --replication-policy=automatic --project "$PROJECT" >/dev/null
  fi
  unset key
  sa="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding nebius-api-key --project "$PROJECT" \
    --member "serviceAccount:$sa" --role roles/secretmanager.secretAccessor >/dev/null
  echo "Secret nebius-api-key stored."
fi

gcloud artifacts repositories describe "$REPO" --location "$REGION" --project "$PROJECT" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" --repository-format docker \
       --location "$REGION" --project "$PROJECT" --quiet
# Keep only the two newest images so storage stays inside the 0.5 GB free tier.
policy="$(mktemp)"
cat > "$policy" <<'JSON'
[
  {"name": "keep-newest-2", "action": {"type": "Keep"}, "mostRecentVersions": {"keepCount": 2}},
  {"name": "delete-older", "action": {"type": "Delete"}, "condition": {"tagState": "any"}}
]
JSON
gcloud artifacts repositories set-cleanup-policies "$REPO" --location "$REGION" \
  --project "$PROJECT" --policy "$policy" --no-dry-run --quiet >/dev/null
rm -f "$policy"
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet >/dev/null

# Build from HEAD only, so uncommitted changes and local files never reach the image.
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
git archive HEAD | tar -x -C "$STAGE"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/$SERVICE:$(git rev-parse --short HEAD)"
docker buildx build --platform linux/amd64 -f "$STAGE/deploy/Dockerfile" -t "$IMAGE" --push "$STAGE"

# max-instances 1: the rate limit and the daily model budget live in memory, so a second
# instance would double both. It also caps what a traffic spike can cost.
gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --project "$PROJECT" \
  --port 7860 --cpu 1 --memory 2Gi --cpu-boost \
  --min-instances 0 --max-instances 1 --concurrency 20 --timeout 300 \
  --set-secrets NEBIUS_API_KEY=nebius-api-key:latest \
  --allow-unauthenticated --quiet
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format 'value(status.url)'
