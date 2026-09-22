#!/bin/bash
set -euo pipefail
if [ -d .git ] && [ -f src/services/itemService.ts ]; then
  exit 0
fi
bash "$(dirname "$0")/../scaffold.sh" fixture-wide
