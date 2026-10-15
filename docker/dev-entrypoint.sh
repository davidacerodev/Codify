#!/bin/sh
set -eu

lock_hash="$(sha256sum package.json package-lock.json | sha256sum | cut -d ' ' -f 1)"
lock_state="/app/node_modules/.codify-dependency-lock"
installed_hash=""

if [ -f "$lock_state" ]; then
  installed_hash="$(cat "$lock_state")"
fi

if [ ! -x /app/node_modules/.bin/next ] || [ "$lock_hash" != "$installed_hash" ]; then
  npm ci
  printf '%s\n' "$lock_hash" > "$lock_state"
fi

exec npm run dev
