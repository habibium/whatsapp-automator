/** WebAuthn JSON as the generated API types see it: the server's schema leaves it opaque. */
export type WebAuthnJSON = { [key: string]: unknown }

/** True where WebAuthn and its JSON helpers exist; anywhere else, passkey UI stays hidden. */
export function hasPasskeySupport() {
  return (
    typeof PublicKeyCredential === 'function' &&
    typeof PublicKeyCredential.parseCreationOptionsFromJSON === 'function' &&
    typeof PublicKeyCredential.parseRequestOptionsFromJSON === 'function' &&
    typeof PublicKeyCredential.prototype.toJSON === 'function'
  )
}

/** Whether the browser can offer passkeys in the email field's autofill. */
export async function hasPasskeyAutofill() {
  try {
    return (
      (await PublicKeyCredential.isConditionalMediationAvailable()) === true
    )
  } catch {
    return false
  }
}

/** Asks the authenticator for a new passkey; rejects as `navigator.credentials.create` does. */
export async function createPasskey(publicKey: WebAuthnJSON) {
  const credential = await navigator.credentials.create({
    publicKey: PublicKeyCredential.parseCreationOptionsFromJSON(
      publicKey as unknown as PublicKeyCredentialCreationOptionsJSON,
    ),
  })
  return toJSON(credential)
}

/** Asks the authenticator to sign the challenge; rejects as `navigator.credentials.get` does. */
export async function getPasskey(
  publicKey: WebAuthnJSON,
  mediation: CredentialMediationRequirement,
  signal?: AbortSignal,
) {
  const credential = await navigator.credentials.get({
    publicKey: PublicKeyCredential.parseRequestOptionsFromJSON(
      publicKey as unknown as PublicKeyCredentialRequestOptionsJSON,
    ),
    mediation,
    signal,
  })
  return toJSON(credential)
}

function toJSON(credential: Credential | null): WebAuthnJSON {
  if (!(credential instanceof PublicKeyCredential)) {
    throw new DOMException('No passkey was returned', 'NotAllowedError')
  }
  return { ...credential.toJSON() }
}

export type PasskeyFailure = 'cancelled' | 'already-registered' | 'failed'

/**
 * Sorts a rejection from `createPasskey` or `getPasskey`. The browser reports a dismissed prompt,
 * a timeout and a denied permission alike, so all of them count as the user cancelling.
 */
export function toPasskeyFailure(error: unknown): PasskeyFailure {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError' || error.name === 'AbortError') {
      return 'cancelled'
    }
    // The authenticator already holds one of the excluded credentials
    if (error.name === 'InvalidStateError') return 'already-registered'
  }
  return 'failed'
}
