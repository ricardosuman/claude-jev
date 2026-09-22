#!/bin/bash
set -euo pipefail
if [ -d .git ] && [ -f config/allotment.ts ]; then
  exit 0
fi
bash "$(dirname "$0")/../scaffold.sh" fixture-vocab
