#!/bin/sh
# Works around two issues seen running `tetherto-qvac-sdk`'s installed worker
# on Debian-slim/arm64 (and, per the underlying cause, any platform where npm
# hoists the optional platform package):
#
# 1. `python -m tetherto.qvac_sdk install-worker` runs a plain `npm install`,
#    which hoists platform-specific packages like `bare-runtime-linux-arm64`
#    to the top-level `node_modules` (nothing else needs a different version,
#    so npm doesn't nest it). `Client()` in the Python SDK, however, looks
#    for the Bare binary nested under `@qvac/sdk/node_modules/`, so it raises
#    `WorkerNotFoundError` even though the binary is present one level up.
# 2. The platform package ships `bin/bare` without the execute bit set.
#
# Safe to run even if install-worker didn't run or didn't succeed (falls
# through to the existing stub/fallback mode) -- never fails the build.

WORKER_DIR=$(find /root/.cache/qvac/worker -mindepth 1 -maxdepth 1 -type d 2>/dev/null | head -1)
if [ -n "$WORKER_DIR" ]; then
  ARCH_DIR=$(find "$WORKER_DIR/node_modules" -maxdepth 1 -type d -name 'bare-runtime-linux-*' 2>/dev/null | head -1)
  if [ -n "$ARCH_DIR" ]; then
    mkdir -p "$WORKER_DIR/node_modules/@qvac/sdk/node_modules"
    ln -sf "$ARCH_DIR" "$WORKER_DIR/node_modules/@qvac/sdk/node_modules/$(basename "$ARCH_DIR")"
    ln -sf "$WORKER_DIR/node_modules/bare-runtime" "$WORKER_DIR/node_modules/@qvac/sdk/node_modules/bare-runtime"
    chmod +x "$ARCH_DIR/bin/bare"
  fi
fi
exit 0
