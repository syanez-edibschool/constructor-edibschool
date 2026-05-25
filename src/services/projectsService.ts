import { supabase } from './supabase'

export interface Project {
  id: string
  user_id: string
  name: string
  description: string
  progress: number
  current_step: number
  total_steps: number
  status: string
  created_at: string
  updated_at: string
}

export async function getProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('updated_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data || []
}

export async function createProject(name: string, description: string): Promise<Project> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      name: name.trim(),
      description: description.trim(),
      progress: 0,
      current_step: 1,
      total_steps: 5,
      status: 'in_progress',
    })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}

export async function deleteProject(id: string): Promise<void> {
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function updateProject(id: string, updates: Partial<Project>): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(error.message)
}

const REQUIRED_QUESTION_IDS = [
  'industry','model','size','geography','problem','experience','tech_level','urgency',
  'avatar_age','avatar_gender','avatar_income','avatar_goal','avatar_pain','avatar_dream','avatar_objection','avatar_decision',
  'comp_quantity','comp_type','comp_price','comp_weakness','comp_strength','diff_factor','market_trend','market_reg',
  'service_main','delivery','result_time','ticket',
  'content_style','content_channel',
]

export async function saveAnswers(projectId: string, answers: Record<string, string>): Promise<void> {
  // Guard: all 30 questions must be answered before saving
  const missing = REQUIRED_QUESTION_IDS.filter(qId => !answers[qId] || answers[qId].trim() === '')
  if (missing.length > 0) {
    throw new Error(`Faltan ${missing.length} pregunta(s) por responder. Completa el formulario.`)
  }

  const { error: upsertErr } = await supabase
    .from('project_questions')
    .upsert({ project_id: projectId, answers_json: answers }, { onConflict: 'project_id' })
  if (upsertErr) throw new Error(upsertErr.message)

  const { error: updateErr } = await supabase
    .from('projects')
    .update({ current_step: 2, progress: 20, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (updateErr) throw new Error(updateErr.message)
}

export async function getAnswers(projectId: string): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from('project_questions')
    .select('answers_json')
    .eq('project_id', projectId)
    .single()

  if (error) return {}
  return data?.answers_json || {}
}
