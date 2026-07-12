import { redirect } from 'next/navigation'

// Zusammengeführt in die einheitliche Signup-Seite (/signup, Modus „Als Dienstleister").
export default function DienstleisterSignupRedirect() {
  redirect('/signup?mode=dienstleister')
}
