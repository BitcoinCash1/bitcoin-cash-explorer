FROM registry.melroy.org/melroy/docker-images/rust:1.94-node-24.14.0 AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}
ENV NODE_ENV=production

WORKDIR /build

COPY --chown=user:user . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --chown=user:user --from=backend . .
COPY --chown=user:user --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt

RUN pnpm preinstall
RUN pnpm install --prod
RUN pnpm package

FROM registry.melroy.org/melroy/docker-images/rust:1.94-node-24.14.0 AS runtime

ENV NODE_OPTIONS=--max-old-space-size=16384
ENV NODE_ENV=production

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/explorer-config-template.json /build/start.sh /build/wait-for-it.sh ./
# Rename template to explorer-config.json
RUN mv explorer-config-template.json explorer-config.json

HEALTHCHECK --interval=40s --timeout=20s --start-period=40s --retries=5 \
  CMD node package/healthcheck.js

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]

