#!/bin/bash
# setup-cron.sh
# Installs daily scrape job to run at 6:00 AM every morning.
# Uses macOS launchd (more reliable than crontab — survives reboots, retries on error).
#
# Run once: chmod +x scripts/setup-cron.sh && ./scripts/setup-cron.sh

PLIST_NAME="com.webcrew.daily-scrape"
PLIST_PATH="$HOME/Library/LaunchAgents/${PLIST_NAME}.plist"
PIPELINE_DIR="$(cd "$(dirname "$0")/.." && pwd)"
LOG_DIR="$PIPELINE_DIR/logs"

mkdir -p "$LOG_DIR"

echo "📋 Installing daily scrape job..."
echo "   Pipeline dir: $PIPELINE_DIR"
echo "   Log dir:      $LOG_DIR"

# Write the launchd plist
cat > "$PLIST_PATH" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${PLIST_NAME}</string>

    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>--loader</string>
        <string>tsx/esm</string>
        <string>src/scripts/daily-scrape.ts</string>
    </array>

    <key>WorkingDirectory</key>
    <string>${PIPELINE_DIR}</string>

    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
        <key>NODE_PATH</key>
        <string>${PIPELINE_DIR}/node_modules</string>
    </dict>

    <!-- Run at 6:00 AM every day -->
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>6</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>${LOG_DIR}/daily-scrape.log</string>
    <key>StandardErrorPath</key>
    <string>${LOG_DIR}/daily-scrape-error.log</string>

    <!-- Restart if it crashes -->
    <key>KeepAlive</key>
    <dict>
        <key>Crashed</key>
        <true/>
    </dict>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
EOF

# Unload if already running
launchctl unload "$PLIST_PATH" 2>/dev/null

# Load the job
launchctl load "$PLIST_PATH"

echo ""
echo "✅  Daily scrape installed!"
echo "   Runs at: 6:00 AM every day"
echo "   Logs at: $LOG_DIR/daily-scrape.log"
echo ""
echo "Manual run now:   npm run scrape:daily"
echo "Check logs:       tail -f $LOG_DIR/daily-scrape.log"
echo "Remove job:       launchctl unload $PLIST_PATH && rm $PLIST_PATH"
