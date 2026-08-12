#!/bin/sh
# Regenerate config.js from the template using API_BASE_URL at container
# startup, so the same image works against any API host/port.
set -eu

: "${API_BASE_URL:=http://localhost:5000}"

envsubst '${API_BASE_URL}' \
  < /usr/share/nginx/html/config.js.template \
  > /usr/share/nginx/html/config.js
