FROM registry.melroy.org/melroy/docker-images/rust:1.95-node-24.15.0 AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}
ENV NODE_ENV=production

WORKDIR /build

COPY --chown=user:user . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --chown=user:user --from=backend . .
COPY --chown=user:user --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt

# Create the rust-gbt directory placeholder, before running pnpm preinstall, which could also trigger a pnpm install
RUN mkdir rust-gbt

RUN pnpm preinstall
# pnpm v11 caches install state here; deleting it forces re-linking of the freshly built rust-gbt binary.
RUN rm -rf node_modules/.pnpm-workspace-state-v1.json
RUN pnpm install --prod
RUN pnpm package

FROM registry.melroy.org/melroy/docker-images/rust:1.95-node-24.15.0 AS runtime

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

