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
const parse5 = require('parse5')
const WebSocket = require('ws')
const debug = require('debug')('df-dev-server')

const app = express()
const server = http.createServer(app)

const wss = new WebSocket.Server({ server })
let ws
wss.on('connection', (_ws) => {
  if (ws) ws.terminate()
  ws = _ws

  ws.on('message', function incoming(message) {
    if (!message.includes('"pong"')) console.log('received: %s', message)
  })
  ws.send(JSON.stringify({ type: 'ping' }))
})

app.use(bodyParser.json())
app.use(cors())

// very basic CRUD of config
app.get('/config', (req, res, next) => {
  const devConfig = fs.existsSync('.dev-config.json') ? fs.readJsonSync('.dev-config.json') : {}
  debug('read dev config', devConfig)
  res.send(devConfig)
})
app.put('/config', (req, res, next) => {
  debug('save dev config', req.body)
  fs.writeJsonSync('.dev-config.json', req.body, { spaces: 2 })
  res.send(req.body)
})
app.post('/config/error', (req, res) => {
  console.log('Application sent an error', req.body)
  if (ws) ws.send(JSON.stringify({ type: 'app-error', data: req.body }))
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
    const configuration = fs.existsSync('.dev-config.json') ? fs.readJsonSync('.dev-config.json') : {}
    // console.log('inject config', configuration)
    let body = ''
    proxyRes.on('data', (data) => { body += data.toString() })
    proxyRes.on('end', () => {
      try {
        let output = body
        if (body.includes('%APPLICATION%')) {
          const document = parse5.parse(body.replace(/%APPLICATION%/g, JSON.stringify({
            id: 'dev-application',
            title: 'Dev application',
            configuration,
            exposedUrl: 'http://localhost:5888/app',
            href: 'http://localhost:5888/config',
            apiUrl: 'http://localhost:5888/data-fair/api/v1',
            wsUrl: 'ws://localhost:5888/data-fair'
          })))
          const html = document.childNodes.find(c => c.tagName === 'html')
          if (!html) throw new Error('HTML structure is broken, expect html, head and body elements')
          const headNode = html.childNodes.find(c => c.tagName === 'head')
          const bodyNode = html.childNodes.find(c => c.tagName === 'body')
          if (!headNode || !bodyNode) throw new Error('HTML structure is broken, expect html, head and body elements')

          // ad a script to simulate instrumentation by capture service
          if (req.query.capture === 'true') {
            headNode.childNodes.push({
              nodeName: 'script',
              tagName: 'script',
              attrs: [{ name: 'type', value: 'text/javascript' }],
              childNodes: [{
                nodeName: '#text',
                value: `
console.log('[capture] Simulate a screenshot capture context')
var triggerCalled = false
window.triggerCapture = function (animationSupported) {
  triggerCalled = true
  console.log('[capture] triggerCapture called')
  if (animationSupported) {
    console.log('[capture] this application supports animated screenshots')
    var i = 0
    const interval = setInterval(function () {
      i++
      if (i === 1800) {
        console.error('[capture] stop after the maximum number of frames was attained')
        clearInterval(interval)
      }
      var stopped = window.animateCaptureFrame()
      if (stopped) {
        console.log('[capture] animation was stopped after ' + i + ' frames')
        clearInterval(interval)
      }
    }, 67)
    return true
  } else {
    console.log('[capture] this application does not support animated screenshots')
  }
}
setTimeout(function() {
  if (!triggerCalled) {
    console.error('[capture] triggerCapture was not called after a 5s wait')
  }
}, 5000)
                `
              }]
            })
          }

          output = parse5.serialize(document)

          // proxyRes.headers['content-length'] = output.length
          delete proxyRes.headers['content-length']
          delete proxyRes.headers['last-modified']
          delete proxyRes.headers['max-age']
          delete proxyRes.headers.etag
          proxyRes.headers['cache-control'] = 'no-cache'
        }
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        res.end(output)
      } catch (err) {
        console.error(err)
        res.writeHead(500)
        res.end(err.message)
      }
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
    proxyReq.setHeader('cookie', '')
    if (config.dataFair.apiKey) proxyReq.setHeader('x-apiKey', config.dataFair.apiKey)
  },
  onProxyRes (proxyRes, req, res) {
    if (proxyRes.headers['content-type'] && proxyRes.headers['content-type'].startsWith('application/json')) {
      let body = ''
      proxyRes.on('data', (data) => { body += data.toString() })
      proxyRes.on('end', () => {
        const output = body.replace(new RegExp(escapeStringRegexp(config.dataFair.url), 'g'), 'http://localhost:5888/data-fair')
        // proxyRes.headers['content-length'] = output.length
        delete proxyRes.headers['content-length']
        res.writeHead(proxyRes.statusCode, proxyRes.headers)
        // make all references to data-fair url point to local proxy
        res.end(output)
      })
    } else {
      res.writeHead(proxyRes.statusCode, proxyRes.headers)
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
    const nuxtConfigInject = require('@koumoul/nuxt-config-inject')
    const distOrigin = path.join(__dirname, '..', 'dist')
    const distConfig = path.join(__dirname, '..', 'dist-config')
    await fs.remove(distConfig)
    await fs.copy(distOrigin, distConfig)
    nuxtConfigInject.replace(config, [distConfig + '/**/*'])
    app.use(express.static(distConfig))
  }
  server.listen(config.port)
  await eventToPromise(server, 'listening')
  if (process.env.NODE_ENV !== 'development') open('http://localhost:5888')
  return server
}

exports.stop = async() => {
  if (spawnedDevSrc) kill(spawnedDevSrc.pid)
  if (ws) ws.terminate()
  server.close()
  await eventToPromise(server, 'close')
  await app.get('client').close()
}
