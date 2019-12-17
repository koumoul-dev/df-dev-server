// Express app for TaxMan own API and UI
const path = require('path')
const { spawn } = require('child_process')
const express = require('express')
const bodyParser = require('body-parser')
const config = require('config')
const eventToPromise = require('event-to-promise')
const http = require('http')
const fs = require('fs-extra')
const bs = require('browser-sync').create()
const proxy = require('http-proxy-middleware')
const { Nuxt, Builder } = require('nuxt')

const app = express()
app.use(bodyParser.json())

app.get('/config', (req, res, next) => {
  res.send(fs.existsSync('.dev-config.json') ? fs.readJsonSync('.dev-config.json') : {})
})
app.put('/config', (req, res, next) => {
  fs.writeJsonSync('.dev-config.json', req.body, { spaces: 2 })
  res.send(req.body)
})
app.post('/config/error', (req, res) => {
  console.log('Application sent an error', req.body)
  res.send()
})

// re-expose a data-fair instance to access datasets, etc.
app.use('/data-fair', proxy({
  target: config.dataFair.domain,
  pathRewrite: { '^/data-fair': config.dataFair.path },
  secure: false,
  changeOrigin: true,
  ws: true,
  logLevel: 'error'
}))

// livereload on the app source code
bs.init({
  server: config.targetDirectory,
  files: [`${config.targetDirectory}/**/*.{html,js,css}`],
  online: false,
  open: false,
  port: config.port + 1,
  ui: false,
  cors: true,
  logLevel: 'silent',
  middleware: [(req, res, next) => {
    if (req.originalUrl === '/') {
      const configuration = fs.existsSync('.dev-config.json') ? fs.readJsonSync('.dev-config.json') : {}
      const index = fs.readFileSync(`${config.targetDirectory}/index.html`, 'utf8')
      res.end(index.replace(/%APPLICATION%/g, JSON.stringify({
        configuration,
        exposedUrl: 'http://localhost:5889',
        href: 'http://localhost:5888/config'
      })))
    } else {
      next()
    }
  }]
})

// run the dev-src command from current project
if (fs.existsSync('package.json')) {
  const pJson = fs.readJsonSync('package.json')
  if (pJson.scripts && pJson.scripts['dev-src']) {
    spawn('npm', ['run', 'dev-src'], { stdio: 'inherit' })
  }
}

// Run app and return it in a promise
const server = http.createServer(app)
exports.run = async () => {
  if (process.env.NODE_ENV === 'development') {
    const nuxtConfig = require('../nuxt.config.js')
    nuxtConfig.dev = true
    const nuxt = new Nuxt(nuxtConfig)
    app.use(nuxt.render)
    await new Builder(nuxt).build()
  } else {
    app.use(express.static(path.join(__dirname, 'dist')))
  }
  server.listen(config.port)
  await eventToPromise(server, 'listening')
  return server
}

exports.stop = async() => {
  server.close()
  await eventToPromise(server, 'close')
  await app.get('client').close()
}
