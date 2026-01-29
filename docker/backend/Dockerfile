FROM registry.melroy.org/melroy/docker-images/rust:1.93-node-24.13.0 AS builder

ARG commitHash
ENV MEMPOOL_COMMIT_HASH=${commitHash}

WORKDIR /build

COPY . .

ENV PATH="/usr/local/cargo/bin:$PATH"

COPY --from=backend . .
COPY --from=rustgbt . ../rust/
ENV FD=/build/rust-gbt
RUN npm install --omit=dev --omit=optional

WORKDIR /build
RUN npm run package

FROM registry.melroy.org/melroy/docker-images/rust:1.93-node-24.13.0 AS runtime

WORKDIR /backend

RUN chown 1000:1000 ./
COPY --from=builder --chown=1000:1000 /build/package ./package/
COPY --from=builder --chown=1000:1000 /build/explorer-config.json /build/start.sh /build/wait-for-it.sh ./

USER 1000

EXPOSE 8999

CMD ["/backend/start.sh"]

