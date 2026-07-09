#!/usr/bin/env bash
# deploy-canary.sh — Phase 12 (§13.4 canary + auto-rollback). Called 3x from
# .github/workflows/cd.yml's `backend` job: 5% -> 25% -> 100%. Real script, real logic; has
# never been run against a live cluster in this environment (no cluster exists here — see
# docs/scale/limits.md). Requires: helm, kubectl (configured against the target cluster), and
# STABLE_REPLICAS_TOTAL matching values-<region>.yaml's api.replicaCount.
set -euo pipefail

WEIGHT_PCT="${1:?usage: deploy-canary.sh <weight-pct> <image-tag> <stable-replicas-total>}"
IMAGE_TAG="${2:?usage: deploy-canary.sh <weight-pct> <image-tag> <stable-replicas-total>}"
STABLE_REPLICAS_TOTAL="${3:?usage: deploy-canary.sh <weight-pct> <image-tag> <stable-replicas-total>}"

RELEASE="${HELM_RELEASE:-nutrimind}"
NAMESPACE="${K8S_NAMESPACE:-nutrimind}"
VALUES_FILE="${VALUES_FILE:-infra/helm/nutrimind/values-ap-south-1.yaml}"
CHART_DIR="infra/helm/nutrimind"
CANARY_SOAK_SECONDS="${CANARY_SOAK_SECONDS:-60}"

if [ "$WEIGHT_PCT" -ge 100 ]; then
  echo "[deploy-canary] Promoting ${IMAGE_TAG} to 100% — folding into stable, disabling canary track"
  helm upgrade --install "$RELEASE" "$CHART_DIR" -f "$VALUES_FILE" \
    --set image.tag="$IMAGE_TAG" \
    --set canary.enabled=false --set canary.replicas=0 \
    --namespace "$NAMESPACE" --create-namespace --wait --timeout 5m
  echo "[deploy-canary] Promotion complete."
  exit 0
fi

# Ceiling division so 5% of a small replica count still gets at least 1 canary pod.
canary_replicas=$(( (STABLE_REPLICAS_TOTAL * WEIGHT_PCT + 99) / 100 ))

echo "[deploy-canary] Deploying ${IMAGE_TAG} at ${WEIGHT_PCT}% (${canary_replicas} canary replica(s))"
helm upgrade --install "$RELEASE" "$CHART_DIR" -f "$VALUES_FILE" \
  --set canary.enabled=true --set canary.tag="$IMAGE_TAG" --set canary.replicas="$canary_replicas" \
  --namespace "$NAMESPACE" --create-namespace --wait --timeout 5m

echo "[deploy-canary] Soaking ${CANARY_SOAK_SECONDS}s to let the SLO burn-rate window observe canary traffic..."
sleep "$CANARY_SOAK_SECONDS"

canary_pod=$(kubectl get pods -n "$NAMESPACE" \
  -l "app.kubernetes.io/instance=${RELEASE},app.kubernetes.io/component=api,track=canary" \
  -o jsonpath='{.items[0].metadata.name}')

if [ -z "$canary_pod" ]; then
  echo "[deploy-canary] FAIL: no canary pod found after rollout — treating as unhealthy"
  exit 1
fi

# Check the canary pod's OWN circuit-breaker state directly (bypassing the shared Service, which
# load-balances across the much larger stable pool and could mask a canary-specific regression).
if ! kubectl exec -n "$NAMESPACE" "$canary_pod" -- node -e "
  fetch('http://localhost:3000/v1/gateway/status')
    .then(r => r.json())
    .then(j => {
      const breakers = Object.values((j.data && j.data.circuitBreakers) || {});
      const anyOpen = breakers.some((s) => s === 'OPEN');
      process.exit(anyOpen ? 1 : 0);
    })
    .catch(() => process.exit(1));
"; then
  echo "[deploy-canary] FAIL: canary pod ${canary_pod} reports an OPEN circuit breaker — rolling back"
  helm rollback "$RELEASE" --namespace "$NAMESPACE" --wait
  exit 1
fi

echo "[deploy-canary] Canary at ${WEIGHT_PCT}% healthy."
