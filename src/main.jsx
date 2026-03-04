import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Load Instagram embed script once
const script = document.createElement('script')
script.src = '//www.instagram.com/embed.js'
script.async = true
script.onload = () => {
  // Re-process embeds when script loads
  if (window.instgrm) {
    window.instgrm.Embeds.process()
  }
}
document.head.appendChild(script)

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
