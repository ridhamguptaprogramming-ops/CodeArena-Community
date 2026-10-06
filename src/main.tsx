/* @refresh reload */
import { render } from 'solid-js/web';
import { injectSpeedInsights } from '@vercel/speed-insights';
import './index.css';
import App from './app/App';

// Initialize Vercel Speed Insights
injectSpeedInsights();

const root = document.getElementById('root');

if (root) {
  render(() => <App />, root);
}
