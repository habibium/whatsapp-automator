import { useState } from 'react'
import { useForm } from '@tanstack/react-form'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Link } from '@astryxdesign/core/Link'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import { $api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import { EmailField } from '@/components/email-field'
import { PasswordField } from '@/components/password-field'
import { ResendVerification } from '@/components/resend-verification'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import { HOME_HREF, SIGNIN_HREF, currentUser } from '@/lib/session'

export const Route = createFileRoute('/signup')({
  beforeLoad: async ({ context }) => {
    if (await currentUser(context.queryClient)) {
      throw redirect({ href: HOME_HREF })
    }
  },
  component: Signup,
})

const PASSWORD_PLACEHOLDER = 'At least 8 characters'

const signupSchema = z.object({
  email: z.string().trim().pipe(z.email('Enter a valid email address')),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
})

const fieldNames = ['email', 'password'] as const

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
        const fields = toFieldErrors(error, fieldNames)
        if (fields) formApi.setErrorMap({ onSubmit: { fields } })
      }
    },
  })

  if (registeredEmail) {
    return (
      <AuthLayout
        title="Check your inbox."
        description={
          <>
            We sent a verification link to{' '}
            <Text weight="medium">{registeredEmail}</Text>.
          </>
        }
        action={<Button label="Sign in" variant="ghost" href={SIGNIN_HREF} />}
        footer={
          <>
            Already verified?{' '}
            <Link href={SIGNIN_HREF} size="sm" color="primary" hasUnderline>
              Sign in
            </Link>
          </>
        }
      >
        <VStack gap={5}>
          <Text color="secondary">
            Open it in this browser and you are signed in straight away. The
            link works for 24 hours.
          </Text>
          <ResendVerification email={registeredEmail} />
        </VStack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
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

            <form.Field
              name="password"
              validators={{ onBlur: signupSchema.shape.password }}
            >
              {(field) => (
                <PasswordField
                  label="Password"
                  placeholder={PASSWORD_PLACEHOLDER}
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
