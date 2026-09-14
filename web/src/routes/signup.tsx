import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useForm } from '@tanstack/react-form'
import { createFileRoute } from '@tanstack/react-router'
import { CircleCheck, Eye, EyeOff } from 'lucide-react'
import { z } from 'zod'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { Icon } from '@astryxdesign/core/Icon'
import { InputGroup, InputGroupText } from '@astryxdesign/core/InputGroup'
import { TextInput } from '@astryxdesign/core/TextInput'
import { Text } from '@astryxdesign/core/Text'
import { ToggleButton } from '@astryxdesign/core/ToggleButton'
import { VStack } from '@astryxdesign/core/VStack'
import { colorVars } from '@astryxdesign/core/theme/tokens.stylex'

import type { components } from '@/api/schema'

import { $api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'

export const Route = createFileRoute('/signup')({ component: Signup })

const styles = stylex.create({
  // InputGroup is inline-flex, so it shrinks to its content without this.
  passwordGroup: { display: 'flex', width: '100%' },
  revealSlot: { paddingInline: 0 },
  // InputGroupText does not react to the group's status, so the suffix addon
  // would keep a neutral border while the input segment turns red.
  revealSlotError: { borderColor: colorVars['--color-error'] },
})

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
  const [isPasswordVisible, setIsPasswordVisible] = useState(false)
  const revealLabel = isPasswordVisible ? 'Hide password' : 'Show password'
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
        <VStack gap={3} hAlign="center" paddingBlock={2}>
          <Icon icon={CircleCheck} size="lg" color="success" />
          <Text type="body" color="secondary" justify="center">
            Signing in is not available yet, so there is nothing else to do for
            now.
          </Text>
        </VStack>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create your account"
      description="Start automating WhatsApp in minutes."
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void form.handleSubmit()
        }}
      >
        <VStack gap={4}>
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
                    // InputGroup only renders detached messages; keep both fields alike.
                    statusVariant="detached"
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
                  <InputGroup
                    label="Password"
                    description="At least 8 characters."
                    size="lg"
                    xstyle={styles.passwordGroup}
                    status={
                      isInvalid
                        ? {
                            type: 'error',
                            message: toStatusMessage(field.state.meta.errors),
                          }
                        : undefined
                    }
                  >
                    <TextInput
                      // A grouped input is named "<group label> <own label>",
                      // so repeating "Password" here would stutter.
                      label="Entry"
                      type={isPasswordVisible ? 'text' : 'password'}
                      htmlName={field.name}
                      autoComplete="new-password"
                      value={field.state.value}
                      onChange={(value) => field.handleChange(value)}
                      onBlur={field.handleBlur}
                      // The group renders the message; this only paints the
                      // border and sets aria-invalid on the input itself.
                      status={isInvalid ? { type: 'error' } : undefined}
                    />
                    <InputGroupText
                      xstyle={[
                        styles.revealSlot,
                        isInvalid && styles.revealSlotError,
                      ]}
                    >
                      <ToggleButton
                        isIconOnly
                        // ToggleButton forwards size to Button directly, so it
                        // never picks up the group's size context.
                        size="lg"
                        label={revealLabel}
                        tooltip={revealLabel}
                        icon={<Icon icon={Eye} color="inherit" />}
                        pressedIcon={<Icon icon={EyeOff} color="inherit" />}
                        isPressed={isPasswordVisible}
                        onPressedChange={setIsPasswordVisible}
                      />
                    </InputGroupText>
                  </InputGroup>
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
