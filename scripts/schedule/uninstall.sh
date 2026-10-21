#!/bin/sh
# Stops the publish scheduler and moves its plist to ~/Downloads/to delete/ (never deleted outright).
LABEL=com.ameyaheights.social-publish
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
BIN="$HOME/Downloads/to delete"

launchctl bootout "gui/$(id -u)" "$PLIST" >/dev/null 2>&1 || true

if [ -f "$PLIST" ]; then
  mkdir -p "$BIN"
  dest="$BIN/$LABEL.plist"
  [ -e "$dest" ] && dest="$BIN/$LABEL.$(date '+%Y%m%d-%H%M%S').plist"
  mv "$PLIST" "$dest"
  echo "$(date '+%Y-%m-%d %H:%M')  $LABEL.plist <- ~/Library/LaunchAgents (scheduler uninstalled)" >> "$BIN/MOVED.txt"
  echo "Scheduler stopped. Plist moved to $dest"
else
  echo "Scheduler stopped. No plist at $PLIST"
fi
