#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && cd -P .. && pwd)"
cd "$ROOT_DIR"

# Remove generated directories and caches
rm -rf node_modules .next out dist coverage .turbo .cache

# Remove common log and macOS hidden files
find . -name '*.log' -type f -delete
find . -name '.DS_Store' -delete
