import { createApp } from 'vue';
import App from './App.vue';
import { setupRouter } from './router';
import './styles/global.scss';

const app = createApp(App);

setupRouter(app);
app.mount('#app');
