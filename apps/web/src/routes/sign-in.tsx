import { Link, createFileRoute } from '@tanstack/react-router'
import { useForm } from '@tanstack/react-form'
import { ArrowRightIcon, SpinnerIcon } from '@phosphor-icons/react'
import { toast } from 'sonner'
import * as z from 'zod'
import { AuthShell } from '~/components/auth-shell'
import { Button } from '~/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '~/components/ui/field'
import { Input } from '~/components/ui/input'
import { PasswordInput } from '~/components/ui/password-input'

export const Route = createFileRoute('/sign-in')({ component: SignIn })

const signInSchema = z.object({
  email: z.string().min(1, 'Email is required.').email('Enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
})

function SignIn() {
  const form = useForm({
    defaultValues: { email: '', password: '' },
    validators: { onSubmit: signInSchema },
    onSubmit: async ({ value }) => {
      await new Promise((r) => setTimeout(r, 600))
      toast.success(`Welcome back, ${value.email}`)
    },
  })

  return (
    <AuthShell
      eyebrow="auth / sign in"
      title="Welcome back."
      subtitle="Pick up where you left off. Your queues, templates and webhooks are waiting."
      footer={
        <>
          New here?{' '}
          <Link
            to="/sign-up"
            className="text-foreground underline underline-offset-4 hover:text-brand"
          >
            Create an account →
          </Link>
        </>
      }
    >
      <form
        id="sign-in-form"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Work email</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : null}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="password">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <div className="flex items-center justify-between">
                    <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                    <Link
                      to="/sign-in"
                      className="font-mono-tight text-[10px] text-muted-foreground hover:text-foreground"
                    >
                      forgot?
                    </Link>
                  </div>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    aria-invalid={isInvalid}
                  />
                  {isInvalid ? (
                    <FieldError errors={field.state.meta.errors} />
                  ) : (
                    <FieldDescription>
                      8+ characters. Case sensitive.
                    </FieldDescription>
                  )}
                </Field>
              )
            }}
          </form.Field>

          <form.Subscribe selector={(s) => [s.canSubmit, s.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                size="lg"
                disabled={!canSubmit}
                className="w-full bg-brand text-brand-foreground hover:bg-brand/90"
              >
                {isSubmitting ? (
                  <>
                    <SpinnerIcon className="animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in
                    <ArrowRightIcon weight="bold" />
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
