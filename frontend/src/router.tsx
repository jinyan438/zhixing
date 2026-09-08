import { lazy } from 'react'
import { createBrowserRouter, Navigate } from 'react-router-dom'

import { WatchlistLayout } from './components/WatchlistLayout'
import { finalizeFrontendExtensions } from './extensions/registry'
import { Auth } from './pages/Auth'
import { Onboarding } from './pages/Onboarding'

const Watchlist = lazy(() => import('./pages/Watchlist').then(module => ({ default: module.Watchlist })))
const Settings = lazy(() => import('./pages/Settings').then(module => ({ default: module.Settings })))

const CORE_ROUTE_PATHS = new Set([
  '/',
  '/onboarding',
  '/login',
  '/watchlist',
  '/settings',
])

finalizeFrontendExtensions(CORE_ROUTE_PATHS)

export const router = createBrowserRouter([
  { path: '/onboarding', element: <Onboarding /> },
  { path: '/login', element: <Auth /> },
  {
    path: '/',
    element: <WatchlistLayout />,
    children: [
      { index: true, element: <Navigate to="/watchlist" replace /> },
      { path: 'watchlist', element: <Watchlist /> },
      { path: 'settings', element: <Settings /> },
      { path: '*', element: <Navigate to="/watchlist" replace /> },
    ],
  },
])
