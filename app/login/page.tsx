import { googleConfigured } from '@/lib/google-auth'
import { passcodeLoginOn } from '@/lib/session'
import LoginForm from './LoginForm'

// The lock screen. Excluded from the gate in proxy.ts (you can't log in through a
// locked login page). Server wrapper: it knows which doors are open and passes that on.
export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  return <LoginForm google={googleConfigured()} passcode={passcodeLoginOn()} initialError={error ?? ''} />
}
