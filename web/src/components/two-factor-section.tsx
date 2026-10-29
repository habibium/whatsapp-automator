import { useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouteContext } from '@tanstack/react-router'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Token } from '@astryxdesign/core/Token'
import { VStack } from '@astryxdesign/core/VStack'

import type { components } from '@/api/schema'

import { $api, api } from '@/api/client'
import {
  ConfirmPasswordDialog,
  toConfirmOutcome,
} from '@/components/confirm-password-dialog'
import { RecoveryCodesDialog } from '@/components/two-factor-recovery-codes'
import { TwoFactorSetupDialog } from '@/components/two-factor-setup-dialog'

type TwoFactorSetup = components['schemas']['TwoFactorSetup']

/** Running this low, the next lost phone could lock the owner out. */
const FEW_RECOVERY_CODES = 3

const statusQuery = $api.queryOptions('get', '/api/auth/two-factor')

const styles = stylex.create({
  measure: { maxWidth: '45ch' },
})

export function TwoFactorSection() {
  const { user } = useRouteContext({ from: '/_authenticated' })
  const queryClient = useQueryClient()
  const status = useQuery(statusQuery)
  const [confirming, setConfirming] = useState<
    'setup' | 'disable' | 'regenerate' | null
  >(null)
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null)
  const [newCodes, setNewCodes] = useState<string[] | null>(null)

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: statusQuery.queryKey })
  const closeConfirm = (isOpen: boolean) => {
    if (!isOpen) setConfirming(null)
  }

  const startSetup = async (password: string) => {
    const result = await api.POST('/api/auth/two-factor/setup', {
      body: { password },
    })
    if (result.data) setSetup(result.data)
    // Already on, from another tab: showing that is the whole answer
    if (result.response.status === 409) {
      await refresh()
      return 'confirmed'
    }
    return toConfirmOutcome(result)
  }

  const disable = async (password: string) => {
    const result = await api.POST('/api/auth/two-factor/disable', {
      body: { password },
    })
    if (result.response.ok || result.response.status === 409) {
      await refresh()
      return 'confirmed'
    }
    return toConfirmOutcome(result)
  }

  const regenerate = async (password: string) => {
    const result = await api.POST('/api/auth/two-factor/recovery-codes', {
      body: { password },
    })
    if (result.data) setNewCodes(result.data.recovery_codes)
    if (result.response.status === 409) await refresh()
    return toConfirmOutcome(result)
  }

  const isEnabled = status.data?.enabled ?? false

  return (
    <VStack gap={5}>
      <HStack gap={4} justify="between" vAlign="start">
        <VStack gap={2}>
          <Heading level={2}>Two-step verification</Heading>
          <Text color="secondary" xstyle={styles.measure}>
            {isEnabled
              ? 'Signing in asks for your password and then a code from the authenticator app on your phone.'
              : 'Ask for a code from an authenticator app on your phone after the password, so a stolen password alone cannot get in.'}
          </Text>
        </VStack>
        {status.data ? (
          <Token
            label={isEnabled ? 'On' : 'Off'}
            color={isEnabled ? 'green' : 'gray'}
            size="sm"
          />
        ) : null}
      </HStack>

      {status.isPending ? (
        <Skeleton width={160} height={36} />
      ) : status.isError ? (
        <Banner
          status="error"
          title="Couldn't load two-step verification."
          description="Check your connection and try again."
          endContent={
            <Button
              label="Try again"
              size="sm"
              clickAction={async () => {
                await status.refetch()
              }}
            />
          }
        />
      ) : status.data.enabled ? (
        <VStack gap={5}>
          <MetadataList label={{ position: 'start', width: 160 }}>
            <MetadataListItem label="Recovery codes">
              <Text>{status.data.recovery_codes_remaining} left</Text>
            </MetadataListItem>
          </MetadataList>
          {status.data.recovery_codes_remaining <= FEW_RECOVERY_CODES ? (
            <Banner
              status="warning"
              title="You're running out of recovery codes."
              description="Create new ones while you can still sign in, and keep them somewhere safe."
            />
          ) : null}
          <HStack gap={2} wrap="wrap">
            <Button
              label="New recovery codes"
              clickAction={() => setConfirming('regenerate')}
            />
            <Button
              label="Turn off"
              variant="ghost"
              clickAction={() => setConfirming('disable')}
            />
          </HStack>
        </VStack>
      ) : (
        <HStack>
          <Button
            label="Turn on"
            variant="primary"
            clickAction={() => setConfirming('setup')}
          />
        </HStack>
      )}

      <ConfirmPasswordDialog
        isOpen={confirming === 'setup'}
        onOpenChange={closeConfirm}
        title="Turn on two-step verification"
        description="Enter your password to start. You'll need your phone next."
        confirmLabel="Continue"
        onConfirm={startSetup}
      />
      <ConfirmPasswordDialog
        isOpen={confirming === 'disable'}
        onOpenChange={closeConfirm}
        title="Turn off two-step verification?"
        description="Signing in will ask for your password only, and your recovery codes stop working."
        confirmLabel="Turn off"
        onConfirm={disable}
      />
      <ConfirmPasswordDialog
        isOpen={confirming === 'regenerate'}
        onOpenChange={closeConfirm}
        title="Create new recovery codes?"
        description="The codes you have now stop working, used or not."
        confirmLabel="Create codes"
        onConfirm={regenerate}
      />

      <TwoFactorSetupDialog
        setup={setup}
        email={user.email}
        onEnabled={() => void refresh()}
        onRestart={() => {
          setSetup(null)
          setConfirming('setup')
        }}
        onClose={() => setSetup(null)}
      />
      <RecoveryCodesDialog
        codes={newCodes}
        email={user.email}
        onDone={() => {
          setNewCodes(null)
          void refresh()
        }}
      />
    </VStack>
  )
}
