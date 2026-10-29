import { useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Card } from '@astryxdesign/core/Card'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { HStack } from '@astryxdesign/core/HStack'
import { Icon } from '@astryxdesign/core/Icon'
import { List, ListItem } from '@astryxdesign/core/List'
import { Heading, Text } from '@astryxdesign/core/Text'
import { Timestamp } from '@astryxdesign/core/Timestamp'
import { VStack } from '@astryxdesign/core/VStack'
import { KeyRound, Plus } from 'lucide-react'

import { $api, api } from '@/api/client'
import {
  ConfirmPasswordDialog,
  toConfirmOutcome,
} from '@/components/confirm-password-dialog'
import type { ConfirmOutcome } from '@/components/confirm-password-dialog'
import { PasskeyNameDialog } from '@/components/passkey-name-dialog'
import type { Passkey, SaveOutcome } from '@/components/passkey-name-dialog'
import {
  createPasskey,
  hasPasskeySupport,
  toPasskeyFailure,
} from '@/lib/passkey'
import type { WebAuthnJSON } from '@/lib/passkey'

type Notice =
  | Exclude<SaveOutcome, 'saved'>
  | 'added'
  | 'removed'
  | 'device-registered'
  | 'limit'

/** Lists the user's passkeys and adds or removes them, each change behind the password. */
export function PasskeysSection() {
  const [isSupported] = useState(hasPasskeySupport)
  const passkeys = $api.useQuery('get', '/api/auth/passkeys')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [isAdding, setIsAdding] = useState(false)
  const [created, setCreated] = useState<WebAuthnJSON | null>(null)
  const [removing, setRemoving] = useState<Passkey | null>(null)

  const startAdding = () => {
    setNotice(null)
    setIsAdding(true)
  }

  // Runs inside the password dialog's submit, so the browser's prompt still follows a click.
  const register = async (password: string): Promise<ConfirmOutcome> => {
    const result = await api.POST('/api/auth/passkeys/registration/start', {
      body: { password },
    })
    if (!result.data) {
      if (result.response.status !== 409) return toConfirmOutcome(result)
      setNotice('limit')
      return 'confirmed'
    }
    try {
      setCreated(await createPasskey(result.data.publicKey))
    } catch (error) {
      const failure = toPasskeyFailure(error)
      if (failure === 'already-registered') setNotice('device-registered')
      else if (failure === 'failed') setNotice('failed')
    }
    return 'confirmed'
  }

  const finishAdding = (outcome: SaveOutcome) => {
    setCreated(null)
    setNotice(outcome === 'saved' ? 'added' : outcome)
    void passkeys.refetch()
  }

  const remove = async (password: string): Promise<ConfirmOutcome> => {
    if (!removing) return 'confirmed'
    const result = await api.DELETE('/api/auth/passkeys/{id}', {
      params: { path: { id: removing.id } },
      body: { password },
    })
    // Already gone counts as removed: the list catches up either way.
    const outcome =
      result.response.status === 404 ? 'confirmed' : toConfirmOutcome(result)
    if (outcome === 'confirmed') {
      setNotice('removed')
      void passkeys.refetch()
    }
    return outcome
  }

  const list = passkeys.data ?? []
  if (!isSupported && list.length === 0) return null

  const addButton = isSupported ? (
    <Button
      label="Add a passkey"
      icon={<Icon icon={Plus} size="sm" />}
      clickAction={startAdding}
    />
  ) : null

  return (
    <VStack gap={4}>
      <HStack gap={4} justify="between" vAlign="center">
        <Heading level={2}>Passkeys</Heading>
        {list.length > 0 ? addButton : null}
      </HStack>
      <Text color="secondary">
        Sign in with your fingerprint, face or screen lock instead of your
        password. A passkey only works on this site, so it can't be phished.
      </Text>

      {notice ? <NoticeBanner key={notice} notice={notice} /> : null}

      {passkeys.isError ? (
        <Banner
          status="error"
          title="Couldn't load your passkeys."
          description="Something went wrong on our side."
          endContent={
            <Button
              label="Try again"
              size="sm"
              clickAction={async () => {
                await passkeys.refetch()
              }}
            />
          }
        />
      ) : list.length > 0 ? (
        <List hasDividers>
          {list.map((passkey) => (
            <ListItem
              key={passkey.id}
              label={passkey.name}
              startContent={<Icon icon={KeyRound} color="secondary" />}
              description={<PasskeyDates passkey={passkey} />}
              endContent={
                <Button
                  label={`Remove ${passkey.name}`}
                  variant="ghost"
                  size="sm"
                  clickAction={() => setRemoving(passkey)}
                >
                  Remove
                </Button>
              }
            />
          ))}
        </List>
      ) : passkeys.isSuccess ? (
        <Card>
          <EmptyState
            icon={<Icon icon={KeyRound} size="lg" />}
            title="No passkeys yet"
            description="Add one on this device, and next time sign in without typing your password."
            actions={addButton}
          />
        </Card>
      ) : null}

      <ConfirmPasswordDialog
        isOpen={isAdding}
        onOpenChange={setIsAdding}
        title="Add a passkey."
        description="Enter your password first. Your device then asks you to create the passkey."
        confirmLabel="Continue"
        onConfirm={register}
      />
      <PasskeyNameDialog credential={created} onDone={finishAdding} />
      <ConfirmPasswordDialog
        isOpen={removing !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoving(null)
        }}
        title={`Remove ${removing?.name ?? 'passkey'}?`}
        description="Enter your password to remove it. It stops signing in to your account at once."
        confirmLabel="Remove passkey"
        onConfirm={remove}
      />
    </VStack>
  )
}

function PasskeyDates({ passkey }: { passkey: Passkey }) {
  return (
    <Text type="supporting">
      Added{' '}
      <Timestamp value={passkey.created_at} format="date" type="inherit" />
      {' · '}
      {passkey.last_used_at ? (
        <>
          Last used{' '}
          <Timestamp
            value={passkey.last_used_at}
            format="auto"
            type="inherit"
          />
        </>
      ) : (
        'Not used yet'
      )}
    </Text>
  )
}

function NoticeBanner({ notice }: { notice: Notice }) {
  switch (notice) {
    case 'added':
      return (
        <Banner
          status="success"
          title="Passkey added."
          description="Next time, sign in with it instead of your password."
          isDismissable
        />
      )
    case 'removed':
      return (
        <Banner
          status="success"
          title="Passkey removed."
          description="It can no longer sign in to your account."
          isDismissable
        />
      )
    case 'device-registered':
      return (
        <Banner
          status="warning"
          title="This device already has a passkey here."
          description="It's in your list. To replace it, remove it first."
          isDismissable
        />
      )
    case 'limit':
      return (
        <Banner
          status="warning"
          title="That's as many passkeys as an account can hold."
          description="Remove one you no longer use to add another."
          isDismissable
        />
      )
    case 'expired':
      return (
        <Banner
          status="error"
          title="That took too long."
          description="Add the passkey again; your device will replace the one it just made."
          isDismissable
        />
      )
    case 'already-registered':
      return (
        <Banner
          status="error"
          title="That passkey is already registered."
          description="It may belong to another account. Try a different device."
          isDismissable
        />
      )
    case 'failed':
      return (
        <Banner
          status="error"
          title="Couldn't add the passkey."
          description="Something went wrong. Try again in a moment."
          isDismissable
        />
      )
  }
}
