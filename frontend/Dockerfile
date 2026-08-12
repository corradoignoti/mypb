FROM nginx:1.27-alpine

ENV API_BASE_URL=http://localhost:5000

COPY index.html style.css app.js config.js.template /usr/share/nginx/html/
COPY docker-entrypoint.d/40-envsubst-config.sh /docker-entrypoint.d/40-envsubst-config.sh
RUN chmod +x /docker-entrypoint.d/40-envsubst-config.sh

EXPOSE 80
