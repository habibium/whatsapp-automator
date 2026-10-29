import { useEffect } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import {
  Link,
  Outlet,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Theme } from '@astryxdesign/core/theme'
import { LinkProvider } from '@astryxdesign/core/Link'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'

import type { QueryClient } from '@tanstack/react-query'

import { NotFound } from '@/components/not-found'
import { queryClient } from '@/lib/query-client'
import { useColorScheme } from '@/lib/theme'

interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
  notFoundComponent: NotFound,
})

function RootComponent() {
  const { preference } = useColorScheme()

  // index.html sets this inline before first paint; an inline style outranks the
  // html[data-theme] rule Astryx relies on, so it has to keep tracking the choice.
  useEffect(() => {
    document.documentElement.style.colorScheme =
      preference === 'system' ? 'light dark' : preference
  }, [preference])

  return (
    <Theme theme={neutralTheme} mode={preference}>
      <LinkProvider component={Link}>
        <QueryClientProvider client={queryClient}>
          <Outlet />
          <TanStackDevtools
            config={{
              position: 'bottom-right',
              triggerMode: 'fixed',
            }}
            plugins={[
              {
                name: 'TanStack Query',
                render: <ReactQueryDevtoolsPanel />,
              },
              {
                name: 'TanStack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        </QueryClientProvider>
      </LinkProvider>
    </Theme>
  )
}
