import { useState } from 'react'
import type { ReactNode } from 'react'
import { useForm } from '@tanstack/react-form'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { TextInput } from '@astryxdesign/core/TextInput'
import { VStack } from '@astryxdesign/core/VStack'
import { z } from 'zod'

import type { components } from '@/api/schema'
import type { User } from '@/lib/session'

import { api } from '@/api/client'
import { AuthLayout } from '@/components/auth-layout'
import {
  CODE_LENGTH,
  TwoFactorCodeField,
} from '@/components/two-factor-code-field'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'

type SecondFactor = components['schemas']['SecondFactor']

type Outcome = 'signed-in' | 'incorrect' | 'ended' | 'failed'

const codeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, `Enter the ${CODE_LENGTH}-digit code`),
})

const recoverySchema = z.object({
  recovery_code: z.string().trim().min(1, 'Enter one of your recovery codes'),
})

const COPY = {
  app: {
    title: 'Enter the code from your authenticator app.',
    description:
      'Open the app on your phone and type the 6-digit code it shows for WhatsApp Automator.',
  },
  recovery: {
    title: 'Enter a recovery code.',
    description:
      'Use one of the codes you saved when you turned on two-step verification. Each one works once.',
  },
} as const

interface TwoFactorSignInProps {
  onSignedIn: (user: User) => Promise<void>
  /** The server ended the sign-in: too many wrong codes, or five minutes passed. */
  onEnded: () => void
  onCancel: () => void
}

export function TwoFactorSignIn({
  onSignedIn,
  onEnded,
  onCancel,
}: TwoFactorSignInProps) {
  const [method, setMethod] = useState<keyof typeof COPY>('app')

  const verify = async (body: SecondFactor): Promise<Outcome> => {
    try {
      const { data, error, response } = await api.POST(
        '/api/auth/signin/two-factor',
        { body },
      )
      if (data) {
        await onSignedIn(data)
        return 'signed-in'
      }
      if (response.status === 401) {
        onEnded()
        return 'ended'
      }
      return toFieldErrors(error, ['code', 'recovery_code'] as const)
        ? 'incorrect'
        : 'failed'
    } catch {
      return 'failed'
    }
  }

  return (
    <AuthLayout
      title={COPY[method].title}
      description={COPY[method].description}
      action={
        <Button label="Start over" variant="ghost" clickAction={onCancel} />
      }
    >
      {method === 'app' ? (
        <AppCodeForm verify={verify} onSwitch={() => setMethod('recovery')} />
      ) : (
        <RecoveryCodeForm verify={verify} onSwitch={() => setMethod('app')} />
      )}
    </AuthLayout>
  )
}

interface MethodFormProps {
  verify: (body: SecondFactor) => Promise<Outcome>
  onSwitch: () => void
}

function AppCodeForm({ verify, onSwitch }: MethodFormProps) {
  const [hasFailed, setHasFailed] = useState(false)

  const form = useForm({
    defaultValues: { code: '' },
    validators: { onSubmit: codeSchema },
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setHasFailed(false),
    },
    onSubmit: async ({ value, formApi }) => {
      const outcome = await verify({ code: value.code })
      if (outcome === 'incorrect') {
        formApi.setErrorMap({
          onSubmit: {
            fields: {
              code: [{ message: 'That code is wrong or was already used' }],
            },
          },
        })
      } else if (outcome === 'failed') {
        setHasFailed(true)
      }
    },
  })

  return (
    <MethodForm
      onSubmit={() => form.handleSubmit()}
      hasFailed={hasFailed}
      switchLabel="Use a recovery code instead"
      onSwitch={onSwitch}
      submit={
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => <SubmitButton isLoading={isSubmitting} />}
        </form.Subscribe>
      }
    >
      <form.Field name="code">
        {(field) => (
          <TwoFactorCodeField
            label="Authenticator code"
            htmlName={field.name}
            value={field.state.value}
            onChange={(value) => {
              field.handleChange(value)
              // A complete code is the only thing left to do, so it goes straight in
              if (value.length === CODE_LENGTH && !form.state.isSubmitting) {
                void form.handleSubmit()
              }
            }}
            onBlur={field.handleBlur}
            isInvalid={field.state.meta.isTouched && !field.state.meta.isValid}
            errorMessage={toStatusMessage(field.state.meta.errors)}
            hasAutoFocus
          />
        )}
      </form.Field>
    </MethodForm>
  )
}

function RecoveryCodeForm({ verify, onSwitch }: MethodFormProps) {
  const [hasFailed, setHasFailed] = useState(false)

  const form = useForm({
    defaultValues: { recovery_code: '' },
    validators: { onSubmit: recoverySchema },
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setHasFailed(false),
    },
    onSubmit: async ({ value, formApi }) => {
      const outcome = await verify({
        recovery_code: value.recovery_code.trim(),
      })
      if (outcome === 'incorrect') {
        formApi.setErrorMap({
          onSubmit: {
            fields: {
              recovery_code: [
                { message: 'That code is wrong or was already used' },
              ],
            },
          },
        })
      } else if (outcome === 'failed') {
        setHasFailed(true)
      }
    },
  })

  return (
    <MethodForm
      onSubmit={() => form.handleSubmit()}
      hasFailed={hasFailed}
      switchLabel="Use the authenticator app instead"
      onSwitch={onSwitch}
      submit={
        <form.Subscribe selector={(state) => state.isSubmitting}>
          {(isSubmitting) => <SubmitButton isLoading={isSubmitting} />}
        </form.Subscribe>
      }
    >
      <form.Field name="recovery_code">
        {(field) => (
          <TextInput
            label="Recovery code"
            htmlName={field.name}
            autoComplete="off"
            placeholder="xxxx-xxxx-xxxx-xxxx"
            size="lg"
            value={field.state.value}
            onChange={(value) => field.handleChange(value)}
            onBlur={field.handleBlur}
            status={
              field.state.meta.isTouched && !field.state.meta.isValid
                ? {
                    type: 'error',
                    message: toStatusMessage(field.state.meta.errors),
                  }
                : undefined
            }
            hasAutoFocus
          />
        )}
      </form.Field>
    </MethodForm>
  )
}

interface MethodFormLayoutProps {
  onSubmit: () => Promise<void>
  hasFailed: boolean
  switchLabel: string
  onSwitch: () => void
  submit: ReactNode
  children: ReactNode
}

function MethodForm({
  onSubmit,
  hasFailed,
  switchLabel,
  onSwitch,
  submit,
  children,
}: MethodFormLayoutProps) {
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void onSubmit()
      }}
    >
      <VStack gap={6}>
        {hasFailed ? (
          <Banner
            status="error"
            title="Couldn't check that code."
            description="Something went wrong on our side. Try again in a moment."
          />
        ) : null}

        <FormLayout defaultOptionality="required">{children}</FormLayout>

        <VStack gap={3}>
          {submit}
          <HStack justify="center">
            <Button
              label={switchLabel}
              variant="ghost"
              size="sm"
              clickAction={onSwitch}
            />
          </HStack>
        </VStack>
      </VStack>
    </form>
  )
}

function SubmitButton({ isLoading }: { isLoading: boolean }) {
  return (
    <Button
      type="submit"
      label="Sign in"
      variant="primary"
      size="lg"
      width="100%"
      isLoading={isLoading}
    />
  )
}
