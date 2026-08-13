FROM nginx:1.27-alpine

ENV API_BASE_URL=http://localhost:5000

COPY index.html about.html privacy.html style.css app.js config.js.template manifest.webmanifest sw.js /usr/share/nginx/html/
COPY icon.svg favicon.ico favicon-32.png apple-touch-icon.png icon-192.png icon-512.png /usr/share/nginx/html/
COPY docker-entrypoint.d/40-envsubst-config.sh /docker-entrypoint.d/40-envsubst-config.sh
RUN chmod +x /docker-entrypoint.d/40-envsubst-config.sh

EXPOSE 80
