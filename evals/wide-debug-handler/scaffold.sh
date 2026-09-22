#!/bin/bash
set -euo pipefail
if [ -d .git ] && grep -q 'if (!session.revokedAt)' src/routes/sessions.ts 2>/dev/null; then
  exit 0
fi
bash "$(dirname "$0")/../scaffold.sh" fixture-wide
sed -i.bak 's/if (session.revokedAt)/if (!session.revokedAt)/' src/routes/sessions.ts && rm src/routes/sessions.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'sessions: revoke'
