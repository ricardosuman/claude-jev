#!/bin/bash
set -euo pipefail
if [ -d .git ] && grep -q 'if (!row.unwoundAt)' src/ingress/allotments.ts 2>/dev/null; then
  exit 0
fi
bash "$(dirname "$0")/../scaffold.sh" fixture-vocab
sed -i.bak 's/if (row.unwoundAt)/if (!row.unwoundAt)/' src/ingress/allotments.ts && rm src/ingress/allotments.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'allotments: unwind'
