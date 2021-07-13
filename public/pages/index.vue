<template lang="html">
  <v-container fluid class="pt-4">
    <v-row>
      <v-col xs="12" md="6" lg="4">
        <v-alert v-if="error" color="error">
          {{ error.message || error }}
        </v-alert>
        <v-row class="mb-2">
          <v-spacer />
          <v-btn class="mx-2" fab dark small color="primary" @click="fetchSchema">
            <v-icon dark>
              mdi-refresh
            </v-icon>
          </v-btn>
        </v-row>
        <v-form ref="form" v-model="formValid">
          <v-alert :value="!!compileError" type="error">
            {{ compileError }}
          </v-alert>
          <v-alert :value="!!validationErrors && formValid" type="error">
            Formulaire valide pourtant le modèle ne respecte pas le schéma:
            <p>{{ validationErrors }}</p>
          </v-alert>
          <v-jsf v-if="schema && editConfig" v-model="editConfig" :schema="schema" :options="options" @change="validate" />
        </v-form>
        <v-row class="mt-2">
          <v-spacer />
          <v-btn color="warning" @click="empty">
            Empty
          </v-btn>
        </v-row>
      </v-col>
      <v-col xs="12" md="6" lg="8">
        <v-row class="mb-2">
          <v-spacer />
          <screenshot-simulation />
          <v-btn class="mx-2" fab dark small color="primary" @click="reloadIframe">
            <v-icon dark>
              mdi-refresh
            </v-icon>
          </v-btn>
        </v-row>
        <v-card>
          <v-iframe v-if="showPreview" src="http://localhost:5888/app?draft=true" />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>

import ReconnectingWebSocket from 'reconnecting-websocket'
import VJsf from '@koumoul/vjsf/lib/VJsf.js'
import '@koumoul/vjsf/lib/VJsf.css'
// load third-party dependencies for vjsf (markdown-it, vuedraggable)
// you can also load them separately based on your needs
import '@koumoul/vjsf/lib/deps/third-party.js'
import dotProp from 'dot-prop'

import 'iframe-resizer/js/iframeResizer'
import VIframe from '@koumoul/v-iframe'
import ScreenshotSimulation from '~/components/screenshot-simulation.vue'

const Ajv = require('ajv')
const ajv = new Ajv()
ajv.addFormat('hexcolor', /^#[0-9A-Fa-f]{6,8}$/)

export default {
  components: { VIframe, VJsf, ScreenshotSimulation },
  data: () => ({
    error: null,
    schema: null,
    dataFair: null,
    editConfig: null,
    showPreview: true,
    compileError: null,
    formValid: false
  }),
  computed: {
    options() {
      // same as application-config.vue in data-fair
      return {
        context: { owner: this.dataFair && this.dataFair.owner },
        locale: 'fr',
        rootDisplay: 'expansion-panels',
        // rootDisplay: 'tabs',
        expansionPanelsProps: {
          value: 0,
          hover: true
        },
        dialogProps: {
          maxWidth: 500,
          overlayOpacity: 0 // better when inside an iframe
        },
        arrayItemCardProps: { outlined: true, tile: true },
        dialogCardProps: { outlined: true }
      }
    },
    validationErrors() {
      if (!this.schema) return
      const valid = this.validate(this.editConfig)
      return !valid && this.validate.errors
    }
  },
  async created() {
    this.dataFair = process.env.dataFair
    this.editConfig = await this.$axios.$get('http://localhost:5888/config')
    this.fetchSchema()
  },
  mounted() {
    console.log('connect to to ws://localhost:5888')
    this.socketDevServer = new ReconnectingWebSocket('ws://localhost:5888')
    this.socketDevServer.onopen = () => {
      this.socketDevServer.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.type === 'app-error') {
          this.error = data.data.message
        }
        if (data.type === 'ping') {
          this.socketDevServer.send(JSON.stringify({ type: 'pong' }))
        }
      }
    }

    window.addEventListener('message', msg => {
      console.log('received message from iframe', msg.data)
      if (msg.data.type === 'set-config') {
        this.editConfig = dotProp.set({ ...this.editConfig }, msg.data.content.field, msg.data.content.value)
      }
    })

    /* const socketApp = new WebSocket('ws://localhost:3000')
    socketApp.onmessage = (event) => {
      console.log('ws message from 5888', event.data)
    } */
  },
  destroyed() {
    console.log('destroyed')
    if (this.socketDevServer) this.socketDevServer.close()
  },
  methods: {
    async empty() {
      this.editConfig = null
      await this.save({})
      this.editConfig = {}
    },
    async validate() {
      if (this.$refs.form.validate()) {
        this.save(this.editConfig)
        this.error = null
      }
    },
    async save(config) {
      await this.$axios.$put('http://localhost:5888/config', config)
      await this.reloadIframe()
    },
    async fetchSchema() {
      this.schema = null
      this.schema = await this.$axios.$get('http://localhost:5888/app/config-schema.json')
      this.schema['x-display'] = 'tabs'
      try {
        this.validate = ajv.compile(this.schema)
        this.compileError = null
      } catch (err) {
        this.compileError = err.message
      }
    },
    async reloadIframe() {
      this.showPreview = false
      await new Promise(resolve => setTimeout(resolve, 10))
      this.showPreview = true
    }
  }
}
</script>

<style lang="css" scoped>
</style>
