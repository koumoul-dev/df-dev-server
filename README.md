# df-dev-server

A development server for optimal development experience of data-fair applications.

## Usage

See [data-fair-charts](https://github.com/koumoul-dev/data-fair-charts/blob/master/package.json) for an example with nuxt.
See [data-fair-minimal](https://github.com/koumoul-dev/data-fair-minimal/blob/master/package.json) for an example with a simple http server.

## Development

Run development server :

```
npm run dev

```

Run publishable server :

```
DEBUG=nuxt-config-inject npm run prepublish
DEBUG=nuxt-config-inject NODE_ENV=production node server/index.js
```
