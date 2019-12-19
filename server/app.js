// Express app for TaxMan own API and UI
const path = require('path')
const { spawn } = require('child_process')
const express = require('express')
const bodyParser = require('body-parser')
const config = require('config')
const eventToPromise = require('event-to-promise')
const http = require('http')
const fs = require('fs-extra')
const proxy = require('http-proxy-middleware')
const cors = require('cors')
const open = require('open')
const kill = require('tree-kill')
const escapeStringRegexp = require('escape-string-regexp')

const app = express()
const server = http.createServer(app)
app.use(bodyParser.json())
app.use(cors())

// very basic CRUD of config
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

// re-expose the application performing similar modifications to the body as data-fair
const appUrl = new URL(config.app.url)
app.use('/app', proxy({
  target: appUrl.origin,
  pathRewrite: { '^/app': '' },
  secure: false,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true, // so that the onProxyRes takes care of sending the response
  onProxyRes (proxyRes, req, res) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    const configuration = fs.existsSync('.dev-config.json') ? fs.readJsonSync('.dev-config.json') : {}
    let body = ''
    proxyRes.on('data', (data) => { body += data.toString() })
    proxyRes.on('end', () => {
      res.end(body.replace(/%APPLICATION%/g, JSON.stringify({
        id: 'dev-application',
        title: 'Dev application',
        configuration,
        exposedUrl: 'http://localhost:5888/app',
        href: 'http://localhost:5888/config',
        apiUrl: 'http://localhost:5888/data-fair/api/v1',
        wsUrl: 'ws://localhost:5888/data-fair'
      })))
    })
  }
}))

// re-expose a data-fair instance to access datasets, etc.
const dfUrl = new URL(config.dataFair.url)
app.use('/data-fair', proxy({
  target: dfUrl.origin,
  pathRewrite: { '^/data-fair': dfUrl.pathname },
  secure: false,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true, // so that the onProxyRes takes care of sending the response
  onProxyReq(proxyReq) {
    // no gzip so that we can process the content
    proxyReq.setHeader('accept-encoding', 'identity')
  },
  onProxyRes (proxyRes, req, res) {
    res.writeHead(proxyRes.statusCode, proxyRes.headers)
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].startsWith('application/json')) {
      let body = ''
      proxyRes.on('data', (data) => { body += data.toString() })
      proxyRes.on('end', () => {
        body = body.toString()
        // make all references to data-fair url point to local proxy
        res.end(body.replace(new RegExp(escapeStringRegexp(config.dataFair.url), 'g'), 'http://localhost:5888/data-fair'))
      })
    } else {
      proxyRes.pipe(res)
    }
  }
}))

// run the dev-src command from current project
let spawnedDevSrc
if (fs.existsSync('package.json')) {
  const pJson = fs.readJsonSync('package.json')
  if (pJson.scripts && pJson.scripts['dev-src']) {
    spawnedDevSrc = spawn('npm', ['run', 'dev-src'], { stdio: 'inherit' }).on('error', () => {})
  } else {
    console.error('No script "dev-src" in package.json')
  }
}

// Run app and return it in a promise
exports.run = async () => {
  if (process.env.NODE_ENV === 'development') {
    const { Nuxt, Builder } = require('nuxt')
    const nuxtConfig = require('../nuxt.config.js')
    nuxtConfig.dev = true
    const nuxt = new Nuxt(nuxtConfig)
    app.use(nuxt.render)
    await new Builder(nuxt).build()
  } else {
    app.use(express.static(path.join(__dirname, '..', 'dist')))
  }
  server.listen(config.port)
  await eventToPromise(server, 'listening')
  if (process.env.NODE_ENV !== 'development') open('http://localhost:5888')
  return server
}

exports.stop = async() => {
  if (spawnedDevSrc) kill(spawnedDevSrc.pid)
  server.close()
  await eventToPromise(server, 'close')
  await app.get('client').close()
}
