import { TextInput } from '@astryxdesign/core/TextInput'

interface EmailFieldProps {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  htmlName: string
  /**
   * `username` on sign-in, so password managers pair it with the saved password; `webauthn` also
   * offers passkeys in its autofill.
   */
  autoComplete?: 'email' | 'username' | 'username webauthn'
  isInvalid?: boolean
  errorMessage?: string
}

export function EmailField({
  value,
  onChange,
  onBlur,
  htmlName,
  autoComplete = 'email',
  isInvalid = false,
  errorMessage,
}: EmailFieldProps) {
  return (
    <TextInput
      label="Email"
      type="email"
      htmlName={htmlName}
      autoComplete={autoComplete}
      placeholder="you@example.com"
      size="lg"
      value={value}
      onChange={(next) => onChange(next)}
      onBlur={onBlur}
      status={isInvalid ? { type: 'error', message: errorMessage } : undefined}
    />
  )
}
