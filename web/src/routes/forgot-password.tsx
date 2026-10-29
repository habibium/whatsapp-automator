import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'

import { api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { EmailRequestForm } from '@/components/email-request-form'
import { SIGNIN_HREF } from '@/lib/session'
import { stringParam } from '@/lib/search'

export const Route = createFileRoute('/forgot-password')({
  // A plain function, not zod: route options load with every page
  validateSearch: (search): { email?: string } => ({
    email: stringParam(search.email),
  }),
  component: ForgotPassword,
})

const signIn = <Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />

function ForgotPassword() {
  const search = Route.useSearch()
  const [email, setEmail] = useState(search.email ?? '')
  const [isSent, setIsSent] = useState(false)

  if (isSent) {
    return (
      <AuthLayout
        title="Check your inbox."
        description={
          <>
            If <Text weight="medium">{email}</Text> has an account, we sent it a
            link to choose a new password.
          </>
        }
        action={signIn}
      >
        <VStack gap={5}>
          <Text color="secondary">
            The link works once and expires in an hour. If nothing arrives in a
            few minutes, check your spam folder.
          </Text>
          <VStack gap={2}>
            <Button
              label="Back to sign in"
              variant="primary"
              size="lg"
              width="100%"
              href={SIGNIN_HREF}
            />
            <Button
              label="Use a different email"
              variant="ghost"
              size="lg"
              width="100%"
              onClick={() => setIsSent(false)}
            />
          </VStack>
        </VStack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Reset your password."
      description="Enter the email address you signed up with, and we'll send a link to choose a new password."
      action={signIn}
      footer={
        <>
          Remembered it?{' '}
          <Link href={SIGNIN_HREF} size="sm" color="primary" hasUnderline>
            Sign in
          </Link>
        </>
      }
    >
      <EmailRequestForm
        defaultEmail={email}
        submitLabel="Send reset link"
        request={(address) =>
          api.POST('/api/auth/forgot-password', { body: { email: address } })
        }
        onSent={(address) => {
          setEmail(address)
          setIsSent(true)
        }}
      />
    </AuthLayout>
  )
}
