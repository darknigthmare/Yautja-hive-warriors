#!/usr/bin/env bash
set -eu
YAUTJA_REPO_DIR="${YAUTJA_REPO_DIR:-/workspace/Yautja-hive-warriors}"
YAUTJA_NPM_CACHE="${YAUTJA_NPM_CACHE:-/tmp/yautja-npm-cache-20261028}"
cd "$YAUTJA_REPO_DIR"
test -f package-lock.json
node -e 'const [major,minor]=process.versions.node.split(".").map(Number);if(major<22||(major===22&&minor<12))throw new Error("Node >=22.12 required")'
npm ci --cache "$YAUTJA_NPM_CACHE"
