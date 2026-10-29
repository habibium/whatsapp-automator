import { useState } from 'react'
import { Button } from '@astryxdesign/core/Button'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'

import { api } from '@/api/client'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'
import { useCooldown } from '@/lib/use-cooldown'

/** The server sends at most one link a minute per account and ignores the rest silently. */
const COOLDOWN_SECONDS = 60

const SENT_TEXT = 'Sent. It can take a minute to arrive.'
const FAILED_TEXT = 'Could not send it. Try again in a moment.'

interface ResendVerificationProps {
  email: string
}

/** For the moment right after a link went out, so the first wait is already running. */
export function ResendVerification({ email }: ResendVerificationProps) {
  const { remaining, start } = useCooldown(COOLDOWN_SECONDS, true)
  const [outcome, setOutcome] = useState('')

  const resend = async () => {
    try {
      const { response } = await api.POST('/api/auth/resend-verification', {
        body: { email },
      })
      if (response.ok) {
        setOutcome(SENT_TEXT)
        start()
      } else if (response.status === 429) {
        const retryAfter = retryAfterSeconds(response)
        setOutcome(`${TOO_MANY_ATTEMPTS} ${tryAgainIn(retryAfter)}`)
        start(retryAfter)
      } else {
        setOutcome(FAILED_TEXT)
      }
    } catch {
      setOutcome(FAILED_TEXT)
    }
  }

  return (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Button
        label={remaining > 0 ? `Send again in ${remaining}s` : 'Send it again'}
        variant="secondary"
        isDisabled={remaining > 0}
        clickAction={resend}
      />
      {/* Present from the start: a live region only announces changes to itself. */}
      <Text type="supporting" role="status">
        {outcome}
      </Text>
    </HStack>
  )
}
