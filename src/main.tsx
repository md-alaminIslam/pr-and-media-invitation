import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { applyAppZoom } from './ui/zoom';

applyAppZoom();

createRoot(document.getElementById('root')!).render(<App />);
