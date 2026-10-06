/**
 * plugins/index.ts
 *
 * Automatically included in `./src/main.ts`
 */

// Types

// Plugins
import vuetify from './vuetify'

export function registerPlugins (app) {
  app.use(vuetify)
}
