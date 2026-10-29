import { useCallback, useEffect, useRef, useState } from 'react'
import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { Divider } from '@astryxdesign/core/Divider'
import { Icon } from '@astryxdesign/core/Icon'
import { VStack } from '@astryxdesign/core/VStack'
import { KeyRound } from 'lucide-react'

import { api } from '@/api/client'
import {
  getPasskey,
  hasPasskeyAutofill,
  hasPasskeySupport,
  toPasskeyFailure,
} from '@/lib/passkey'
import type { WebAuthnJSON } from '@/lib/passkey'
import {
  TOO_MANY_ATTEMPTS,
  retryAfterSeconds,
  tryAgainIn,
} from '@/lib/retry-after'
import type { User } from '@/lib/session'

type RateLimited = { kind: 'rate-limited'; retryAfter?: number }
type Problem = 'not-accepted' | 'unverified' | 'unexpected' | RateLimited
type Outcome = 'signed-in' | 'cancelled' | Problem

class RateLimitedError extends Error {
  constructor(readonly problem: RateLimited) {
    super(TOO_MANY_ATTEMPTS)
  }
}

function rateLimited(response: Response): RateLimited {
  return { kind: 'rate-limited', retryAfter: retryAfterSeconds(response) }
}

// The server keeps a challenge for five minutes; an older one is fetched again.
const CHALLENGE_REUSE_MS = 4 * 60_000

interface PasskeySignInProps {
  onSignedIn: (user: User) => Promise<void>
}

/** "Sign in with a passkey", plus passkey autofill on any `username webauthn` field. */
export function PasskeySignIn(props: PasskeySignInProps) {
  const [isSupported] = useState(hasPasskeySupport)
  return isSupported ? <PasskeySignInButton {...props} /> : null
}

function PasskeySignInButton({ onSignedIn }: PasskeySignInProps) {
  const [problem, setProblem] = useState<Problem | null>(null)
  const challenge = useRef<{
    publicKey: Promise<WebAuthnJSON>
    fetchedAt: number
  }>(null)
  const autofill = useRef<AbortController>(null)
  // Read through a ref, so a parent re-render does not restart the autofill request.
  const signedIn = useRef(onSignedIn)
  useEffect(() => {
    signedIn.current = onSignedIn
  })

  // Fetched ahead of the click, so the browser's prompt follows the click with no request in
  // between: Safari only shows it while the click still counts as user activation.
  const prepare = useCallback(() => {
    const current = challenge.current
    if (current && Date.now() - current.fetchedAt < CHALLENGE_REUSE_MS) {
      return current.publicKey
    }
    const publicKey = api
      .POST('/api/auth/passkeys/signin/start')
      .then(({ data, response }) => {
        if (response.status === 429) {
          throw new RateLimitedError(rateLimited(response))
        }
        if (!data) throw new Error('Could not start a passkey sign-in')
        return data.publicKey
      })
    challenge.current = { publicKey, fetchedAt: Date.now() }
    publicKey.catch(() => {
      if (challenge.current?.publicKey === publicKey) challenge.current = null
    })
    return publicKey
  }, [])

  const attempt = useCallback(
    async (
      mediation: CredentialMediationRequirement,
      signal?: AbortSignal,
    ): Promise<Outcome> => {
      let publicKey: WebAuthnJSON
      try {
        publicKey = await prepare()
      } catch (error) {
        return error instanceof RateLimitedError ? error.problem : 'unexpected'
      }
      let credential: WebAuthnJSON
      try {
        credential = await getPasskey(publicKey, mediation, signal)
      } catch (error) {
        return toPasskeyFailure(error) === 'cancelled'
          ? 'cancelled'
          : 'unexpected'
      }
      // Finishing spends the challenge, whether or not it signs in.
      challenge.current = null
      try {
        const { data, response } = await api.POST(
          '/api/auth/passkeys/signin/finish',
          { body: { credential } },
        )
        if (data) {
          await signedIn.current(data)
          return 'signed-in'
        }
        if (response.status === 401) return 'not-accepted'
        if (response.status === 403) return 'unverified'
        if (response.status === 429) return rateLimited(response)
        return 'unexpected'
      } catch {
        return 'unexpected'
      }
    },
    [prepare],
  )

  // Waits until the user picks a passkey from autofill, or the request is aborted. A failure does
  // not re-arm it: some authenticators answer at once, which would loop. The button re-arms it.
  const listen = useCallback(async () => {
    const controller = new AbortController()
    autofill.current?.abort()
    autofill.current = controller
    if (!(await hasPasskeyAutofill()) || controller.signal.aborted) return
    const outcome = await attempt('conditional', controller.signal)
    if (controller.signal.aborted) return
    if (outcome === 'not-accepted' || outcome === 'unverified') {
      setProblem(outcome)
    }
  }, [attempt])

  useEffect(() => {
    void listen()
    return () => autofill.current?.abort()
  }, [listen])

  const signInWithPasskey = async () => {
    // A browser runs one WebAuthn request at a time, so the waiting autofill gives way.
    autofill.current?.abort()
    setProblem(null)
    const outcome = await attempt('optional')
    if (outcome === 'signed-in') return
    if (outcome !== 'cancelled') setProblem(outcome)
    void listen()
  }

  return (
    <VStack gap={6}>
      <Divider label="or" />
      {problem ? <ProblemBanner problem={problem} /> : null}
      <Button
        label="Sign in with a passkey"
        icon={<Icon icon={KeyRound} size="sm" />}
        size="lg"
        width="100%"
        clickAction={signInWithPasskey}
      />
    </VStack>
  )
}

function ProblemBanner({ problem }: { problem: Problem }) {
  if (typeof problem === 'object') {
    return (
      <Banner
        status="error"
        title={TOO_MANY_ATTEMPTS}
        description={tryAgainIn(problem.retryAfter)}
      />
    )
  }
  switch (problem) {
    case 'not-accepted':
      return (
        <Banner
          status="error"
          title="That passkey didn't sign you in."
          description="It may have been removed from your account. Try again, or use your password."
        />
      )
    case 'unverified':
      return (
        <Banner
          status="warning"
          title="Verify your email first."
          description="Open the link we emailed you, then sign in."
        />
      )
    case 'unexpected':
      return (
        <Banner
          status="error"
          title="Couldn't sign you in with a passkey."
          description="Something went wrong. Try again in a moment, or use your password."
        />
      )
  }
}
