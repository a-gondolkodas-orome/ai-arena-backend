# Check out https://hub.docker.com/_/node to select a new base image
FROM node:lts-slim

USER root

RUN apt update && apt install -y zip g++ && rm -rf /var/lib/apt/lists/*

# Set to a non-root built-in user `node`
USER node

# Create app directory (with user `node`)
RUN mkdir -p /home/node/app

WORKDIR /home/node/app

# Install app dependencies
COPY --chown=node .yarn ./.yarn
COPY --chown=node .yarnrc.yml yarn.lock package.json ./

RUN yarn install --immutable

# Bundle app source code
COPY --chown=node . .

RUN yarn run build

# Bind to all network interfaces so that it can be mapped to the host OS
ENV HOST=0.0.0.0 PORT=3000
ENV NODE_ENV=production

EXPOSE ${PORT}

LABEL org.opencontainers.image.source=https://github.com/a-gondolkodas-orome/ai-arena-backend
