import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import router from './router'; // Vue Routerのインポート

import './assets/css/reset.css';

//アプリの作成
const app = createApp(App);

const pinia = createPinia();

app.use(pinia);
app.use(router);

// アプリのマウント
app.mount('#app');
