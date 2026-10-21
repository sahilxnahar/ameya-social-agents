#!/bin/sh
# Run by launchd every 15 minutes (see install.sh). Publishes approved items that are due, appends
# the output to logs/scheduler.log and shows a macOS notification when something happened.
# Only items the owner approved can leave; publish.mjs re-checks every approval hash itself.
cd "$(dirname "$0")/../.." || exit 1
mkdir -p logs

out=$("${NODE_BIN:-node}" scripts/publish.mjs due --live 2>&1)
status=$?

{
  echo "== $(date '+%Y-%m-%d %H:%M:%S %z') exit $status"
  echo "$out"
} >> logs/scheduler.log

if printf '%s' "$out" | grep -Eq 'failed|handed off|published'; then
  msg=$(printf '%s' "$out" | tr '\n' ' ' | tr -d '"\\' | cut -c1-180)
  osascript -e "display notification \"$msg\" with title \"Ameya social\"" >/dev/null 2>&1 || true
fi

exit $status
