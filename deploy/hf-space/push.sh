#!/usr/bin/env bash
# Publish the committed tree (HEAD) to the Hugging Face Space.
# Needs `hf auth login` once. Uncommitted changes are never uploaded.
#   deploy/hf-space/push.sh [owner/space]   (default: Tschoko86/verdict)
set -euo pipefail

SPACE="${1:-Tschoko86/verdict}"
ROOT="$(git rev-parse --show-toplevel)"
cd "$ROOT"

# The Space Dockerfile duplicates the verifier pins; refuse to ship if they drifted.
pins() { grep -oE 'sha256:[0-9a-f]{64}|(VERSION|CONFIG_VERSION)=[^ ]+' "$1" | sort; }
if ! diff <(pins services/verifier/Dockerfile) <(pins deploy/hf-space/Dockerfile) >/dev/null; then
  echo "Verifier pins differ between services/verifier/Dockerfile and deploy/hf-space/Dockerfile" >&2
  exit 1
fi

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
git archive HEAD | tar -x -C "$STAGE"
rm -rf "$STAGE/.planning" "$STAGE/.claude" "$STAGE/.github" "$STAGE/.githooks"
cp deploy/hf-space/Dockerfile "$STAGE/Dockerfile"
cp deploy/hf-space/README.md "$STAGE/README.md"

hf repos create "$SPACE" --type space --sdk docker --private --exist-ok
hf upload "$SPACE" "$STAGE" . --repo-type space --delete "*" \
  --commit-message "Deploy $(git rev-parse --short HEAD)"
echo "Space: https://huggingface.co/spaces/$SPACE"
