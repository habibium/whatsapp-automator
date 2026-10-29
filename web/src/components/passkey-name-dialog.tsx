import { useForm } from '@tanstack/react-form'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { TextInput } from '@astryxdesign/core/TextInput'
import { z } from 'zod'

import { api } from '@/api/client'
import type { components } from '@/api/schema'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'
import type { WebAuthnJSON } from '@/lib/passkey'

export type Passkey = components['schemas']['PasskeyResponse']

export type SaveOutcome = 'saved' | 'expired' | 'already-registered' | 'failed'

const schema = z.object({
  name: z.string().trim().max(64, 'Use at most 64 characters'),
})

interface PasskeyNameDialogProps {
  /** What the authenticator just made; the dialog is open while it is set. */
  credential: WebAuthnJSON | null
  onDone: (outcome: SaveOutcome) => void
}

/** Saves a new passkey under the name the user gives it, or the server's default. */
export function PasskeyNameDialog({
  credential,
  onDone,
}: PasskeyNameDialogProps) {
  return (
    // The device already holds the passkey, so the dialog only closes by saving it.
    <Dialog
      isOpen={credential !== null}
      onOpenChange={() => {}}
      purpose="required"
      width={440}
    >
      {credential ? (
        <PasskeyNameForm credential={credential} onDone={onDone} />
      ) : null}
    </Dialog>
  )
}

interface PasskeyNameFormProps {
  credential: WebAuthnJSON
  onDone: (outcome: SaveOutcome) => void
}

function PasskeyNameForm({ credential, onDone }: PasskeyNameFormProps) {
  const form = useForm({
    defaultValues: { name: '' },
    validators: { onSubmit: schema },
    canSubmitWhenInvalid: true,
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data, error, response } = await api.POST(
          '/api/auth/passkeys/registration/finish',
          { body: { credential, name: value.name.trim() || null } },
        )
        if (data) return onDone('saved')
        const fields = toFieldErrors(error, ['name'] as const)
        if (fields) return formApi.setErrorMap({ onSubmit: { fields } })
        if (response.status === 400) return onDone('expired')
        if (response.status === 409) return onDone('already-registered')
        onDone('failed')
      } catch {
        onDone('failed')
      }
    },
  })

  const skip = () => {
    form.setFieldValue('name', '')
    return form.handleSubmit()
  }

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
            title="Name your passkey."
            subtitle="Your device saved it. A name tells it apart from the others in your list."
          />
        }
        content={
          <LayoutContent>
            <FormLayout>
              <form.Field name="name">
                {(field) => (
                  <TextInput
                    label="Name"
                    isOptional
                    htmlName={field.name}
                    autoComplete="off"
                    placeholder="MacBook, iPhone or YubiKey"
                    hasAutoFocus
                    value={field.state.value}
                    onChange={(value) => field.handleChange(value)}
                    status={
                      field.state.meta.isValid
                        ? undefined
                        : {
                            type: 'error',
                            message: toStatusMessage(field.state.meta.errors),
                          }
                    }
                  />
                )}
              </form.Field>
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <form.Subscribe selector={(state) => state.isSubmitting}>
              {(isSubmitting) => (
                <HStack gap={2} justify="end">
                  <Button
                    label="Skip"
                    variant="secondary"
                    isDisabled={isSubmitting}
                    clickAction={skip}
                  />
                  <Button
                    type="submit"
                    label="Save passkey"
                    variant="primary"
                    isLoading={isSubmitting}
                  />
                </HStack>
              )}
            </form.Subscribe>
          </LayoutFooter>
        }
      />
    </form>
  )
}
