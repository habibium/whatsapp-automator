import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import { PasswordField } from '@/components/password-field'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'

const schema = z.object({
  password: z.string().min(1, 'Enter your password'),
})

export type ConfirmOutcome =
  | 'confirmed'
  | 'incorrect-password'
  | 'failed'
  | { kind: 'rate-limited'; retryAfter?: number }

type Problem = Exclude<ConfirmOutcome, 'confirmed' | 'incorrect-password'>

/** Reads an openapi-fetch result from an endpoint that re-checks the password. */
export function toConfirmOutcome(result: {
  response: Response
  error?: unknown
}): ConfirmOutcome {
  if (result.response.ok) return 'confirmed'
  if (result.response.status === 429) {
    return {
      kind: 'rate-limited',
      retryAfter: retryAfterSeconds(result.response),
    }
  }
  return toFieldErrors(result.error, ['password'] as const)
    ? 'incorrect-password'
    : 'failed'
}

interface ConfirmPasswordDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  title: string
  description: string
  confirmLabel: string
  /** Makes the protected change with the password; the dialog closes once it is `confirmed`. */
  onConfirm: (password: string) => Promise<ConfirmOutcome>
}

/** Asks for the password again before a change a stolen session must not be able to make. */
export function ConfirmPasswordDialog({
  isOpen,
  onOpenChange,
  ...props
}: ConfirmPasswordDialogProps) {
  return (
    <Dialog
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      width={440}
    >
      {/* Mounted only while open, so a typed password never survives a close. */}
      {isOpen ? (
        <ConfirmPasswordForm {...props} onClose={() => onOpenChange(false)} />
      ) : null}
    </Dialog>
  )
}

interface ConfirmPasswordFormProps extends Omit<
  ConfirmPasswordDialogProps,
  'isOpen' | 'onOpenChange'
> {
  onClose: () => void
}

function ConfirmPasswordForm({
  title,
  description,
  confirmLabel,
  onConfirm,
  onClose,
}: ConfirmPasswordFormProps) {
  const [problem, setProblem] = useState<Problem | null>(null)

  const form = useForm({
    defaultValues: { password: '' },
    validators: { onSubmit: schema },
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setProblem(null),
    },
    onSubmit: async ({ value, formApi }) => {
      let outcome: ConfirmOutcome
      try {
        outcome = await onConfirm(value.password)
      } catch {
        outcome = 'failed'
      }
      if (outcome === 'confirmed') {
        onClose()
      } else if (outcome === 'incorrect-password') {
        formApi.setErrorMap({
          onSubmit: {
            fields: { password: [{ message: 'That password is incorrect' }] },
          },
        })
      } else {
        setProblem(outcome)
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
      <Layout
        header={
          <DialogHeader
            title={title}
            subtitle={description}
            onOpenChange={() => onClose()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={4}>
              {problem === 'failed' ? (
                <Banner
                  status="error"
                  title="That didn't work."
                  description="Something went wrong on our side. Try again in a moment."
                />
              ) : problem ? (
                <Banner
                  status="error"
                  title={TOO_MANY_ATTEMPTS}
                  description={tryAgainIn(problem.retryAfter)}
                />
              ) : null}
              <FormLayout defaultOptionality="required">
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
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} justify="end">
              <Button
                label="Cancel"
                variant="secondary"
                clickAction={onClose}
              />
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    label={confirmLabel}
                    variant="primary"
                    isLoading={isSubmitting}
                  />
                )}
              </form.Subscribe>
            </HStack>
          </LayoutFooter>
        }
      />
    </form>
  )
}
