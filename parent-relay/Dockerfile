FROM node:22-alpine

RUN apk add --no-cache wget curl tini

RUN addgroup -g 1000 ctg && \
    adduser -u 1000 -G ctg -s /bin/sh -D ctg

WORKDIR /app

COPY --chown=ctg:ctg package.json ./
COPY --chown=ctg:ctg index.js ./

USER ctg

EXPOSE 9090

ENTRYPOINT ["tini", "--"]
CMD ["node", "index.js"]
