#!/bin/zsh
cd "${0:A:h}"
if ! command -v node >/dev/null; then
  export PATH="$HOME/.local/share/nodejs/current/bin:/opt/homebrew/bin:$PATH"
fi
echo 'SONO Studioを起動します。このウィンドウは開いたままにしてください。'
node server/index.mjs --open
