#!/usr/bin/env node

const chalk = require('chalk')
const path = require('path')
process.env.NODE_CONFIG_DIR = path.join(__dirname, '../config')
const config = require('config')
const app = require('./app')

app.run().then(app => {
  console.log(chalk.blue('\nDataFair dev server available on ') + chalk.underline.bold.blue(`http://localhost:${config.port}\n`))
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
