import { useState } from 'react'
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react'
import { Input } from '~/components/ui/input'
import { cn } from '~/lib/utils'

type PasswordInputProps = Omit<React.ComponentProps<'input'>, 'type'>

function PasswordInput({ className, ...props }: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <Input
        type={visible ? 'text' : 'password'}
        className={cn('pe-8', className)}
        {...props}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        className="absolute end-0 top-0 inline-flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none"
      >
        {visible ? (
          <EyeSlashIcon className="size-3.5" weight="bold" />
        ) : (
          <EyeIcon className="size-3.5" weight="bold" />
        )}
      </button>
    </div>
  )
}

export { PasswordInput }
