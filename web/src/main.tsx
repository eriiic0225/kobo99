import { ViteReactSSG } from 'vite-react-ssg'
import { HelmetProvider } from 'react-helmet-async'
import App from './App.tsx'
import './index.css'

export const createRoot = ViteReactSSG({
  routes: [{ path: '/', element: <HelmetProvider><App /></HelmetProvider> }],
})
