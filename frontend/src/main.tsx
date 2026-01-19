import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// StrictMode removed - it causes WebSocket connection instability
// due to double mount/unmount in development mode
createRoot(document.getElementById('root')!).render(<App />)
