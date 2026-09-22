#!/bin/bash
set -euo pipefail
bash "$(dirname "$0")/../scaffold.sh"
bun "$(dirname "$0")/gen.ts"
git add -A && git -c user.name=eval -c user.email=eval@example.com commit -q --amend --no-edit
