<template>
  <v-dialog v-model="dialog" scrollable max-width="500px">
    <template v-slot:activator="{on}">
      <v-btn color="primary" text v-on="on">
        Simulate screenshot
      </v-btn>
    </template>
    <v-card>
      <v-card-title primary-title>
        Screenshot simulation
      </v-card-title>
      <v-card-text>
        <p>The screenshot will be rendered in a box of 800x450 pixels.</p>
        <p>For guidance look for messages prefixed with "[capture]" in your browser developper's console.</p>
        <v-iframe v-if="dialog" width="800" height="450" style="border: 1px solid grey;" src="http://localhost:5888/app?capture=true" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script>
import VIframe from '@koumoul/v-iframe'

export default {
  components: { VIframe },
  data() {
    return { dialog: false }
  }
}
</script>

<style lang="css" scoped>
</style>
