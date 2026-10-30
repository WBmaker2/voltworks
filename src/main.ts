import './styles/main.css';
import { App } from './app/App';

const root = document.getElementById('app');
if (!root) throw new Error('App root is missing.');

const app = new App(root);
window.addEventListener('pagehide', () => {
  app.destroy();
});
