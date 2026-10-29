import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@astryxdesign/core/Button'
import { Link } from '@astryxdesign/core/Link'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'

import { api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { EmailRequestForm } from '@/components/email-request-form'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'
import { HOME_HREF, SIGNIN_HREF, setSessionUser } from '@/lib/session'
import { stringParam } from '@/lib/search'

export const Route = createFileRoute('/verify-email')({
  // A plain function, not zod: route options load with every page
  validateSearch: (search): { token?: string } => ({
    token: stringParam(search.token),
  }),
  component: VerifyEmail,
})

function VerifyEmail() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const verify = useMutation({
    mutationFn: async (value: string) => {
      const { data, response } = await api.POST('/api/auth/verify-email', {
        body: { token: value },
      })
      return {
        verified: data ?? null,
        status: response.status,
        retryAfter: retryAfterSeconds(response),
      }
    },
    // Replacing this history entry drops the spent token, so Back cannot replay it
    onSuccess: async ({ verified }) => {
      if (!verified) return
      if (verified.signed_in) {
        setSessionUser(queryClient, verified.user)
        await navigate({
          to: HOME_HREF,
          replace: true,
          state: { notice: 'email-verified' },
        })
      } else {
        await navigate({
          to: SIGNIN_HREF,
          replace: true,
          state: { notice: 'email-verified', email: verified.user.email },
        })
      }
    },
  })
  const { mutate } = verify

  // The token is single-use, so a re-run effect must not spend it twice.
  const spentToken = useRef<string | null>(null)
  useEffect(() => {
    if (token && spentToken.current !== token) {
      spentToken.current = token
      mutate(token)
    }
  }, [token, mutate])

  if (!token) return <RequestNewLink isIncomplete />

  if (verify.data?.status === 400) return <RequestNewLink />

  if (verify.isError || (verify.data && !verify.data.verified)) {
    const isRateLimited = verify.data?.status === 429
    return (
      <AuthLayout
        title={
          isRateLimited ? TOO_MANY_ATTEMPTS : "We couldn't check this link."
        }
        description={
          isRateLimited
            ? tryAgainIn(verify.data?.retryAfter)
            : 'Something went wrong on our side, not with the link. Try again in a moment.'
        }
      >
        <Button
          label="Try again"
          variant="primary"
          size="lg"
          width="100%"
          onClick={() => mutate(token)}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Verifying your email."
      description="This only takes a moment."
    >
      <Spinner size="lg" aria-label="Verifying your email" />
    </AuthLayout>
  )
}

function RequestNewLink({ isIncomplete = false }: { isIncomplete?: boolean }) {
  const [sentTo, setSentTo] = useState<string | null>(null)

  const signIn = <Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />
  const footer = (
    <>
      Already verified?{' '}
      <Link href={SIGNIN_HREF} size="sm" color="primary" hasUnderline>
        Sign in
      </Link>
    </>
  )

  if (sentTo) {
    return (
      <AuthLayout
        title="Check your inbox."
        description={
          <>
            If <Text weight="medium">{sentTo}</Text> still needs verifying, a
            new link is on its way.
          </>
        }
        action={signIn}
        footer={footer}
      >
        <Text color="secondary">
          It works for 24 hours. If nothing arrives in a few minutes, check your
          spam folder.
        </Text>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title={
        isIncomplete ? 'This link is incomplete.' : 'This link no longer works.'
      }
      description={
        isIncomplete
          ? "Part of it is missing. Enter your email and we'll send a complete one."
          : "Verification links work once and expire after 24 hours. Enter your email and we'll send a new one."
      }
      action={signIn}
      footer={footer}
    >
      <EmailRequestForm
        submitLabel="Send a new link"
        request={(email) =>
          api.POST('/api/auth/resend-verification', { body: { email } })
        }
        onSent={setSentTo}
      />
    </AuthLayout>
  )
}
