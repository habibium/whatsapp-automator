import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import { api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { PasswordField } from '@/components/password-field'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'
import { SIGNIN_HREF, setSessionUser } from '@/lib/session'
import { stringParam } from '@/lib/search'

export const Route = createFileRoute('/reset-password')({
  // A plain function, not zod: route options load with every page
  validateSearch: (search): { token?: string } => ({
    token: stringParam(search.token),
  }),
  component: ResetPassword,
})

const FORGOT_PASSWORD_HREF = '/forgot-password'

const resetSchema = z.object({
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

const fieldNames = ['password'] as const

type Problem =
  | { kind: 'rate-limited'; retryAfter?: number }
  | { kind: 'failed' }

function ResetPassword() {
  const { token } = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [isExpired, setIsExpired] = useState(false)
  const [problem, setProblem] = useState<Problem | null>(null)

  const form = useForm({
    defaultValues: { password: '' },
    validators: { onSubmit: resetSchema },
    // Otherwise handleSubmit silently no-ops on an invalid form instead of surfacing the errors.
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setProblem(null),
    },
    onSubmit: async ({ value, formApi }) => {
      if (!token) return
      try {
        const { data, error, response } = await api.POST(
          '/api/auth/reset-password',
          { body: { token, password: value.password } },
        )
        if (data) {
          // The reset ended every session, this browser's included
          setSessionUser(queryClient, null)
          // Replacing this history entry drops the spent token, so Back cannot return to it
          await navigate({
            to: SIGNIN_HREF,
            replace: true,
            state: { notice: 'password-changed', email: data.email },
          })
          return
        }
        const fields = toFieldErrors(error, fieldNames)
        if (fields) {
          formApi.setErrorMap({ onSubmit: { fields } })
        } else if (response.status === 400) {
          setIsExpired(true)
        } else if (response.status === 429) {
          setProblem({
            kind: 'rate-limited',
            retryAfter: retryAfterSeconds(response),
          })
        } else {
          setProblem({ kind: 'failed' })
        }
      } catch {
        setProblem({ kind: 'failed' })
      }
    },
  })

  if (!token || isExpired) {
    return (
      <AuthLayout
        title={
          token ? 'This link no longer works.' : 'This link is incomplete.'
        }
        description={
          token
            ? 'Reset links work once and expire after an hour. Ask for a new one and use the most recent email.'
            : 'Part of it is missing. Open the link from the email again, or ask for a new one.'
        }
        action={<Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />}
      >
        <Button
          label="Request a new link"
          variant="primary"
          size="lg"
          width="100%"
          href={FORGOT_PASSWORD_HREF}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password."
      description="Once it's saved, every device is signed out and you sign in with the new one."
      action={<Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <VStack gap={6}>
          {problem?.kind === 'rate-limited' ? (
            <Banner
              status="error"
              title={TOO_MANY_ATTEMPTS}
              description={tryAgainIn(problem.retryAfter)}
            />
          ) : problem ? (
            <Banner
              status="error"
              title="Couldn't change your password."
              description="Something went wrong on our side. Try again in a moment."
            />
          ) : null}

          <FormLayout defaultOptionality="required">
            <form.Field
              name="password"
              validators={{ onBlur: resetSchema.shape.password }}
            >
              {(field) => (
                <PasswordField
                  label="New password"
                  placeholder="At least 8 characters"
                  htmlName={field.name}
                  autoComplete="new-password"
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

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                label="Save password"
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
