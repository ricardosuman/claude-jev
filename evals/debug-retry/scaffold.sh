#!/bin/bash
set -euo pipefail
bash "$(dirname "$0")/../scaffold.sh"
sed -i.bak 's/i < attempts;/i < attempts - 1;/' src/retry.ts && rm src/retry.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'retry: tidy loop'
