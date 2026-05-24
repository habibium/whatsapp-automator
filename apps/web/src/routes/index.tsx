import { createFileRoute } from '@tanstack/react-router'
import { Button } from '~/components/ui/button'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <Button>Click</Button>
      <Button variant="destructive">Click</Button>
      <Button variant="ghost">Click</Button>
      <Button variant="link">Click</Button>
      <Button variant="outline">Click</Button>
      <Button variant="secondary">Click</Button>
    </div>
  )
}
