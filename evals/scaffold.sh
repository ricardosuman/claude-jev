#!/bin/bash
# Copies the fixture project into the run's working directory as a fresh git repo.
# A debug case's own scaffold.sh runs this, then seeds its bug with sed. $1 picks another fixture dir.
set -euo pipefail
cp -R "$(dirname "$0")/${1:-fixture}/." .
git init -q
git add -A
git -c user.name=eval -c user.email=eval@example.com commit -qm fixture
