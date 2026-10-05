import { analyzeJob } from '../ai/analyzeJob'
import { saveAnalyzedJob } from './saveJob'
import { supabaseAdmin } from '../config/supabase'

import {
  fetchArbeitnowJobs,
} from '../sources/arbeitnow'

import type { RawJob } from '../sources/lever'

// ============================================================
// AHMED JOB HUNTER
// ============================================================
//
// FINAL TARGET
//
// 🇮🇳 Mumbai / MMR = 8 jobs
// 🇺🇸 USA          = 2 jobs
//
// Allowed work modes:
// Remote / Hybrid / On-site
//
// Allowed roles:
// Frontend / React / JavaScript / Web / UI / WordPress
//
// Everything else is rejected.
//
// ============================================================


// ============================================================
// CONSTANTS
// ============================================================

const MUMBAI_TARGET = 8
const USA_TARGET = 2

const TOTAL_TARGET =
  MUMBAI_TARGET + USA_TARGET

// Gemini will be allowed to inspect enough candidates
// to actually fill the quotas instead of blindly checking
// only the first 10 jobs.
const MAX_MUMBAI_AI_CANDIDATES = 30
const MAX_USA_AI_CANDIDATES = 20

// Minimum delay between Gemini requests.
// This protects the free-tier rate limit.
const GEMINI_DELAY_MS = 6000


// ============================================================
// BASIC HELPERS
// ============================================================

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}


// ------------------------------------------------------------
// URL NORMALIZATION
// ------------------------------------------------------------

function normalizeUrl(value = '') {
  try {
    const url = new URL(value)

    // Remove fragments.
    url.hash = ''

    // Remove common tracking parameters.
    const trackingParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
      'source',
      'src',
      'tracking',
      'trk',
      'gh_src',
    ]

    for (const parameter of trackingParams) {
      url.searchParams.delete(parameter)
    }

    // Sort remaining params.
    url.searchParams.sort()

    if (url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }

    return url.toString().toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}


// ------------------------------------------------------------
// HTTP URL CHECK
// ------------------------------------------------------------

function isValidHttpUrl(value = '') {
  try {
    const url = new URL(value)

    return (
      url.protocol === 'http:' ||
      url.protocol === 'https:'
    )
  } catch {
    return false
  }
}


// ------------------------------------------------------------
// SLEEP
// ------------------------------------------------------------

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}


// ============================================================
// ROLE FILTERING
// ============================================================
//
// IMPORTANT:
//
// We are NOT looking for "any IT job".
//
// Ahmed specifically wants:
// Frontend / Web / React / JavaScript / UI / WordPress.
//
// ============================================================

const allowedRoleKeywords = [
  // Frontend
  'frontend developer',
  'front end developer',
  'front-end developer',

  'frontend engineer',
  'front end engineer',
  'front-end engineer',

  'frontend developer',
  'frontend engineer',

  // React
  'react developer',
  'react engineer',
  'react.js developer',
  'reactjs developer',

  // JavaScript
  'javascript developer',
  'javascript engineer',
  'js developer',

  // Web
  'web developer',
  'web engineer',
  'web development',

  // UI
  'ui developer',
  'ui engineer',
  'user interface developer',
  'user interface engineer',

  // WordPress
  'wordpress developer',
  'wordpress engineer',
  'wordpress web developer',
  'wordpress developer',
  'wordpress designer developer',

  // WooCommerce
  'woocommerce developer',
  'woocommerce engineer',

  // Relevant web design + development
  'web designer developer',
  'web designer/developer',
  'web design developer',
]


// ============================================================
// HARD ROLE BLOCK LIST
// ============================================================
//
// These roles should never reach Gemini unless the title
// genuinely contains an allowed technical role.
//
// ============================================================

const blockedRoleKeywords = [
  // Sales
  'account executive',
  'sales executive',
  'sales manager',
  'sales representative',
  'sales development',
  'business development',
  'business development representative',
  'bdr',
  'sdr',

  // Marketing
  'marketing manager',
  'marketing director',
  'marketing specialist',
  'marketing coordinator',
  'product marketing',
  'partner marketing',
  'digital marketing',
  'content marketing',
  'social media manager',
  'seo specialist',
  'seo manager',

  // Customer success
  'customer success',
  'customer success manager',
  'customer success partner',
  'client success',

  // HR
  'human resources',
  'human resource',
  'hr manager',
  'hr specialist',
  'recruiter',
  'recruitment',
  'talent acquisition',

  // Finance
  'accountant',
  'accounting',
  'financial analyst',
  'finance manager',
  'investment banker',
  'banking',

  // Operations
  'operations manager',
  'operations specialist',
  'business operations',

  // Legal
  'lawyer',
  'legal counsel',
  'attorney',

  // Medical
  'doctor',
  'nurse',
  'medical doctor',

  // Education
  'teacher',
  'teaching',
  'professor',

  // Hospitality
  'hotel manager',
  'hospitality',
  'chef',
  'restaurant manager',

  // Retail
  'retail manager',
  'store manager',

  // Logistics
  'warehouse',
  'delivery driver',
  'driver',
  'logistics manager',

  // Construction
  'construction',
  'civil engineer',
  'mechanical engineer',
  'electrical engineer',
  'chemical engineer',
  'structural engineer',
]


// ============================================================
// LOCATION KEYWORDS
// ============================================================

const mumbaiKeywords = [
  'mumbai',
  'bombay',
  'mumbai metropolitan region',
  'mumbai metropolitan',
  'mmr',
  'navi mumbai',
  'thane',
]


const indiaKeywords = [
  'india',
  'indian',
]


const usaKeywords = [
  'united states',
  'united states of america',
  'usa',
  'u.s.a.',
  'u.s.',
  'us',
]


// ============================================================
// LOCATION HELPERS
// ============================================================
//
// VERY IMPORTANT:
//
// We intentionally do NOT include description/title here.
//
// Otherwise a job description saying:
// "We have offices in Mumbai"
// could incorrectly become a Mumbai job.
//
// ============================================================

function getStrictLocationText(job: RawJob) {
  return normalizeText(
    [
      job.location,
      job.country,
      job.workplace,
    ]
      .filter(Boolean)
      .join(' '),
  )
}


function getJobTitleText(job: RawJob) {
  return normalizeText(
    [
      job.title,
      job.category,
    ]
      .filter(Boolean)
      .join(' '),
  )
}


// ============================================================
// MUMBAI DETECTION
// ============================================================

function isMumbaiJob(job: RawJob) {
  const locationText =
    getStrictLocationText(job)

  return mumbaiKeywords.some(
    (keyword) =>
      locationText.includes(keyword),
  )
}


// ============================================================
// USA DETECTION
// ============================================================

function isUSAJob(job: RawJob) {
  const locationText =
    getStrictLocationText(job)

  return usaKeywords.some(
    (keyword) =>
      locationText.includes(keyword),
  )
}


// ============================================================
// INDIA DETECTION
// ============================================================

function isIndiaJob(job: RawJob) {
  const locationText =
    getStrictLocationText(job)

  return indiaKeywords.some(
    (keyword) =>
      locationText.includes(keyword),
  )
}


// ============================================================
// WORKPLACE DETECTION
// ============================================================

function getWorkplaceType(job: RawJob) {
  const text = normalizeText(
    [
      job.location,
      job.country,
      job.workplace,
    ]
      .filter(Boolean)
      .join(' '),
  )

  if (
    text.includes('remote') ||
    text.includes('work from home') ||
    text.includes('wfh')
  ) {
    return 'remote'
  }

  if (
    text.includes('hybrid')
  ) {
    return 'hybrid'
  }

  if (
    text.includes('on-site') ||
    text.includes('onsite') ||
    text.includes('on site')
  ) {
    return 'onsite'
  }

  return 'unknown'
}


// ============================================================
// ALLOWED ROLE CHECK
// ============================================================

function hasAllowedRole(job: RawJob) {
  const title =
    getJobTitleText(job)

  return allowedRoleKeywords.some(
    (keyword) =>
      title.includes(keyword),
  )
}


// ============================================================
// BLOCKED ROLE CHECK
// ============================================================

function hasBlockedRole(job: RawJob) {
  const title =
    getJobTitleText(job)

  return blockedRoleKeywords.some(
    (keyword) =>
      title.includes(keyword),
  )
}


// ============================================================
// TARGET ROLE CHECK
// ============================================================

function isTargetRole(job: RawJob) {
  const allowed =
    hasAllowedRole(job)

  const blocked =
    hasBlockedRole(job)

  // Explicit target role always wins only when
  // the title is clearly technical.
  if (allowed) {
    return true
  }

  if (blocked) {
    return false
  }

  return false
}


// ============================================================
// TARGET LOCATION CHECK
// ============================================================

function getLocationBucket(
  job: RawJob,
): 'mumbai' | 'usa' | 'other' {
  if (isMumbaiJob(job)) {
    return 'mumbai'
  }

  if (isUSAJob(job)) {
    return 'usa'
  }

  return 'other'
}


// ============================================================
// CANDIDATE ELIGIBILITY
// ============================================================

function isMumbaiCandidate(job: RawJob) {
  return (
    isMumbaiJob(job) &&
    isTargetRole(job)
  )
}


function isUSACandidate(job: RawJob) {
  return (
    isUSAJob(job) &&
    isTargetRole(job)
  )
}


// ============================================================
// PRIORITY SCORE
// ============================================================
//
// This is NOT the final AI decision.
//
// It only determines which candidate should be shown
// to Gemini first.
//
// ============================================================

function getPriorityScore(job: RawJob) {
  const title =
    normalizeText(job.title)

  const location =
    getStrictLocationText(job)

  let score = 0


  // ----------------------------------------------------------
  // LOCATION
  // ----------------------------------------------------------

  if (isMumbaiJob(job)) {
    score += 200
  }

  if (isUSAJob(job)) {
    score += 150
  }


  // ----------------------------------------------------------
  // ROLE
  // ----------------------------------------------------------

  if (
    title.includes('frontend') ||
    title.includes('front end') ||
    title.includes('front-end')
  ) {
    score += 100
  }

  if (
    title.includes('react')
  ) {
    score += 90
  }

  if (
    title.includes('javascript')
  ) {
    score += 80
  }

  if (
    title.includes('wordpress')
  ) {
    score += 80
  }

  if (
    title.includes('woocommerce')
  ) {
    score += 75
  }

  if (
    title.includes('web developer') ||
    title.includes('web engineer')
  ) {
    score += 70
  }

  if (
    title.includes('ui developer') ||
    title.includes('ui engineer')
  ) {
    score += 70
  }


  // ----------------------------------------------------------
  // WORKPLACE
  // ----------------------------------------------------------

  const workplace =
    getWorkplaceType(job)

  if (workplace === 'remote') {
    score += 30
  }

  if (workplace === 'hybrid') {
    score += 20
  }

  if (workplace === 'onsite') {
    score += 10
  }


  // ----------------------------------------------------------
  // FRESHNESS
  // ----------------------------------------------------------

  if (job.postedAt) {
    const postedTime =
      new Date(
        job.postedAt,
      ).getTime()

    if (
      Number.isFinite(
        postedTime,
      )
    ) {
      const hoursAgo =
        Math.max(
          0,
          Date.now() -
            postedTime,
        ) / 3600000

      if (hoursAgo <= 24) {
        score += 40
      } else if (hoursAgo <= 72) {
        score += 25
      } else if (hoursAgo <= 168) {
        score += 10
      }
    }
  }


  // Keep variable used for future debugging.
  void location

  return score
}


// ============================================================
// STABLE JOB KEY
// ============================================================
//
// Used for duplicate prevention inside the same run.
//
// ============================================================

function createJobIdentity(job: RawJob) {
  const url =
    normalizeUrl(
      job.applyUrl || '',
    )

  const company =
    normalizeText(
      job.company || '',
    )

  const title =
    normalizeText(
      job.title || '',
    )

  const location =
    normalizeText(
      job.location || '',
    )

  return [
    url,
    company,
    title,
    location,
  ].join('::')
}


// ============================================================
// MAIN PIPELINE
// ============================================================

export async function runJobPipeline() {
  console.log(
    '\n🤖 AHMED JOB HUNTER',
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    `🎯 TARGET: ${MUMBAI_TARGET} Mumbai + ${USA_TARGET} USA`,
  )

  console.log(
    '🎨 ROLES: Frontend / React / JavaScript / Web / UI / WordPress',
  )

  console.log(
    '🌍 COUNTRIES: Mumbai, India + USA only',
  )

  console.log(
    '💼 WORKPLACE: Remote / Hybrid / On-site',
  )

  // ==========================================================
  // FETCH SOURCES
  // ==========================================================

  const allJobs: RawJob[] = []

  console.log(
    '\n🔎 Fetching Arbeitnow...',
  )

  try {
    const jobs =
      await fetchArbeitnowJobs()

    console.log(
      `   📥 ${jobs.length} jobs`,
    )

    allJobs.push(...jobs)
  } catch (error) {
    console.error(
      '⚠️ Arbeitnow failed:',
      error instanceof Error
        ? error.message
        : String(error),
    )
  }


  console.log(
    `📦 TOTAL COLLECTED: ${allJobs.length}`,
  )


  // ==========================================================
  // VALID URL FILTER
  // ==========================================================

  const validUrlJobs =
    allJobs.filter(
      (job) =>
        isValidHttpUrl(
          job.applyUrl,
        ),
    )


  console.log(
    `🔗 VALID APPLY URL JOBS: ${validUrlJobs.length}`,
  )


  // ==========================================================
  // DEDUPE APPLY URL
  // ==========================================================

  const urlMap =
    new Map<string, RawJob>()

  for (const job of validUrlJobs) {
    const url =
      normalizeUrl(
        job.applyUrl,
      )

    if (!url) {
      continue
    }

    if (!urlMap.has(url)) {
      urlMap.set(
        url,
        job,
      )
    }
  }


  const uniqueUrlJobs =
    Array.from(
      urlMap.values(),
    )


  console.log(
    `♻️ UNIQUE APPLY URLs: ${uniqueUrlJobs.length}`,
  )


  // ==========================================================
  // DEDUPE COMPANY + TITLE + LOCATION
  // ==========================================================

  const jobMap =
    new Map<string, RawJob>()

  for (const job of uniqueUrlJobs) {
    const company =
      normalizeText(
        job.company,
      )

    const title =
      normalizeText(
        job.title,
      )

    const location =
      normalizeText(
        job.location,
      )

    const key =
      `${company}::${title}::${location}`

    if (!jobMap.has(key)) {
      jobMap.set(
        key,
        job,
      )
    }
  }


  const uniqueJobs =
    Array.from(
      jobMap.values(),
    )


  console.log(
    `🧠 UNIQUE COMPANY + TITLE + LOCATION JOBS: ${uniqueJobs.length}`,
  )


  // ==========================================================
  // LOAD EXISTING SUPABASE JOBS
  // ==========================================================

  console.log(
    '🔎 Checking existing Supabase jobs...',
  )


  const {
    data: existingJobs,
    error: existingError,
  } =
    await supabaseAdmin
      .from('jobs')
      .select(
        'id,title,company,location,country,apply_url',
      )


  if (existingError) {
    throw new Error(
      `Failed to load existing jobs: ${existingError.message}`,
    )
  }


  // ==========================================================
  // EXISTING URL SET
  // ==========================================================

  const existingUrlSet =
    new Set(
      (existingJobs || [])
        .map(
          (job) =>
            normalizeUrl(
              job.apply_url ||
                '',
            ),
        )
        .filter(Boolean),
    )


  // ==========================================================
  // EXISTING JOB IDENTITY SET
  // ==========================================================

  const existingIdentitySet =
    new Set(
      (existingJobs || [])
        .map(
          (job) => {
            const url =
              normalizeUrl(
                job.apply_url ||
                  '',
              )

            const company =
              normalizeText(
                job.company ||
                  '',
              )

            const title =
              normalizeText(
                job.title ||
                  '',
              )

            const location =
              normalizeText(
                job.location ||
                  '',
              )

            return [
              url,
              company,
              title,
              location,
            ].join('::')
          },
        ),
    )


  // ==========================================================
  // REMOVE EXISTING
  // ==========================================================

  const freshJobs =
    uniqueJobs.filter(
      (job) => {
        const url =
          normalizeUrl(
            job.applyUrl,
          )

        const identity =
          createJobIdentity(
            job,
          )

        return (
          !existingUrlSet.has(
            url,
          ) &&
          !existingIdentitySet.has(
            identity,
          )
        )
      },
    )


  console.log(
    `   💾 EXISTING JOBS: ${existingJobs?.length || 0}`,
  )

  console.log(
    `   🆕 FRESH JOBS: ${freshJobs.length}`,
  )


  // ==========================================================
  // STRICT ROLE FILTER
  // ==========================================================

  const roleCandidates =
    freshJobs.filter(
      (job) =>
        isTargetRole(job),
    )


  console.log(
    `🎯 TARGET ROLE JOBS: ${roleCandidates.length}`,
  )


  // ==========================================================
  // SPLIT MUMBAI / USA
  // ==========================================================

  const mumbaiCandidates =
    roleCandidates
      .filter(
        isMumbaiCandidate,
      )
      .map(
        (job) => ({
          job,
          priority:
            getPriorityScore(
              job,
            ),
        }),
      )
      .sort(
        (a, b) =>
          b.priority -
          a.priority,
      )


  const usaCandidates =
    roleCandidates
      .filter(
        isUSACandidate,
      )
      .map(
        (job) => ({
          job,
          priority:
            getPriorityScore(
              job,
            ),
        }),
      )
      .sort(
        (a, b) =>
          b.priority -
          a.priority,
      )


  console.log(
    `🇮🇳 MUMBAI CANDIDATES: ${mumbaiCandidates.length}`,
  )

  console.log(
    `🇺🇸 USA CANDIDATES: ${usaCandidates.length}`,
  )


  // ==========================================================
  // SHOW CANDIDATES
  // ==========================================================

  console.log(
    '\n🔥 TOP MUMBAI CANDIDATES:',
  )

  mumbaiCandidates
    .slice(
      0,
      10,
    )
    .forEach(
      ({
        job,
        priority,
      }) => {
        console.log(
          `   ${priority} | ${job.title} | ${job.company} | ${job.location || 'Unknown'}`,
        )
      },
    )


  console.log(
    '\n🔥 TOP USA CANDIDATES:',
  )

  usaCandidates
    .slice(
      0,
      10,
    )
    .forEach(
      ({
        job,
        priority,
      }) => {
        console.log(
          `   ${priority} | ${job.title} | ${job.company} | ${job.location || 'Unknown'}`,
        )
      },
    )


  // ==========================================================
  // CANDIDATE LIMIT
  // ==========================================================

  const mumbaiForAI =
    mumbaiCandidates.slice(
      0,
      MAX_MUMBAI_AI_CANDIDATES,
    )

  const usaForAI =
    usaCandidates.slice(
      0,
      MAX_USA_AI_CANDIDATES,
    )


  // ==========================================================
  // PROCESSING STATE
  // ==========================================================

  let analyzed = 0
  let saved = 0
  let rejected = 0
  let duplicates = 0
  let failed = 0

  let mumbaiSaved = 0
  let usaSaved = 0


  // Prevent same job from being saved twice
  // even if source data behaves unexpectedly.
  const runIdentitySet =
    new Set<string>()


  // Existing jobs are already protected.
  for (
    const identity
    of existingIdentitySet
  ) {
    runIdentitySet.add(
      identity,
    )
  }


  // ==========================================================
  // HUMAN-LIKE GEMINI PROCESSOR
  // ==========================================================

  async function processCandidate(
    job: RawJob,
    bucket: 'mumbai' | 'usa',
  ) {
    // Quota already full.
    if (
      bucket === 'mumbai' &&
      mumbaiSaved >=
        MUMBAI_TARGET
    ) {
      return
    }

    if (
      bucket === 'usa' &&
      usaSaved >= USA_TARGET
    ) {
      return
    }


    const identity =
      createJobIdentity(
        job,
      )


    // --------------------------------------------------------
    // DUPLICATE CHECK BEFORE AI
    // --------------------------------------------------------

    if (
      runIdentitySet.has(
        identity,
      )
    ) {
      duplicates++

      console.log(
        '♻️ Duplicate skipped before AI',
      )

      return
    }


    const locationBucket =
      getLocationBucket(
        job,
      )

    if (
      locationBucket !==
      bucket
    ) {
      return
    }


    // --------------------------------------------------------
    // LOG
    // --------------------------------------------------------

    const currentNumber =
      analyzed + 1

    console.log(
      `\n[${currentNumber}] ${job.title}`,
    )

    console.log(
      `🏢 ${job.company}`,
    )

    console.log(
      `📍 ${job.location || 'Unknown'}`,
    )

    console.log(
      `🌍 ${bucket.toUpperCase()}`,
    )

    console.log(
      `💼 ${getWorkplaceType(job)}`,
    )

    console.log(
      `⭐ Priority: ${getPriorityScore(job)}`,
    )


    // --------------------------------------------------------
    // GEMINI RATE LIMIT
    // --------------------------------------------------------

    if (
      analyzed > 0
    ) {
      await sleep(
        GEMINI_DELAY_MS,
      )
    }


    try {
      // ------------------------------------------------------
      // AI ANALYSIS
      // ------------------------------------------------------

      const analysis =
        await analyzeJob(
          job,
        )

      analyzed++


      // ------------------------------------------------------
      // DECISION
      // ------------------------------------------------------

      if (
        analysis.decision !==
        'keep'
      ) {
        rejected++

        console.log(
          `❌ Rejected: ${analysis.reason}`,
        )

        return
      }


      // ------------------------------------------------------
      // FINAL LOCATION SAFETY
      // ------------------------------------------------------

      if (
        bucket ===
          'mumbai' &&
        !isMumbaiJob(job)
      ) {
        rejected++

        console.log(
          '❌ Rejected: AI accepted it but location is not Mumbai/MMR.',
        )

        return
      }


      if (
        bucket ===
          'usa' &&
        !isUSAJob(job)
      ) {
        rejected++

        console.log(
          '❌ Rejected: AI accepted it but location is not USA.',
        )

        return
      }


      // ------------------------------------------------------
      // FINAL ROLE SAFETY
      // ------------------------------------------------------

      if (
        !isTargetRole(job)
      ) {
        rejected++

        console.log(
          '❌ Rejected: role is outside Ahmed target roles.',
        )

        return
      }


      // ------------------------------------------------------
      // FINAL DUPLICATE CHECK
      // ------------------------------------------------------

      if (
        runIdentitySet.has(
          identity,
        )
      ) {
        duplicates++

        console.log(
          '♻️ Duplicate detected before save.',
        )

        return
      }


      // ------------------------------------------------------
      // SAVE
      // ------------------------------------------------------

      const result =
        await saveAnalyzedJob(
          analysis,
        )


      if (
        result.saved
      ) {
        // ----------------------------------------------------
        // FINAL QUOTA SAFETY
        // ----------------------------------------------------

        if (
          bucket ===
            'mumbai' &&
          mumbaiSaved >=
            MUMBAI_TARGET
        ) {
          console.log(
            '⚠️ Mumbai quota already full. Save result ignored.',
          )

          return
        }


        if (
          bucket ===
            'usa' &&
          usaSaved >=
            USA_TARGET
        ) {
          console.log(
            '⚠️ USA quota already full. Save result ignored.',
          )

          return
        }


        runIdentitySet.add(
          identity,
        )


        saved++


        if (
          bucket ===
          'mumbai'
        ) {
          mumbaiSaved++
        }


        if (
          bucket ===
          'usa'
        ) {
          usaSaved++
        }


        console.log(
          `✅ SAVED TO SUPABASE | ${bucket.toUpperCase()} ${bucket === 'mumbai' ? mumbaiSaved : usaSaved}`,
        )
      } else if (
        result.reason ===
        'Duplicate'
      ) {
        duplicates++

        console.log(
          '♻️ Duplicate',
        )
      } else {
        rejected++

        console.log(
          `❌ Not saved: ${result.reason}`,
        )
      }
    } catch (error) {
      failed++

      console.error(
        '❌ Job processing failed:',
        error instanceof Error
          ? error.message
          : String(error),
      )
    }
  }


  // ==========================================================
  // MUMBAI FIRST
  // ==========================================================
  //
  // We intentionally fill Mumbai first.
  //
  // This guarantees that USA jobs cannot accidentally consume
  // Mumbai's quota.
  //
  // ==========================================================

  console.log(
    '\n🇮🇳 STARTING MUMBAI SCREENING',
  )

  for (
    const item of mumbaiForAI
  ) {
    if (
      mumbaiSaved >=
      MUMBAI_TARGET
    ) {
      break
    }

    await processCandidate(
      item.job,
      'mumbai',
    )
  }


  // ==========================================================
  // USA SECOND
  // ==========================================================

  console.log(
    '\n🇺🇸 STARTING USA SCREENING',
  )

  for (
    const item of usaForAI
  ) {
    if (
      usaSaved >=
      USA_TARGET
    ) {
      break
    }

    await processCandidate(
      item.job,
      'usa',
    )
  }


  // ==========================================================
  // FINAL RESULT
  // ==========================================================

  console.log(
    '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    '📊 RUN SUMMARY',
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    `Collected:              ${allJobs.length}`,
  )

  console.log(
    `Valid URLs:             ${validUrlJobs.length}`,
  )

  console.log(
    `Unique URLs:            ${uniqueUrlJobs.length}`,
  )

  console.log(
    `Unique Jobs:            ${uniqueJobs.length}`,
  )

  console.log(
    `Already Saved:          ${
      uniqueJobs.length -
      freshJobs.length
    }`,
  )

  console.log(
    `Fresh Jobs:             ${freshJobs.length}`,
  )

  console.log(
    `Target Role Jobs:       ${roleCandidates.length}`,
  )

  console.log(
    `Mumbai Candidates:      ${mumbaiCandidates.length}`,
  )

  console.log(
    `USA Candidates:         ${usaCandidates.length}`,
  )

  console.log(
    `Analyzed:               ${analyzed}`,
  )

  console.log(
    `🇮🇳 Mumbai Saved:        ${mumbaiSaved}/${MUMBAI_TARGET}`,
  )

  console.log(
    `🇺🇸 USA Saved:           ${usaSaved}/${USA_TARGET}`,
  )

  console.log(
    `Total Saved:            ${saved}/${TOTAL_TARGET}`,
  )

  console.log(
    `Rejected:               ${rejected}`,
  )

  console.log(
    `Duplicates:             ${duplicates}`,
  )

  console.log(
    `Failed:                 ${failed}`,
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )


  // ==========================================================
  // FINAL JSON
  // ==========================================================

  return {
    collected:
      allJobs.length,

    validApplyUrls:
      validUrlJobs.length,

    uniqueApplyUrls:
      uniqueUrlJobs.length,

    unique:
      uniqueJobs.length,

    alreadySaved:
      uniqueJobs.length -
      freshJobs.length,

    fresh:
      freshJobs.length,

    targetRoleJobs:
      roleCandidates.length,

    mumbaiCandidates:
      mumbaiCandidates.length,

    usaCandidates:
      usaCandidates.length,

    analyzed,

    saved,

    mumbaiSaved,

    usaSaved,

    targetMumbai:
      MUMBAI_TARGET,

    targetUSA:
      USA_TARGET,

    targetTotal:
      TOTAL_TARGET,

    rejected,

    duplicates,

    failed,
  }
}