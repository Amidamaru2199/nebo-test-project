import { createApp } from 'vue';
import { createPinia } from 'pinia';
import { createYmaps } from 'vue-yandex-maps';
import App from './App.vue';

const pinia = createPinia();
const app = createApp(App);

app.use(
  createYmaps({
    apikey: '3871f9c2-60a7-48f4-9b70-0eed3957290c',
    lang: 'ru_RU',
    version: '3.0',
    strictMode: true,
  }),
);

app.use(pinia);
app.mount('#app');
