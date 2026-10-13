// Variáveis do Supabase (definidas em .env.local e, na Vercel, nas Environment Variables do projeto)

export function supabaseUrl() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_URL não configurada.");
  return v;
}

export function supabasePublishableKey() {
  const v = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!v) throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY não configurada.");
  return v;
}

export function supabaseSecretKey() {
  const v = process.env.SUPABASE_SECRET_KEY;
  if (!v) throw new Error("SUPABASE_SECRET_KEY não configurada.");
  return v;
}

export function setupSecret() {
  const v = process.env.SETUP_SECRET;
  if (!v || v.length < 16) throw new Error("SETUP_SECRET precisa ter pelo menos 16 caracteres.");
  return v;
}
