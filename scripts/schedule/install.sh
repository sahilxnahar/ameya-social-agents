#!/bin/sh
# Installs the 15-minute publish scheduler as a launchd job for the logged-in user.
# Run it yourself, once: sh scripts/schedule/install.sh   (undo with scripts/schedule/uninstall.sh)
set -e
REPO=$(cd "$(dirname "$0")/../.." && pwd)
NODE=$(command -v node) || { echo "node not found on PATH" >&2; exit 1; }
LABEL=com.ameyaheights.social-publish
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

mkdir -p "$HOME/Library/LaunchAgents" "$REPO/logs"
cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/sh</string>
    <string>$REPO/scripts/schedule/run.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>NODE_BIN</key><string>$NODE</string>
  </dict>
  <key>WorkingDirectory</key><string>$REPO</string>
  <key>StartInterval</key><integer>900</integer>
  <key>RunAtLoad</key><false/>
  <key>StandardOutPath</key><string>$REPO/logs/scheduler.out</string>
  <key>StandardErrorPath</key><string>$REPO/logs/scheduler.err</string>
</dict>
</plist>
EOF

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"

echo "Installed $LABEL"
echo "  plist:    $PLIST"
echo "  runs:     /bin/sh $REPO/scripts/schedule/run.sh every 15 minutes"
echo "  node:     $NODE"
echo "  log:      $REPO/logs/scheduler.log"
echo
echo "It publishes only items you approved whose time has come (npm run publish -- due --live)."
echo "Note: the repo is in ~/Documents, so macOS may block the job until you grant Full Disk Access"
echo "(or Documents access) to $NODE in System Settings > Privacy & Security."
echo "If logs/scheduler.log stays empty after 15 minutes, check logs/scheduler.err."
