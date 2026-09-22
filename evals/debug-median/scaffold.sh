#!/bin/bash
set -euo pipefail
bash "$(dirname "$0")/../scaffold.sh"
sed -i.bak 's/\[\.\.\.nums\]\.sort((a, b) => a - b)/[...nums]/' src/stats.ts && rm src/stats.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'stats: simplify'
