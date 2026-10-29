import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useForm } from '@tanstack/react-form'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { FormLayout } from '@astryxdesign/core/FormLayout'
import { HStack } from '@astryxdesign/core/HStack'
import { useClipboard } from '@astryxdesign/core/hooks'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'
import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { radiusVars } from '@astryxdesign/core/theme/tokens.stylex'
import { Check, Copy } from 'lucide-react'
import { z } from 'zod'

import type { components } from '@/api/schema'

import { api } from '@/api/client'
import {
  CODE_LENGTH,
  TwoFactorCodeField,
} from '@/components/two-factor-code-field'
import {
  RECOVERY_DIALOG_WIDTH,
  RecoveryCodes,
} from '@/components/two-factor-recovery-codes'
import { toFieldErrors, toStatusMessage } from '@/lib/form-errors'

type TwoFactorSetup = components['schemas']['TwoFactorSetup']

const QR_SIZE = 152

const styles = stylex.create({
  qr: {
    display: 'block',
    flexShrink: 0,
    borderRadius: radiusVars['--radius-element'],
  },
  key: { flexBasis: '0%', flexGrow: 1, minWidth: 0 },
})

const schema = z.object({
  code: z.string().regex(/^\d{6}$/, `Enter the ${CODE_LENGTH}-digit code`),
})

interface TwoFactorSetupDialogProps {
  /** The key the server created once the password checked out; the dialog is open while set. */
  setup: TwoFactorSetup | null
  email: string
  /** Two-step verification is on; recovery codes are on screen. */
  onEnabled: () => void
  onClose: () => void
}

export function TwoFactorSetupDialog({
  setup,
  email,
  onEnabled,
  onClose,
}: TwoFactorSetupDialogProps) {
  const [codes, setCodes] = useState<string[] | null>(null)

  const close = () => {
    setCodes(null)
    onClose()
  }

  return (
    <Dialog
      isOpen={setup !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !codes) close()
      }}
      purpose={codes ? 'required' : 'form'}
      width={RECOVERY_DIALOG_WIDTH}
    >
      {codes ? (
        <RecoveryCodes codes={codes} email={email} onDone={close} />
      ) : setup ? (
        <ScanStep
          setup={setup}
          onEnabled={(recoveryCodes) => {
            setCodes(recoveryCodes)
            onEnabled()
          }}
          onCancel={close}
        />
      ) : null}
    </Dialog>
  )
}

interface ScanStepProps {
  setup: TwoFactorSetup
  onEnabled: (recoveryCodes: string[]) => void
  onCancel: () => void
}

function ScanStep({ setup, onEnabled, onCancel }: ScanStepProps) {
  const [problem, setProblem] = useState<'stale' | 'failed' | null>(null)
  const { copy, isCopied } = useClipboard({ announce: 'Setup key copied' })

  const form = useForm({
    defaultValues: { code: '' },
    validators: { onSubmit: schema },
    canSubmitWhenInvalid: true,
    listeners: {
      onChange: () => setProblem(null),
    },
    onSubmit: async ({ value, formApi }) => {
      try {
        const { data, error, response } = await api.POST(
          '/api/auth/two-factor/enable',
          { body: { code: value.code } },
        )
        if (data) {
          onEnabled(data.recovery_codes)
        } else if (toFieldErrors(error, ['code'] as const)) {
          formApi.setErrorMap({
            onSubmit: {
              fields: {
                code: [
                  {
                    message:
                      'That code is wrong. Enter the one the app shows now',
                  },
                ],
              },
            },
          })
        } else {
          setProblem(response.status === 409 ? 'stale' : 'failed')
        }
      } catch {
        setProblem('failed')
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
            title="Set up your authenticator app"
            subtitle="Scan the QR code with an app such as Google Authenticator, Microsoft Authenticator or 1Password."
            onOpenChange={() => onCancel()}
          />
        }
        content={
          <LayoutContent>
            <VStack gap={5}>
              {problem === 'stale' ? (
                <Banner
                  status="warning"
                  title="This setup no longer works."
                  description="Close it and turn on two-step verification again."
                />
              ) : problem === 'failed' ? (
                <Banner
                  status="error"
                  title="That didn't work."
                  description="Something went wrong on our side. Try again in a moment."
                />
              ) : null}

              <HStack gap={4} vAlign="center">
                <img
                  {...stylex.props(styles.qr)}
                  src={setup.qr_code}
                  alt="QR code that adds WhatsApp Automator to an authenticator app"
                  width={QR_SIZE}
                  height={QR_SIZE}
                />
                <VStack gap={2} hAlign="start" xstyle={styles.key}>
                  <Text type="supporting">
                    Can't scan it? Choose to enter a setup key in the app, and
                    type this one.
                  </Text>
                  <Text type="code">{groupInFours(setup.secret)}</Text>
                  <Button
                    label={isCopied ? 'Copied' : 'Copy key'}
                    icon={<Icon icon={isCopied ? Check : Copy} size="sm" />}
                    variant="ghost"
                    size="sm"
                    onClick={() => void copy(setup.secret)}
                  />
                </VStack>
              </HStack>

              <FormLayout defaultOptionality="required">
                <form.Field name="code">
                  {(field) => (
                    <TwoFactorCodeField
                      label="Code from the app"
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
            </VStack>
          </LayoutContent>
        }
        footer={
          <LayoutFooter>
            <HStack gap={2} justify="end">
              <Button
                label="Cancel"
                variant="secondary"
                clickAction={onCancel}
              />
              <form.Subscribe selector={(state) => state.isSubmitting}>
                {(isSubmitting) => (
                  <Button
                    type="submit"
                    label="Turn on"
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

/** Base32 keys run to 32 characters; groups of four are easier to copy by hand. */
function groupInFours(secret: string) {
  return secret.match(/.{1,4}/g)?.join(' ') ?? secret
}
