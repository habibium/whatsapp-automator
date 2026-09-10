import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { CircleAlertIcon, CircleCheckIcon } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'

import type { components } from '@/api/schema'

import { $api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { Alert, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export const Route = createFileRoute('/signup')({ component: Signup })

const signupSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

const fieldNames = ['email', 'password'] as const

type FieldName = (typeof fieldNames)[number]

// openapi-react-query rejects with the parsed response body rather than an Error.
function toFieldErrors(error: unknown) {
  const details = (error as components['schemas']['ErrorBody']).details
  if (!details) return null

  const fields: Partial<Record<FieldName, Array<{ message: string }>>> = {}
  for (const name of fieldNames) {
    const messages = details[name]
    if (messages?.length) {
      fields[name] = messages.map((message) => ({ message }))
    }
  }
  return Object.keys(fields).length > 0 ? fields : null
}

function Signup() {
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const signup = $api.useMutation('post', '/api/auth/signup')

  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: signupSchema },
    // Otherwise handleSubmit silently no-ops on an invalid form instead of surfacing the errors.
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => {
        if (signup.isError) signup.reset()
      },
    },
    onSubmit: async ({ value, formApi }) => {
      const email = value.email.trim()
      try {
        await signup.mutateAsync({ body: { email, password: value.password } })
        setRegisteredEmail(email)
      } catch (error) {
        const fields = toFieldErrors(error)
        if (fields) formApi.setErrorMap({ onSubmit: { fields } })
      }
    },
  })

  if (registeredEmail) {
    return (
      <AuthLayout
        title="Account created"
        description={`Your account for ${registeredEmail} is ready.`}
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <CircleCheckIcon className="size-6" />
          </div>
          <p className="text-sm text-muted-foreground">
            Signing in is not available yet, so there is nothing else to do for
            now.
          </p>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start scheduling WhatsApp messages in minutes."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field
            name="email"
            validators={{ onBlur: signupSchema.shape.email }}
          >
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
          <form.Field
            name="password"
            validators={{ onBlur: signupSchema.shape.password }}
          >
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="password"
                    autoComplete="new-password"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    aria-invalid={isInvalid}
                  />
                  <FieldDescription>At least 8 characters.</FieldDescription>
                  {isInvalid && <FieldError errors={field.state.meta.errors} />}
                </Field>
              )
            }}
          </form.Field>
          {signup.isError && !signup.error.details ? (
            <Alert variant="destructive">
              <CircleAlertIcon />
              <AlertTitle>
                {signup.error.error || 'Unable to create your account'}
              </AlertTitle>
            </Alert>
          ) : null}
          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? 'Creating account…' : 'Create account'}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </AuthLayout>
  )
}
