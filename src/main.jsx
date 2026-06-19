import React from 'react'
import ReactDOM from 'react-dom/client'
import './styles/theme.css'
import { StoreProvider } from './store/store.jsx'
import App from './App.jsx'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </React.StrictMode>,
)
