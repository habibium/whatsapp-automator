import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import {
  createFileRoute,
  redirect,
  useLocation,
  useNavigate,
} from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import { api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { EmailField } from '@/components/email-field'
import { PasswordField } from '@/components/password-field'
import type { Notice } from '@/lib/notice'

import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import {
  SIGNUP_HREF,
  currentUser,
  safeRedirect,
  setSessionUser,
} from '@/lib/session'
import { stringParam } from '@/lib/search'

export const Route = createFileRoute('/signin')({
  // A plain function, not zod: route options load with every page
  validateSearch: (search): { redirect?: string } => ({
    redirect: stringParam(search.redirect),
  }),
  beforeLoad: async ({ context, search }) => {
    if (await currentUser(context.queryClient)) {
      throw redirect({ href: safeRedirect(search.redirect) })
    }
  },
  component: SignIn,
})

const signinSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z.string().min(1, 'Enter your password'),
})

const fieldNames = ['email', 'password'] as const

type Problem =
  | { kind: 'credentials' }
  | { kind: 'unverified'; email: string; isResent: boolean }
  | { kind: 'unexpected' }

function SignIn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const search = Route.useSearch()
  const notice = useLocation({ select: (location) => location.state.notice })
  const knownEmail = useLocation({ select: (location) => location.state.email })
  const [problem, setProblem] = useState<Problem | null>(null)

  const form = useForm({
    defaultValues: { email: knownEmail ?? '', password: '' },
    validators: { onSubmit: signinSchema },
    // Otherwise handleSubmit silently no-ops on an invalid form instead of surfacing the errors.
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setProblem(null),
    },
    onSubmit: async ({ value, formApi }) => {
      const email = value.email.trim()
      try {
        const { data, error, response } = await api.POST('/api/auth/signin', {
          body: { email, password: value.password },
        })
        if (data) {
          setSessionUser(queryClient, data)
          await navigate({ href: safeRedirect(search.redirect), replace: true })
          return
        }
        if (response.status === 401) {
          setProblem({ kind: 'credentials' })
        } else if (response.status === 403) {
          setProblem({ kind: 'unverified', email, isResent: false })
        } else {
          const fields = toFieldErrors(error, fieldNames)
          if (fields) formApi.setErrorMap({ onSubmit: { fields } })
          else setProblem({ kind: 'unexpected' })
        }
      } catch {
        setProblem({ kind: 'unexpected' })
      }
    },
  })

  const resendVerification = async (email: string) => {
    try {
      const { response } = await api.POST('/api/auth/resend-verification', {
        body: { email },
      })
      setProblem(
        response.ok
          ? { kind: 'unverified', email, isResent: true }
          : { kind: 'unexpected' },
      )
    } catch {
      setProblem({ kind: 'unexpected' })
    }
  }

  return (
    <AuthLayout
      title="Sign in to your account."
      description="Use the email address and password you signed up with."
      action={
        <Button label="Create account" variant="ghost" href={SIGNUP_HREF} />
      }
      footer={
        <>
          New here?{' '}
          <Link href={SIGNUP_HREF} size="sm" color="primary" hasUnderline>
            Create an account
          </Link>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <VStack gap={6}>
          {problem ? (
            <ProblemBanner
              problem={problem}
              onResend={(email) => resendVerification(email)}
            />
          ) : notice ? (
            <NoticeBanner notice={notice} />
          ) : null}

          <VStack gap={3}>
            <FormLayout defaultOptionality="required">
              <form.Field
                name="email"
                validators={{ onBlur: signinSchema.shape.email }}
              >
                {(field) => (
                  <EmailField
                    htmlName={field.name}
                    autoComplete="username"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    isInvalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    errorMessage={toStatusMessage(field.state.meta.errors)}
                  />
                )}
              </form.Field>

              <form.Field name="password">
                {(field) => (
                  <PasswordField
                    label="Password"
                    htmlName={field.name}
                    autoComplete="current-password"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    isInvalid={
                      field.state.meta.isTouched && !field.state.meta.isValid
                    }
                    errorMessage={toStatusMessage(field.state.meta.errors)}
                  />
                )}
              </form.Field>
            </FormLayout>

            {/* Carries the typed address over, so the reset form starts filled in. */}
            <form.Subscribe selector={(state) => state.values.email.trim()}>
              {(email) => (
                <HStack justify="end">
                  <Link
                    href={
                      email
                        ? `/forgot-password?email=${encodeURIComponent(email)}`
                        : '/forgot-password'
                    }
                    size="sm"
                    color="secondary"
                  >
                    Forgot your password?
                  </Link>
                </HStack>
              )}
            </form.Subscribe>
          </VStack>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                label="Sign in"
                variant="primary"
                size="lg"
                width="100%"
                isLoading={isSubmitting}
              />
            )}
          </form.Subscribe>
        </VStack>
      </form>
    </AuthLayout>
  )
}

function NoticeBanner({ notice }: { notice: Notice }) {
  return notice === 'email-verified' ? (
    <Banner
      status="success"
      title="Your email is verified."
      description="Sign in to continue."
      isDismissable
    />
  ) : (
    <Banner
      status="success"
      title="Your password is changed."
      description="Sign in with the new one. Every device that was signed in has been signed out."
      isDismissable
    />
  )
}

interface ProblemBannerProps {
  problem: Problem
  onResend: (email: string) => Promise<void>
}

function ProblemBanner({ problem, onResend }: ProblemBannerProps) {
  switch (problem.kind) {
    case 'credentials':
      return (
        <Banner
          status="error"
          title="Incorrect email or password."
          description="Check both and try again, or reset your password."
        />
      )
    case 'unverified':
      return problem.isResent ? (
        <Banner
          status="success"
          title="A new link is on its way."
          description={`Check ${problem.email}, open the link, then sign in here.`}
        />
      ) : (
        <Banner
          status="warning"
          title="Verify your email first."
          description="Open the link we emailed you, or get a new one."
          endContent={
            <Button
              label="Send a new link"
              size="sm"
              clickAction={() => onResend(problem.email)}
            />
          }
        />
      )
    case 'unexpected':
      return (
        <Banner
          status="error"
          title="Couldn't sign you in."
          description="Something went wrong on our side. Try again in a moment."
        />
      )
  }
}
