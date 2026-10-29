import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { CheckboxInput } from '@astryxdesign/core/CheckboxInput'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { Grid } from '@astryxdesign/core/Grid'
import { HStack } from '@astryxdesign/core/HStack'
import { useClipboard } from '@astryxdesign/core/hooks'
import { Icon } from '@astryxdesign/core/Icon'
import { Layout, LayoutContent, LayoutFooter } from '@astryxdesign/core/Layout'

import { Text } from '@astryxdesign/core/Text'
import { VStack } from '@astryxdesign/core/VStack'
import { Check, Copy, Download } from 'lucide-react'

export const RECOVERY_DIALOG_WIDTH = 480

const FILENAME = 'whatsapp-automator-recovery-codes.txt'
const CODE_COLUMN_MIN_WIDTH = 168

interface RecoveryCodesProps {
  codes: string[]
  email: string
  onDone: () => void
}

/** Fresh recovery codes, kept on screen until the user says they saved them: the server cannot show them again. */
export function RecoveryCodes({ codes, email, onDone }: RecoveryCodesProps) {
  const [isSaved, setIsSaved] = useState(false)
  const { copy, isCopied } = useClipboard({
    announce: 'Recovery codes copied',
  })

  return (
    <Layout
      header={
        <DialogHeader
          title="Save your recovery codes"
          subtitle="If you can't use your authenticator app, each code signs you in once. This is the only time they're shown."
        />
      }
      content={
        <LayoutContent>
          <VStack gap={4}>
            <Card variant="muted">
              {/* Two columns where a code fits whole in each, one on a phone */}
              <Grid
                columns={{
                  minWidth: CODE_COLUMN_MIN_WIDTH,
                  max: 2,
                  repeat: 'fit',
                }}
                columnGap={4}
                rowGap={2}
              >
                {codes.map((code) => (
                  <Text key={code} type="code" textWrap="nowrap">
                    {code}
                  </Text>
                ))}
              </Grid>
            </Card>
            <HStack gap={2} wrap="wrap">
              <Button
                label={isCopied ? 'Copied' : 'Copy'}
                icon={<Icon icon={isCopied ? Check : Copy} size="sm" />}
                onClick={() => void copy(codes.join('\n'))}
              />
              <Button
                label="Download"
                icon={<Icon icon={Download} size="sm" />}
                onClick={() => downloadText(FILENAME, toFile(codes, email))}
              />
            </HStack>
            <CheckboxInput
              label="I saved these codes somewhere safe"
              value={isSaved}
              onChange={(checked) => setIsSaved(checked)}
            />
          </VStack>
        </LayoutContent>
      }
      footer={
        <LayoutFooter>
          <HStack justify="end">
            <Button
              label="Done"
              variant="primary"
              isDisabled={!isSaved}
              clickAction={onDone}
            />
          </HStack>
        </LayoutFooter>
      }
    />
  )
}

interface RecoveryCodesDialogProps {
  codes: string[] | null
  email: string
  onDone: () => void
}

export function RecoveryCodesDialog({
  codes,
  email,
  onDone,
}: RecoveryCodesDialogProps) {
  return (
    <Dialog
      isOpen={codes !== null}
      // Only Done closes it, once the codes are saved
      onOpenChange={() => {}}
      purpose="required"
      width={RECOVERY_DIALOG_WIDTH}
    >
      {codes ? (
        <RecoveryCodes codes={codes} email={email} onDone={onDone} />
      ) : null}
    </Dialog>
  )
}

function toFile(codes: string[], email: string) {
  const created = new Date().toLocaleDateString(undefined, {
    dateStyle: 'long',
  })
  return [
    'WhatsApp Automator recovery codes',
    `Account: ${email}`,
    `Created: ${created}`,
    '',
    'Each code signs in once in place of a code from your authenticator app.',
    '',
    ...codes,
    '',
  ].join('\n')
}

function downloadText(filename: string, text: string) {
  const url = URL.createObjectURL(
    new Blob([text], { type: 'text/plain;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  // After the click has handed the file to the browser
  setTimeout(() => URL.revokeObjectURL(url))
}
