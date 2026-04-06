// src/main.jsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/layout.css'
import { initTheme } from './lib/theme'

initTheme() //  initialize theme on app start

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>
)
