# AI Arena - backend [![Node.js CI](https://github.com/leanil/ai-arena-backend/actions/workflows/CI.yml/badge.svg)](https://github.com/leanil/ai-arena-backend/actions/workflows/CI.yml)

This application is generated using [LoopBack 4 CLI](https://loopback.io/doc/en/lb4/Command-line-interface.html) with the
[initial project layout](https://loopback.io/doc/en/lb4/Loopback-application-layout.html).

## Setup

Install NVM (Node Version Manager)
* Linux https://github.com/nvm-sh/nvm#installing-and-updating
* Windows https://github.com/coreybutler/nvm-windows#installation--upgrades

Install the latest (Long Term Support) version of Node.js
* Linux `nvm install --lts`
* Windows `nvm install lts`

Install yarn (package manager): https://yarnpkg.com/getting-started/install

Clone the repository: `git clone https://github.com/leanil/ai-arena-backend.git`

Install the dependencies: run `yarn` in the repo directoy (`ai-arena-backend`)

## Run the application

```sh
yarn start
```

You can also run `node .` to skip the build step.

Open http://127.0.0.1:3000 in your browser.

## Rebuild the project

To incrementally build the project:

```sh
yarn run build
```

To force a full build by cleaning up cached artifacts:

```sh
yarn run rebuild
```

## Fix code style and formatting issues

```sh
yarn run lint
```

To automatically fix such issues:

```sh
yarn run lint:fix
```

## Other useful commands

- `yarn run migrate`: Migrate database schemas for models
- `yarn run openapi-spec`: Generate OpenAPI spec into a file
- `yarn run docker:build`: Build a Docker image for this application
- `yarn run docker:run`: Run this application inside a Docker container

## Tests

```sh
yarn test
```

## What's next

Please check out [LoopBack 4 documentation](https://loopback.io/doc/en/lb4/) to
understand how you can continue to add features to this application.

[![LoopBack](<https://github.com/loopbackio/loopback-next/raw/master/docs/site/imgs/branding/Powered-by-LoopBack-Badge-(blue)-@2x.png>)](http://loopback.io/)
