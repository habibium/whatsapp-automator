import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Link } from '@astryxdesign/core/Link'
import { StatusDot } from '@astryxdesign/core/StatusDot'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import type { components } from '@/api/schema'

import { $api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { PasswordField } from '@/components/password-field'

export const Route = createFileRoute('/signup')({ component: Signup })

const SIGNIN_HREF = '/signin'
const PASSWORD_PLACEHOLDER = 'At least 8 characters'

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

function toStatusMessage(
  errors: ReadonlyArray<{ message?: string } | undefined>,
) {
  const messages = new Set(
    errors.flatMap((error) => (error?.message ? [error.message] : [])),
  )
  return messages.size > 0 ? [...messages].join('. ') : undefined
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
        step="01"
        stepLabel="Account"
        title="Your account is ready."
        description={
          <>
            We created it for <Text weight="medium">{registeredEmail}</Text>.
          </>
        }
      >
        <VStack gap={4}>
          <HStack gap={2} vAlign="center">
            <StatusDot variant="success" label="Account created" />
            <Text type="label">Account created</Text>
          </HStack>
          <Text color="secondary">
            The next step is linking WhatsApp by scanning a QR code. Signing in
            is not available yet, so there is nothing else to do for now.
          </Text>
          <Button label="Back to the homepage" variant="secondary" href="/" />
        </VStack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      step="01"
      stepLabel="Account"
      title="Create your account."
      description="An email address and a password. You can link WhatsApp once the account exists."
      action={<Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />}
      footer={
        <>
          Already have an account?{' '}
          <Link href={SIGNIN_HREF} size="sm" color="primary" hasUnderline>
            Sign in
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
          {signup.isError && !signup.error.details ? (
            <Banner
              status="error"
              title={signup.error.error || 'Unable to create your account'}
            />
          ) : null}

          <FormLayout defaultOptionality="required">
            <form.Field
              name="email"
              validators={{ onBlur: signupSchema.shape.email }}
            >
              {(field) => {
                const isInvalid =
                  field.state.meta.isTouched && !field.state.meta.isValid
                return (
                  <TextInput
                    label="Email"
                    type="email"
                    htmlName={field.name}
                    autoComplete="email"
                    placeholder="you@example.com"
                    size="lg"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    status={
                      isInvalid
                        ? {
                            type: 'error',
                            message: toStatusMessage(field.state.meta.errors),
                          }
                        : undefined
                    }
                  />
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
                  <PasswordField
                    label="Password"
                    placeholder={PASSWORD_PLACEHOLDER}
                    htmlName={field.name}
                    autoComplete="new-password"
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    onBlur={field.handleBlur}
                    isInvalid={isInvalid}
                    errorMessage={toStatusMessage(field.state.meta.errors)}
                  />
                )
              }}
            </form.Field>
          </FormLayout>

          <form.Subscribe selector={(state) => state.isSubmitting}>
            {(isSubmitting) => (
              <Button
                type="submit"
                label="Create account"
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
