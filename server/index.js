const path = require('path')
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../config')
const config = require('config')
const app = require('./app')

app.run().then(app => {
  console.log('DataFair dev server listening on http://localhost:%s', config.port)
}, error => {
  console.error('Failure in customers process', error)
  process.exit(-1)
})

process.on('SIGTERM', function onSigterm () {
  console.info('Received SIGTERM signal, shutdown gracefully...')
  app.stop().then(() => {
    console.log('shutting down now')
    process.exit()
  }, err => {
    console.error('Failure while stopping service', err)
    process.exit(-1)
  })
})
