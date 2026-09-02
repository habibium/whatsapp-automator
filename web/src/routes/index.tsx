import { $api } from '@/api/client'
import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const { data: message } = $api.useQuery('get', '/api/hello', {
    parseAs: 'text',
  })

  const { data: json } = $api.useQuery('get', '/api/pets/{id}', {
    params: { path: { id: 1 } },
  })

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <Button>Click me</Button>
      <p className="mt-4 text-lg text-red-500">{message}</p>
      <pre>{JSON.stringify(json, null, 2)}</pre>
    </div>
  )
}
