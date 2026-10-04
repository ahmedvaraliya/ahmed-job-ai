import { supabaseAdmin } from '../config/supabase'
import type { JobAnalysis } from '../ai/analyzeJob'

export async function saveAnalyzedJob(
  analysis: JobAnalysis,
) {
  // AI rejected the job
  if (analysis.decision !== 'keep') {
    return {
      saved: false,
      reason: 'AI rejected',
    }
  }

  // Validate apply URL BEFORE database lookup
  if (
    !analysis.applyUrl ||
    analysis.applyUrl.includes('example.com')
  ) {
    return {
      saved: false,
      reason: 'Invalid apply URL',
    }
  }

  // Check for existing job
  const { data: existing, error: lookupError } =
    await supabaseAdmin
      .from('jobs')
      .select('id')
      .eq('apply_url', analysis.applyUrl)
      .maybeSingle()

  if (lookupError) {
    throw new Error(
      `Failed to check duplicate job: ${lookupError.message}`,
    )
  }

  if (existing) {
    return {
      saved: false,
      reason: 'Duplicate',
    }
  }

  // Save the verified AI-approved job
  const { error } = await supabaseAdmin
    .from('jobs')
    .insert({
      title: analysis.title,
      company: analysis.company,

      location: analysis.location,
      workplace: analysis.workplace,
      country: analysis.country,
      experience: analysis.experience,
      category: analysis.category,

      salary: analysis.salary,
      description: analysis.description,

      source_name: analysis.sourceName,
      source_url: analysis.sourceUrl,
      apply_url: analysis.applyUrl,

      posted_at: analysis.postedAt || null,

      ai_score: analysis.score,
      ai_reason: analysis.reason,

      is_active: true,
    })

  if (error) {
    // Unique apply_url race-condition protection
    if (error.code === '23505') {
      return {
        saved: false,
        reason: 'Duplicate',
      }
    }

    throw new Error(
      `Failed to save job: ${error.message}`,
    )
  }

  return {
    saved: true,
    reason: 'Saved',
  }
}