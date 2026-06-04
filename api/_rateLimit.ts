// Límite de generaciones de IA por usuario (anti-abuso / control de costo).
// El prefijo "_" hace que Vercel NO trate este archivo como un endpoint.
//
// Cuenta las generaciones del usuario en la última hora (la tabla ai_usage está
// protegida por RLS, así que cada usuario solo cuenta las suyas) y bloquea si
// supera el límite. Es FAIL-OPEN: ante cualquier error (p.ej. si la tabla ai_usage
// todavía no existe) PERMITE generar, para no bloquear a nadie por un fallo del límite.
import type { SupabaseClient } from '@supabase/supabase-js'

const HOURLY_LIMIT = Number(process.env.AI_HOURLY_LIMIT || '50')

export async function checkAndLogUsage(
  db: SupabaseClient,
  toolId: string,
): Promise<{ allowed: boolean; limit: number }> {
  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const { count, error } = await db
      .from('ai_usage')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', since)

    // Fail-open: si la tabla no existe o hay error, no bloqueamos.
    if (error) return { allowed: true, limit: HOURLY_LIMIT }
    if ((count ?? 0) >= HOURLY_LIMIT) return { allowed: false, limit: HOURLY_LIMIT }

    // Registrar el uso (user_id se autocompleta con auth.uid() por defecto en la tabla).
    await db.from('ai_usage').insert({ tool_id: toolId })
    return { allowed: true, limit: HOURLY_LIMIT }
  } catch {
    return { allowed: true, limit: HOURLY_LIMIT }
  }
}
