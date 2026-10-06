import { createVuetify } from 'vuetify'
import '@mdi/font/css/materialdesignicons.css'
import 'vuetify/styles'

export default createVuetify({
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        colors: {
          primary: '#294f3d',
          background: '#f8f7f2',
          surface: '#ffffff'
        }
      }
    }
  }
})
