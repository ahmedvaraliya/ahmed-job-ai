import { supabaseAdmin } from '../config/supabase'
import type { JobAnalysis } from '../ai/analyzeJob'

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================
// PERMANENT JOB IDENTITY
//
// Same company + same title = same job.
//
// Example:
// DuckDuckGo + Software Engineer
//
// becomes:
//
// duckduckgo::software engineer
// ============================================================

function createJobKey(
  company = '',
  title = '',
) {
  return (
    `${normalizeText(company)}::` +
    `${normalizeText(title)}`
  )
}

// ============================================================
// SAVE VERIFIED JOB
// ============================================================

export async function saveAnalyzedJob(
  analysis: JobAnalysis,
) {
  // ==========================================================
  // AI REJECTED
  // ==========================================================

  if (analysis.decision !== 'keep') {
    return {
      saved: false,
      reason: 'AI rejected',
    }
  }

  // ==========================================================
  // VALIDATE APPLY URL
  // ==========================================================

  if (
    !analysis.applyUrl ||
    analysis.applyUrl.includes('example.com')
  ) {
    return {
      saved: false,
      reason: 'Invalid apply URL',
    }
  }

  // ==========================================================
  // VALIDATE COMPANY + TITLE
  // ==========================================================

  if (
    !analysis.company?.trim() ||
    !analysis.title?.trim()
  ) {
    return {
      saved: false,
      reason: 'Missing company or title',
    }
  }

  // ==========================================================
  // CREATE PERMANENT JOB KEY
  // ==========================================================

  const jobKey = createJobKey(
    analysis.company,
    analysis.title,
  )

  // ==========================================================
  // CHECK JOB KEY
  //
  // This is the MAIN duplicate protection.
  // ==========================================================

  const {
    data: existingByKey,
    error: keyLookupError,
  } = await supabaseAdmin
    .from('jobs')
    .select('id,company,title,apply_url')
    .eq('job_key', jobKey)
    .maybeSingle()

  if (keyLookupError) {
    throw new Error(
      `Failed to check job identity: ${keyLookupError.message}`,
    )
  }

  if (existingByKey) {
    return {
      saved: false,
      reason: 'Duplicate',
    }
  }

  // ==========================================================
  // SECONDARY CHECK: APPLY URL
  //
  // Keeps protection against same URL with different metadata.
  // ==========================================================

  const {
    data: existingByUrl,
    error: urlLookupError,
  } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .eq('apply_url', analysis.applyUrl)
    .maybeSingle()

  if (urlLookupError) {
    throw new Error(
      `Failed to check duplicate URL: ${urlLookupError.message}`,
    )
  }

  if (existingByUrl) {
    return {
      saved: false,
      reason: 'Duplicate',
    }
  }

  // ==========================================================
  // INSERT
  // ==========================================================

  const { error } =
    await supabaseAdmin
      .from('jobs')
      .insert({
        job_key: jobKey,

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

        posted_at:
          analysis.postedAt || null,

        ai_score: analysis.score,
        ai_reason: analysis.reason,

        is_active: true,
      })

  // ==========================================================
  // DATABASE UNIQUE CONSTRAINT
  //
  // Even if two runs happen at exactly the same time,
  // PostgreSQL will reject the second copy.
  // ==========================================================

  if (error) {
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