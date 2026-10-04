#!/usr/bin/env bash
# Start the verifier on localhost, wait until it is healthy, then run the app.
# If either process exits, the container exits and the Space restarts it.
set -euo pipefail

# The secret only guards localhost traffic inside this container, so a fresh one per boot is enough.
export VERIFIER_SECRET="${VERIFIER_SECRET:-$(head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \n')}"
export VERIFIER_URL="http://127.0.0.1:8081"

PORT=8081 java -Xmx768m -cp /opt/verifier/classes:/opt/verifier/lib/validator.jar \
  app.verdict.verifier.VerifierServer &
verifier=$!

for _ in $(seq 1 60); do
  if (exec 3<>/dev/tcp/127.0.0.1/8081) 2>/dev/null; then break; fi
  kill -0 "$verifier" 2>/dev/null || { echo "verifier exited during startup" >&2; exit 1; }
  sleep 1
done

PORT=7860 HOSTNAME=0.0.0.0 node server.js &
web=$!

wait -n "$verifier" "$web"
status=$?
kill "$verifier" "$web" 2>/dev/null || true
exit "$status"
