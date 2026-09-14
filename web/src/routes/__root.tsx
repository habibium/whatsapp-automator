import { useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Link, Outlet, createRootRoute } from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { Theme } from '@astryxdesign/core/theme'
import { LinkProvider } from '@astryxdesign/core/Link'
import { neutralTheme } from '@astryxdesign/theme-neutral/built'

import { useColorScheme } from '@/lib/theme'

export const Route = createRootRoute({
  component: RootComponent,
})

const queryClient = new QueryClient()

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
