import { createApp } from 'vue'
import { registerPlugins } from '@/plugins'
import AccessGate from './components/AccessGate.vue'
import 'unfonts.css'
import './styles/main.css'

const app = createApp(AccessGate)
registerPlugins(app)
app.mount('#app')
