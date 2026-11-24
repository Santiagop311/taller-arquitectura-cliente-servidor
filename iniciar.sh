#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

# Usa Node instalado normalmente o el runtime ya disponible en Codex.
if command -v node >/dev/null 2>&1; then
  exec node index.js
fi

runtime_node="${XDG_CACHE_HOME:-$HOME/.cache}/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
if [[ -x "$runtime_node" ]]; then
  exec "$runtime_node" index.js
fi

echo 'Instala Node.js 22 o superior y ejecuta npm install y npm start.' >&2
exit 1
