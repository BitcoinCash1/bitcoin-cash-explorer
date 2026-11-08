# Build from source by default; CI selects the validated artifacts instead.
ARG BUILD_INPUT=builder

FROM registry.melroy.org/melroy/docker-images/debian-pnpm:26.13.0-trixie AS builder

ARG commitHash
ENV DOCKER_COMMIT_HASH=${commitHash}
ENV CYPRESS_INSTALL_BINARY=0
ENV NODE_ENV=production

WORKDIR /build
COPY . .
RUN apt-get update
RUN apt-get install -y build-essential rsync
RUN cp explorer-frontend-config.sample.json explorer-frontend-config.json
RUN pnpm install

RUN pnpm build

FROM scratch AS artifacts
COPY --from=build-artifacts / /build/dist/explorer/browser/

FROM ${BUILD_INPUT} AS build-output

FROM nginx:1.31.8-alpine AS runtime

WORKDIR /patch

COPY entrypoint.sh .
COPY wait-for .
COPY --from=build-output /build/dist/explorer /var/www/explorer
COPY nginx.conf /etc/nginx/
COPY nginx-explorer.conf /etc/nginx/conf.d/

RUN chmod +x /patch/entrypoint.sh
RUN chmod +x /patch/wait-for

RUN chown -R 1000:1000 /patch && chmod -R 755 /patch && \
        chown -R 1000:1000 /var/cache/nginx && \
        chown -R 1000:1000 /var/log/nginx && \
        chown -R 1000:1000 /etc/nginx/nginx.conf && \
        chown -R 1000:1000 /etc/nginx/conf.d && \
        chown -R 1000:1000 /var/www/explorer

RUN touch /var/run/nginx.pid && \
        chown -R 1000:1000 /var/run/nginx.pid

USER 1000

ENTRYPOINT ["/patch/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
