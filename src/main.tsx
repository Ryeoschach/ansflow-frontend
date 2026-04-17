import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './locales/i18n'  // i18n 初始化
import App from './App.tsx'
import { StyleProvider } from '@ant-design/cssinjs'

import { BrowserRouter } from 'react-router-dom'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StyleProvider layer>
      <BrowserRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <App />
      </BrowserRouter>
    </StyleProvider>
  </StrictMode >,
)
