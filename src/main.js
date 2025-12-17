import { createApp } from 'vue'
import 'lineicons/dist/lineicons.css'
import './styles/global.css'
import App from './App.vue'
import router from './router'

const app = createApp(App)

app.use(router)

app.mount('#app')
