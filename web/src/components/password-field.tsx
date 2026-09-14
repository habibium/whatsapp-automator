import { useId, useRef, useState } from 'react'
import * as stylex from '@stylexjs/stylex'
import {
  Field,
  inputStatusBorderStyles,
  inputStatusFocusWithinStyles,
  inputStatusHoverShadowStyles,
  inputWrapperStyles,
} from '@astryxdesign/core/Field'
import { useInputContainer } from '@astryxdesign/core/hooks'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { mergeProps, themeProps } from '@astryxdesign/core/utils'
import {
  colorVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
  typographyVars,
} from '@astryxdesign/core/theme/tokens.stylex'
import { Eye, EyeOff } from 'lucide-react'

// TextInput has no trailing-action slot, so the shell and the input are raw
// nodes wearing Astryx's own input chrome — nothing here is new styling, it is
// TextInput's wrapper and input rules restated so the two fields match.
const styles = stylex.create({
  shell: { height: sizeVars['--size-element-lg'] },
  input: {
    display: 'block',
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '0%',
    minWidth: 0,
    borderWidth: 0,
    borderStyle: 'none',
    padding: 0,
    outline: 'none',
    backgroundColor: 'transparent',
    color: colorVars['--color-text-primary'],
    fontFamily: typographyVars['--font-family-body'],
    // Matches TextInput: on touch, below 16px iOS zooms the page on focus.
    fontSize: {
      default: typeScaleVars['--text-body-size'],
      '@media (pointer: coarse)': `max(1rem, ${typeScaleVars['--text-body-size']})`,
    },
    lineHeight: typeScaleVars['--text-body-leading'],
    '::placeholder': { color: colorVars['--color-text-secondary'] },
  },
  // Same box as TextInput's clear button, the on-field affordance this
  // replaces, down to the touch-only 24px hit area it grows on coarse pointers.
  reveal: {
    height: spacingVars['--spacing-5'],
    flexShrink: 0,
    position: 'relative',
    // A conditional value is only allowed on a property, not inside `::after`.
    '--_reveal-hit': { default: 'none', '@media (pointer: coarse)': '""' },
    '::after': {
      content: 'var(--_reveal-hit)',
      position: 'absolute',
      inset: `calc(-1 * ${spacingVars['--spacing-0-5']})`,
    },
  },
})

interface PasswordFieldProps {
  label: string
  placeholder?: string
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  htmlName: string
  autoComplete: string
  isInvalid?: boolean
  errorMessage?: string
  isLabelHidden?: boolean
}

export function PasswordField({
  label,
  placeholder,
  value,
  onChange,
  onBlur,
  htmlName,
  autoComplete,
  isInvalid = false,
  errorMessage,
  isLabelHidden = false,
}: PasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false)
  const inputID = useId()
  const messageID = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const shellRef = useRef<HTMLDivElement>(null)
  const status = isInvalid
    ? ({ type: 'error', message: errorMessage, messageID } as const)
    : undefined

  // Clicking the field's padding or its status icon focuses the input, and
  // clicking the reveal does not — the same hook every bordered input uses.
  const { onClick, onMouseUp } = useInputContainer({
    containerRef: shellRef,
    inputRef,
  })

  return (
    <Field
      label={label}
      isLabelHidden={isLabelHidden}
      inputID={inputID}
      isRequired
      status={status}
    >
      <div
        ref={shellRef}
        onClick={onClick}
        onMouseUp={onMouseUp}
        // data-size is load-bearing: Field keys the attached message's overlap
        // off `:has(> [data-size])`, so without it the message sits too high.
        {...mergeProps(
          themeProps('text-input', {
            size: 'lg',
            status: status?.type ?? null,
          }),
          stylex.props(
            inputWrapperStyles.base,
            styles.shell,
            isInvalid && inputStatusBorderStyles.error,
            isInvalid && inputStatusHoverShadowStyles.error,
            isInvalid && inputStatusFocusWithinStyles.error,
          ),
        )}
      >
        <input
          {...stylex.props(styles.input)}
          ref={inputRef}
          id={inputID}
          name={htmlName}
          type={isVisible ? 'text' : 'password'}
          autoComplete={autoComplete}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          aria-describedby={isInvalid && errorMessage ? messageID : undefined}
          aria-invalid={isInvalid || undefined}
          aria-required="true"
        />
        {/* Ahead of the reveal so the button a user aims at never moves. */}
        {isInvalid ? <Icon icon="error" color="error" /> : null}
        <IconButton
          type="button"
          label={isVisible ? 'Hide password' : 'Show password'}
          icon={
            <Icon icon={isVisible ? EyeOff : Eye} size="sm" color="secondary" />
          }
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible((shown) => !shown)}
          xstyle={styles.reveal}
        />
      </div>
    </Field>
  )
}
