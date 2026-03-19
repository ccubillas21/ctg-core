#!/bin/sh
# Copy default pricing if not present in data volume
if [ ! -f "/data/pricing.json" ] && [ -f "/app/pricing.json.default" ]; then
  cp /app/pricing.json.default /data/pricing.json
  echo "[gatekeeper] Copied default pricing.json to /data/"
fi

exec node index.js
