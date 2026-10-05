import { supabaseAdmin } from '../config/supabase'
import type { JobAnalysis } from '../ai/analyzeJob'

// ============================================================
// TEXT NORMALIZATION
// ============================================================

function normalizeText(
  value = '',
) {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}


// ============================================================
// URL NORMALIZATION
//
// Removes common tracking parameters so these are treated as
// the same application URL:
//
// https://example.com/apply
//
// https://example.com/apply?utm_source=linkedin
//
// https://example.com/apply?utm_source=google
//
// ============================================================

function normalizeUrl(
  value = '',
) {
  const raw =
    value.trim()

  if (!raw) {
    return ''
  }

  try {
    const url =
      new URL(raw)

    url.hash = ''

    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'utm_id',
      'fbclid',
      'gclid',
      'ref',
      'referrer',
      'source',
    ]

    for (
      const parameter of trackingParams
    ) {
      url.searchParams.delete(
        parameter,
      )
    }

    return url
      .toString()
      .replace(/\/$/, '')
      .toLowerCase()

  } catch {
    return normalizeText(
      raw,
    )
  }
}


// ============================================================
// APPLY URL VALIDATION
// ============================================================

function isValidApplyUrl(
  value = '',
) {
  if (!value) {
    return false
  }

  if (
    value.includes(
      'example.com',
    )
  ) {
    return false
  }

  try {
    const url =
      new URL(value)

    if (
      url.protocol !==
        'http:' &&
      url.protocol !==
        'https:'
    ) {
      return false
    }

    return true

  } catch {
    return false
  }
}


// ============================================================
// LOCATION HELPERS
// ============================================================

const MUMBAI_KEYWORDS = [
  'mumbai',
  'bombay',
  'navi mumbai',
  'thane',
  'mumbai metropolitan region',
  'mumbai metropolitan',
  'mmr',
]


const USA_KEYWORDS = [
  'united states',
  'united states of america',
  'usa',
  'u.s.',
  'u.s.a',
  'new york',
  'california',
  'texas',
  'washington',
  'florida',
  'massachusetts',
  'illinois',
  'new jersey',
  'virginia',
  'colorado',
  'arizona',
  'georgia',
  'north carolina',
  'pennsylvania',
  'oregon',
]


function getLocationGroup(
  analysis: JobAnalysis,
) {
  const location =
    normalizeText(
      `${analysis.location || ''} ${
        analysis.country || ''
      } ${analysis.workplace || ''}`,
    )

  const isMumbai =
    MUMBAI_KEYWORDS.some(
      (keyword) =>
        location.includes(
          keyword,
        ),
    )

  if (isMumbai) {
    return 'mumbai'
  }


  const isUSA =
    USA_KEYWORDS.some(
      (keyword) =>
        location.includes(
          keyword,
        ),
    )

  if (isUSA) {
    return 'usa'
  }


  return 'other'
}


// ============================================================
// TARGET ROLE VALIDATION
//
// Save layer has a second safety check.
//
// Gemini should already filter these roles, but database save
// should NEVER blindly trust an AI response.
// ============================================================

const TARGET_ROLE_KEYWORDS = [
  'frontend developer',
  'front end developer',
  'front-end developer',

  'frontend engineer',
  'front end engineer',
  'front-end engineer',

  'react developer',
  'react.js developer',
  'reactjs developer',
  'react engineer',

  'javascript developer',
  'javascript engineer',
  'js developer',

  'web developer',
  'web engineer',

  'ui developer',
  'ui engineer',

  'user interface developer',

  'wordpress developer',
  'wordpress engineer',
  'wordpress web developer',

  'woocommerce developer',
  'woocommerce engineer',

  'web designer developer',
  'web designer/developer',
]


const BLOCKED_ROLE_KEYWORDS = [
  // Sales
  'account executive',
  'account manager',
  'sales executive',
  'sales manager',
  'sales representative',
  'sales development',
  'business development',
  'business development representative',
  'bdr',
  'sdr',

  // Marketing
  'marketing',
  'product marketing',
  'partner marketing',
  'digital marketing',
  'social media',
  'content marketing',

  // Customer success
  'customer success',
  'client success',

  // HR
  'human resources',
  'hr manager',
  'recruiter',
  'recruitment',
  'talent acquisition',

  // Finance
  'accountant',
  'accounting',
  'financial analyst',
  'finance manager',
  'investment banking',

  // Legal
  'lawyer',
  'attorney',
  'legal counsel',

  // Other
  'doctor',
  'nurse',
  'nursing',
  'teacher',
  'hospitality',
  'restaurant',
  'hotel',
  'retail',
  'store manager',
  'receptionist',
  'warehouse',
  'delivery',
  'logistics',

  // Other technology fields that are NOT Ahmed's target
  'backend developer',
  'backend engineer',

  'full stack developer',
  'full-stack developer',
  'full stack engineer',
  'full-stack engineer',

  'software engineer',
  'software developer',

  'devops',
  'devops engineer',

  'cloud engineer',
  'cloud architect',

  'site reliability engineer',
  'sre',

  'cybersecurity',
  'security engineer',
  'security analyst',
  'soc analyst',

  'data analyst',
  'data scientist',
  'data engineer',

  'machine learning',
  'machine learning engineer',
  'ai engineer',

  'database engineer',
  'database administrator',
  'dba',

  'qa engineer',
  'quality assurance',
  'test engineer',
  'sdet',

  'network engineer',
  'networking',

  'system administrator',
  'systems administrator',
  'systems engineer',

  'technical support',
  'it support',
  'help desk',

  'solutions architect',
  'software architect',

  'product manager',
  'program manager',
  'project manager',

  'technical writer',
  'technology consultant',
  'it consultant',
]


function isTargetRole(
  analysis: JobAnalysis,
) {
  const title =
    normalizeText(
      `${analysis.title || ''} ${
        analysis.category || ''
      }`,
    )


  // First check explicit blocked roles.
  const blocked =
    BLOCKED_ROLE_KEYWORDS.some(
      (keyword) =>
        title.includes(
          keyword,
        ),
    )

  if (blocked) {
    return false
  }


  // Then require an actual target role.
  return TARGET_ROLE_KEYWORDS.some(
    (keyword) =>
      title.includes(
        keyword,
      ),
  )
}


// ============================================================
// PERMANENT JOB IDENTITY
//
// IMPORTANT:
//
// Old version:
//
// company::title
//
// New version:
//
// company::title::location
//
// Example:
//
// duckduckgo::frontend developer::mumbai
//
// This prevents unrelated locations from being considered the
// same job while still protecting against repeated listings.
// ============================================================

function createJobKey(
  company = '',
  title = '',
  location = '',
) {
  return (
    `${normalizeText(company)}::` +
    `${normalizeText(title)}::` +
    `${normalizeText(location)}`
  )
}


// ============================================================
// ALTERNATIVE IDENTITY
//
// Used for extra protection when location formatting changes.
//
// Example:
//
// "Mumbai, Maharashtra"
// "Mumbai"
//
// still represents the same company/title/location family.
// ============================================================

function createCompanyTitleKey(
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
  // 1. AI DECISION
  // ==========================================================

  if (
    analysis.decision !==
    'keep'
  ) {
    return {
      saved: false,
      reason: 'AI rejected',
    }
  }


  // ==========================================================
  // 2. APPLY URL
  // ==========================================================

  if (
    !isValidApplyUrl(
      analysis.applyUrl,
    )
  ) {
    return {
      saved: false,
      reason: 'Invalid apply URL',
    }
  }


  const normalizedApplyUrl =
    normalizeUrl(
      analysis.applyUrl,
    )


  if (!normalizedApplyUrl) {
    return {
      saved: false,
      reason: 'Invalid apply URL',
    }
  }


  // ==========================================================
  // 3. COMPANY + TITLE
  // ==========================================================

  if (
    !analysis.company?.trim() ||
    !analysis.title?.trim()
  ) {
    return {
      saved: false,
      reason:
        'Missing company or title',
    }
  }


  // ==========================================================
  // 4. LOCATION
  // ==========================================================

  const locationGroup =
    getLocationGroup(
      analysis,
    )


  if (
    locationGroup ===
    'other'
  ) {
    return {
      saved: false,
      reason:
        'Location outside Mumbai/USA',
    }
  }


  // ==========================================================
  // 5. TARGET ROLE
  // ==========================================================

  if (
    !isTargetRole(
      analysis,
    )
  ) {
    return {
      saved: false,
      reason:
        'Role outside target frontend/web/WordPress roles',
    }
  }


  // ==========================================================
  // 6. CREATE JOB KEY
  // ==========================================================

  const jobKey =
    createJobKey(
      analysis.company,
      analysis.title,
      analysis.location,
    )


  const companyTitleKey =
    createCompanyTitleKey(
      analysis.company,
      analysis.title,
    )


  // ==========================================================
  // 7. CHECK EXACT JOB KEY
  //
  // MAIN DATABASE DUPLICATE PROTECTION
  // ==========================================================

  const {
    data: existingByKey,
    error: keyLookupError,
  } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company, title, location, apply_url, job_key',
    )
    .eq(
      'job_key',
      jobKey,
    )
    .maybeSingle()


  if (keyLookupError) {
    throw new Error(
      `Failed to check job identity: ${keyLookupError.message}`,
    )
  }


  if (
    existingByKey
  ) {
    return {
      saved: false,
      reason: 'Duplicate',
    }
  }


  // ==========================================================
  // 8. CHECK APPLY URL
  //
  // Same URL with different title/company/location should still
  // be considered the same job.
  // ==========================================================

  const {
    data: existingByUrl,
    error: urlLookupError,
  } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company, title, location, apply_url',
    )
    .eq(
      'apply_url',
      normalizedApplyUrl,
    )
    .maybeSingle()


  if (urlLookupError) {
    throw new Error(
      `Failed to check duplicate URL: ${urlLookupError.message}`,
    )
  }


  if (
    existingByUrl
  ) {
    return {
      saved: false,
      reason: 'Duplicate',
    }
  }


  // ==========================================================
  // 9. EXTRA COMPANY + TITLE CHECK
  //
  // This catches older records created with the old key format
  // and protects against location formatting changes.
  //
  // We intentionally fetch matching company/title rows instead
  // of using a direct .eq() with a generated key because older
  // records may have a different job_key format.
  // ==========================================================

  const {
    data: existingByCompanyTitle,
    error:
      companyTitleLookupError,
  } = await supabaseAdmin
    .from('jobs')
    .select(
      'id, company, title, location, apply_url, job_key',
    )
    .ilike(
      'company',
      analysis.company,
    )
    .ilike(
      'title',
      analysis.title,
    )


  if (
    companyTitleLookupError
  ) {
    throw new Error(
      `Failed to check company/title duplicate: ${companyTitleLookupError.message}`,
    )
  }


  if (
    existingByCompanyTitle &&
    existingByCompanyTitle.length >
      0
  ) {

    const duplicateByCompanyTitle =
      existingByCompanyTitle.some(
        (
          existing,
        ) => {

          const existingKey =
            createCompanyTitleKey(
              existing.company,
              existing.title,
            )


          // Same company + same title is considered the same
          // opening unless the application URL proves otherwise.
          //
          // This also protects older database records whose
          // job_key was generated by the previous implementation.

          if (
            existingKey ===
            companyTitleKey
          ) {
            return true
          }


          return false
        },
      )


    if (
      duplicateByCompanyTitle
    ) {
      return {
        saved: false,
        reason: 'Duplicate',
      }
    }
  }


  // ==========================================================
  // 10. INSERT
  // ==========================================================

  const {
    error,
  } =
    await supabaseAdmin
      .from('jobs')
      .insert({
        job_key:
          jobKey,

        title:
          analysis.title,

        company:
          analysis.company,

        location:
          analysis.location,

        workplace:
          analysis.workplace,

        country:
          analysis.country,

        experience:
          analysis.experience,

        category:
          analysis.category,

        salary:
          analysis.salary,

        description:
          analysis.description,

        source_name:
          analysis.sourceName,

        source_url:
          analysis.sourceUrl,

        apply_url:
          normalizedApplyUrl,

        posted_at:
          analysis.postedAt ||
          null,

        ai_score:
          analysis.score,

        ai_reason:
          analysis.reason,

        is_active:
          true,
      })


  // ==========================================================
  // 11. DATABASE UNIQUE CONSTRAINT
  //
  // PostgreSQL remains the final protection if two workflow
  // runs try to insert the same job simultaneously.
  // ==========================================================

  if (error) {

    if (
      error.code ===
      '23505'
    ) {
      return {
        saved: false,
        reason: 'Duplicate',
      }
    }


    throw new Error(
      `Failed to save job: ${error.message}`,
    )
  }


  // ==========================================================
  // 12. SUCCESS
  // ==========================================================

  return {
    saved: true,
    reason: 'Saved',
    locationGroup,
    jobKey,
  }
}