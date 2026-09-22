#!/bin/bash
set -euo pipefail
bash "$(dirname "$0")/../scaffold.sh"
sed -i.bak 's/m: 60_000/m: 6_000/' src/config.ts && rm src/config.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'config: units'
