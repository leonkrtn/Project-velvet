import { redirect } from 'next/navigation'

// Zusammengeführt in die einheitliche Signup-Seite (/signup, Modus „Als Brautpaar").
export default function BrautpaarSignupRedirect() {
  redirect('/signup')
}
