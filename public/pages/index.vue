<template lang="html">
  <v-container fluid>
    <v-row>
      <v-col xs="12" md="6" lg="4">
        <v-alert v-if="error" color="error">
          {{ error.message || error }}
        </v-alert>
        <v-jsonschema-form v-if="schema && editConfig" :schema="schema" :model="editConfig" :options="{context: {owner: dataFair.owner}}" @error="error => error = error" />
        <v-row class="mt-2">
          <v-spacer />
          <v-btn color="warning" @click="empty">
            Empty
          </v-btn>
          <v-btn color="primary" class="ml-1 mr-5" @click="save(editConfig)">
            Save
          </v-btn>
        </v-row>
      </v-col>
      <v-col xs="12" md="6" lg="8">
        <v-iframe v-if="showPreview" src="http://localhost:5889" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
import Vue from 'vue'
import VJsonschemaForm from '@koumoul/vuetify-jsonschema-form/lib/index.vue'
import '@koumoul/vuetify-jsonschema-form/dist/main.css'
import 'iframe-resizer/js/iframeResizer'
import VIframe from '@koumoul/v-iframe'

if (process.browser) {
  const Swatches = require('vue-swatches').default
  Vue.component('swatches', Swatches)
  require('vue-swatches/dist/vue-swatches.min.css')
  const Draggable = require('vuedraggable')
  Vue.component('draggable', Draggable)
  const Sketch = require('vue-color').Sketch
  Vue.component('color-picker', Sketch)
}

export default {
  components: { VIframe, VJsonschemaForm },
  data: () => ({
    error: null,
    schema: null,
    dataFair: null,
    editConfig: null,
    showPreview: true
  }),
  async created() {
    this.dataFair = process.env.dataFair
    this.schema = await this.$axios.$get('http://localhost:5889/config-schema.json')
    this.editConfig = await this.$axios.$get('http://localhost:5888/config')
  },
  methods: {
    async empty() {
      this.showPreview = false
      this.editConfig = null
      await new Promise(resolve => setTimeout(resolve, 100))
      this.editConfig = {}
      this.showPreview = true
    },
    async save(config) {
      this.showPreview = false
      await this.$axios.$put('http://localhost:5888/config', config)
      this.showPreview = true
    }
  }
}
</script>

<style lang="css" scoped>
</style>
