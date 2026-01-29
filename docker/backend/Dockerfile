FROM registry.melroy.org/melroy/docker-images/rust:1.93-node-24.13.0 AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build

COPY --chown=user:user . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --chown=user:user --from=backend . .
COPY --chown=user:user --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt

RUN npm install --omit=dev --omit=optional
RUN npm run package

FROM registry.melroy.org/melroy/docker-images/rust:1.93-node-24.13.0 AS runtime

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/explorer-config-template.json /build/start.sh /build/wait-for-it.sh ./
# Rename template to explorer-config.json
RUN mv explorer-config-template.json explorer-config.json

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]

