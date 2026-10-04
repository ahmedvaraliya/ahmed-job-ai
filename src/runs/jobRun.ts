import { supabaseAdmin } from '../config/supabase'

export async function startJobRun() {
  const { data, error } = await supabaseAdmin
    .from('job_runs')
    .insert({
      status: 'running',
    })
    .select('id')
    .single()

  if (error) {
    throw new Error(
      `Failed to start job run: ${error.message}`,
    )
  }

  return data.id
}

export async function finishJobRun(
  runId: string,
  summary: {
    collected: number
    validApplyUrls: number
    unique: number
    likelyRelevant: number
    analyzed: number
    saved: number
    rejected: number
    duplicates: number
    failed: number
  },
) {
  const { error } = await supabaseAdmin
    .from('job_runs')
    .update({
      finished_at: new Date().toISOString(),

      status:
        summary.failed > 0
          ? 'completed_with_errors'
          : 'completed',

      collected: summary.collected,
      valid_apply_urls:
        summary.validApplyUrls,
      unique_jobs: summary.unique,
      likely_relevant:
        summary.likelyRelevant,
      analyzed: summary.analyzed,
      saved: summary.saved,
      rejected: summary.rejected,
      duplicates: summary.duplicates,
      failed: summary.failed,
    })
    .eq('id', runId)

  if (error) {
    throw new Error(
      `Failed to finish job run: ${error.message}`,
    )
  }
}

export async function failJobRun(
  runId: string,
  errorMessage: string,
) {
  await supabaseAdmin
    .from('job_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: 'failed',
      error_message: errorMessage,
    })
    .eq('id', runId)
}