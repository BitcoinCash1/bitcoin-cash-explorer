#!/usr/bin/env bash
set -euo pipefail
section() {
  local name=$1
  shift
  printf '\033[0Ksection_start:%s:%s[collapsed=true]\r\033[0K%s\n' "$(date +%s)" "$name" "$name"
  "$@"
  printf '\033[0Ksection_end:%s:%s\r\033[0K\n' "$(date +%s)" "$name"
}
export PNPM_CONFIG_VERIFY_DEPS_BEFORE_RUN=false
case "${1:?backend or frontend required}" in
  backend)
    section native_build bash -c 'cd rust/gbt && npm run build-release && npm run to-backend'
    section native_tests bash -c 'cd rust/gbt && cargo test --locked && npm run test:bindings'
    cd backend
    # Native output already exists. All backend dependency build scripts are disabled
    # in pnpm-workspace.yaml; skip the root preinstall that would rebuild it.
    section dependencies pnpm install --frozen-lockfile --prefer-offline --ignore-scripts --store-dir .pnpm-store
    section formatting pnpm run prettier:check
    section tests pnpm run test
    section package pnpm run package
    node -e 'require("./package/node_modules/rust-gbt")'
    ;;
  frontend)
    cd frontend
    section dependencies pnpm install --frozen-lockfile --prefer-offline --store-dir .pnpm-store
    section config pnpm run config:defaults:explorer
    section lint pnpm run lint
    section formatting pnpm run prettier:check
    section tests pnpm run test:unit
    section package pnpm run build
    ;;
  *) exit 2 ;;
esac
