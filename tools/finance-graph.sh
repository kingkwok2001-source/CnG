#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export GRAPHIFY_BACKEND=none
export GRAPHIFY_QUERY_LOG_DISABLE=1
bin="${GRAPHIFY_BIN:-graphify}"
case "${1:-help}" in
 build)
  "$bin" extract . --code-only --max-workers 2
  "$bin" cluster-only . --no-label
  ;;
 query|explain|affected|path)
  action="$1";shift
  "$bin" "$action" "$@" --graph graphify-out/graph.json
  ;;
 *) echo 'Usage: GRAPHIFY_BIN=/path/to/graphify bash tools/finance-graph.sh {build|query|explain|affected|path} [arguments]' ;;
esac
