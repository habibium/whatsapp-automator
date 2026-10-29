import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import { EmailField } from '@/components/email-field'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'

const schema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
})

const fieldNames = ['email'] as const

type Problem =
  | { kind: 'rate-limited'; retryAfter?: number }
  | { kind: 'failed' }

interface EmailRequestFormProps {
  defaultEmail?: string
  submitLabel: string
  /** An openapi-fetch call; any 2xx counts as sent. */
  request: (email: string) => Promise<{ error?: unknown; response: Response }>
  onSent: (email: string) => void
}

/** One email field that asks the server to mail a link to it. */
export function EmailRequestForm({
  defaultEmail = '',
  submitLabel,
  request,
  onSent,
}: EmailRequestFormProps) {
  const [problem, setProblem] = useState<Problem | null>(null)

  const form = useForm({
    defaultValues: { email: defaultEmail },
    validators: { onSubmit: schema },
    // Otherwise handleSubmit silently no-ops on an invalid form instead of surfacing the errors.
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setProblem(null),
    },
    onSubmit: async ({ value, formApi }) => {
      const email = value.email.trim()
      try {
        const { error, response } = await request(email)
        if (response.ok) {
          onSent(email)
          return
        }
        const fields = toFieldErrors(error, fieldNames)
        if (fields) {
          formApi.setErrorMap({ onSubmit: { fields } })
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

  return (
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
            title="Couldn't send the email."
            description="Something went wrong on our side. Try again in a moment."
          />
        ) : null}

        <FormLayout defaultOptionality="required">
          <form.Field name="email" validators={{ onBlur: schema.shape.email }}>
            {(field) => (
              <EmailField
                htmlName={field.name}
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
              label={submitLabel}
              variant="primary"
              size="lg"
              width="100%"
              isLoading={isSubmitting}
            />
          )}
        </form.Subscribe>
      </VStack>
    </form>
  )
}
