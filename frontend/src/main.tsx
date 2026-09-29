import { BrowserRouter } from 'react-router-dom';
import { createRoot } from 'react-dom/client';

import { AppProviders } from './app/providers';
import { AppErrorBoundary } from './app/error-boundary';
import { AppRoutes } from './app/routes';
import { Toaster } from './components/ui/toaster';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <BrowserRouter><AppErrorBoundary><AppProviders><AppRoutes /><Toaster theme="dark" richColors /></AppProviders></AppErrorBoundary></BrowserRouter>,
);
