import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import {GoogleAuthProvider} from '@react-oauth/google';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <GoogleAuthProvider clientId={process.env.GOOGLE_CLIENT_ID}>
      <App />
    </GoogleAuthProvider>
  </StrictMode>,
)
