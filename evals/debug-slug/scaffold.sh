#!/bin/bash
set -euo pipefail
bash "$(dirname "$0")/../scaffold.sh"
sed -i.bak 's#/^-|-$/g#/^-/g#' src/slug.ts && rm src/slug.ts.bak
git -c user.name=eval -c user.email=eval@example.com commit -qam 'slug: tidy'
