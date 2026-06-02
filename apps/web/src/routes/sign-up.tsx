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

export const Route = createFileRoute('/sign-up')({ component: SignUp })

const signUpSchema = z
  .object({
    name: z
      .string()
      .min(2, 'Name must be at least 2 characters.')
      .max(64, 'Name must be at most 64 characters.'),
    email: z
      .string()
      .min(1, 'Email is required.')
      .email('Enter a valid email.'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters.')
      .regex(/[A-Z]/, 'Add at least one uppercase letter.')
      .regex(/[0-9]/, 'Add at least one number.'),
    confirm: z.string().min(1, 'Confirm your password.'),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Passwords do not match.',
    path: ['confirm'],
  })

function SignUp() {
  const form = useForm({
    defaultValues: { name: '', email: '', password: '', confirm: '' },
    validators: { onSubmit: signUpSchema },
    onSubmit: async ({ value }) => {
      await new Promise((r) => setTimeout(r, 600))
      toast.success(`Account created for ${value.email}`)
    },
  })

  return (
    <AuthShell
      eyebrow="auth / create account"
      title={
        <>
          Plug in. <br />
          Start sending.
        </>
      }
      subtitle="Free for the first 1,000 conversations per month. No credit card. You can switch tiers later."
      footer={
        <>
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="text-foreground underline underline-offset-4 hover:text-brand"
          >
            Sign in →
          </Link>
        </>
      }
    >
      <form
        id="sign-up-form"
        onSubmit={(e) => {
          e.preventDefault()
          e.stopPropagation()
          void form.handleSubmit()
        }}
      >
        <FieldGroup>
          <form.Field name="name">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Full name</FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    autoComplete="name"
                    placeholder="Asha Patel"
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
                  <FieldLabel htmlFor={field.name}>Password</FieldLabel>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
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
                      8+ characters, one uppercase letter, one number.
                    </FieldDescription>
                  )}
                </Field>
              )
            }}
          </form.Field>

          <form.Field name="confirm">
            {(field) => {
              const isInvalid =
                field.state.meta.isTouched && !field.state.meta.isValid
              return (
                <Field data-invalid={isInvalid}>
                  <FieldLabel htmlFor={field.name}>Confirm password</FieldLabel>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    autoComplete="new-password"
                    placeholder="••••••••"
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
                    Creating account…
                  </>
                ) : (
                  <>
                    Create account
                    <ArrowRightIcon weight="bold" />
                  </>
                )}
              </Button>
            )}
          </form.Subscribe>

          <p className="text-pretty font-mono-tight text-[10px] tracking-wide text-muted-foreground uppercase">
            by continuing you agree to our{' '}
            <a href="#" className="underline underline-offset-4 hover:text-foreground">
              terms
            </a>{' '}
            &{' '}
            <a href="#" className="underline underline-offset-4 hover:text-foreground">
              privacy
            </a>
            .
          </p>
        </FieldGroup>
      </form>
    </AuthShell>
  )
}
