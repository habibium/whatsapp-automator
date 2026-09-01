import { Button } from '@/components/ui/button'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/hello')
      .then((res) => res.text())
      .then((data) => {
        setMessage(data)
      })
  }, [])

  return (
    <div className="p-8">
      <h1 className="text-4xl font-bold">Welcome to TanStack Start</h1>
      <p className="mt-4 text-lg">
        Edit <code>src/routes/index.tsx</code> to get started.
      </p>
      <Button>Click me</Button>
      <p className="mt-4 text-lg text-red-500">{message}</p>
    </div>
  )
}
