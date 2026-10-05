#!/usr/bin/env bash
# Deploy the committed tree (HEAD) to Google Cloud Run as one service.
# Needs `gcloud auth login` and a project with billing enabled (the demo stays inside the
# free tier: request-based billing, scale to zero, at most one instance).
#   deploy/cloud-run.sh            build, push, deploy
#   deploy/cloud-run.sh --secret   (re)store NEBIUS_API_KEY and TAVILY_API_KEY from .env first
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

# store_secret <name> <ENV_KEY>: moves one key from .env into Secret Manager without echoing it.
store_secret() {
  local value sa
  value="$(grep -E "^$2=" .env | head -1 | cut -d= -f2-)"
  [ -n "$value" ] || { echo "$2 is empty in .env, skipped"; return 0; }
  if gcloud secrets describe "$1" --project "$PROJECT" >/dev/null 2>&1; then
    printf '%s' "$value" | gcloud secrets versions add "$1" --data-file=- --project "$PROJECT" >/dev/null
  else
    printf '%s' "$value" | gcloud secrets create "$1" --data-file=- \
      --replication-policy=automatic --project "$PROJECT" >/dev/null
  fi
  sa="$(gcloud projects describe "$PROJECT" --format='value(projectNumber)')-compute@developer.gserviceaccount.com"
  gcloud secrets add-iam-policy-binding "$1" --project "$PROJECT" \
    --member "serviceAccount:$sa" --role roles/secretmanager.secretAccessor >/dev/null
  echo "Secret $1 stored."
}

if [ "${1:-}" = "--secret" ]; then
  store_secret nebius-api-key NEBIUS_API_KEY
  store_secret tavily-api-key TAVILY_API_KEY
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

# Tavily is optional: without its secret, rule explanations run without web sources.
SECRETS="NEBIUS_API_KEY=nebius-api-key:latest"
if gcloud secrets describe tavily-api-key --project "$PROJECT" >/dev/null 2>&1; then
  SECRETS="$SECRETS,TAVILY_API_KEY=tavily-api-key:latest"
fi

# gen2: the default gen1 sandbox makes the ZUGFeRD step (three short-lived JVMs) several times slower.
# max-instances 1: the rate limit and the daily model budget live in memory, so a second
# instance would double both. It also caps what a traffic spike can cost.
gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --project "$PROJECT" \
  --port 7860 --cpu 1 --memory 2Gi --cpu-boost --execution-environment gen2 \
  --min-instances 0 --max-instances 1 --concurrency 20 --timeout 300 \
  --set-secrets "$SECRETS" \
  --allow-unauthenticated --quiet
gcloud run services describe "$SERVICE" --region "$REGION" --project "$PROJECT" --format 'value(status.url)'
