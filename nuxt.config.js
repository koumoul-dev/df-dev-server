const config = require('config')

module.exports = {
  mode: 'spa',
  srcDir: 'public/',
  modules: ['@nuxtjs/axios'],
  axios: {
    browserBaseURL: 'http://localhost:5888/data-fair'
  },
  buildModules: ['@nuxtjs/vuetify'],
  vuetify: {
    theme: {
      themes: {
        light: {
          primary: '#1E88E5', // colors.blue.darken1
          accent: '#F57C00', // colors.orange.darken2
          warning: '#F57C00' // colors.orange.darken2
        }
      }
    }
  },
  env: { app: config.app, dataFair: config.dataFair },
  head: {
    title: 'DataFair - Dev server',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { hid: 'application', name: 'application-name', content: 'DataFair - Dev server' },
      { hid: 'description', name: 'description', content: 'A development server for optimal development experience of data-fair applications.' },
      { hid: 'robots', name: 'robots', content: 'noindex' }
    ]
  }
}
