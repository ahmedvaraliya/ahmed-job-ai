import { analyzeJob } from '../ai/analyzeJob'
import { saveAnalyzedJob } from './saveJob'
import { supabaseAdmin } from '../config/supabase'

import {
  fetchArbeitnowJobs,
  fetchArbeitnowUKJobs,
} from '../sources/arbeitnow'

import type { RawJob } from '../sources/lever'

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value)

    url.hash = ''

    if (url.pathname.endsWith('/')) {
      url.pathname = url.pathname.slice(0, -1)
    }

    return url.toString().toLowerCase()
  } catch {
    return value.trim().toLowerCase()
  }
}

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

function sleep(ms: number) {
  return new Promise((resolve) =>
    setTimeout(resolve, ms),
  )
}

// ============================================================
// IT / TECH DETECTION
// ============================================================

const itRoleKeywords = [
  'software',
  'developer',
  'development',
  'frontend',
  'front-end',
  'backend',
  'back-end',
  'full stack',
  'full-stack',
  'web developer',
  'web development',

  'javascript',
  'typescript',
  'react',
  'next.js',
  'nextjs',
  'vue',
  'angular',
  'node',
  'node.js',
  'express',

  'java',
  'spring',
  'python',
  'django',
  'flask',
  'php',
  'laravel',
  'ruby',
  'rails',
  'c#',
  '.net',
  'dotnet',
  'golang',
  'go developer',
  'rust',
  'kotlin',
  'swift',

  'mobile developer',
  'android developer',
  'ios developer',
  'flutter',
  'react native',

  'qa',
  'quality assurance',
  'software tester',
  'test engineer',
  'automation tester',
  'sdet',

  'devops',
  'cloud',
  'aws',
  'azure',
  'gcp',
  'kubernetes',
  'docker',
  'terraform',
  'sre',
  'site reliability',
  'platform engineer',

  'cybersecurity',
  'cyber security',
  'security engineer',
  'information security',
  'penetration tester',
  'soc analyst',
  'security analyst',

  'data analyst',
  'data engineer',
  'data scientist',
  'machine learning',
  'ml engineer',
  'ai engineer',
  'artificial intelligence',
  'deep learning',
  'nlp',
  'computer vision',

  'database',
  'sql',
  'mysql',
  'postgresql',
  'mongodb',
  'oracle database',

  'network engineer',
  'network administrator',
  'networking',
  'system administrator',
  'systems administrator',
  'systems engineer',
  'it support',
  'technical support',
  'help desk',
  'service desk',

  'solution architect',
  'software architect',
  'cloud architect',
  'technical architect',

  'wordpress',
  'shopify',
  'webflow',
  'woocommerce',

  'blockchain',
  'web3',
  'smart contract',

  'game developer',
  'game development',
  'unity',
  'unreal engine',

  'technical writer',
  'developer relations',
  'developer advocate',

  'technical product',
  'technical project',
  'technical program',
  'software engineering manager',
  'engineering manager',

  'information technology',
  'information systems',
]

// ============================================================
// NON-IT BLOCK LIST
// ============================================================

const nonItKeywords = [
  'accountant',
  'accounting',
  'chartered accountant',
  'ca ',
  'finance',
  'financial analyst',
  'banking',
  'investment banker',

  'sales',
  'sales executive',
  'sales manager',
  'business development representative',
  'bdr',
  'sdr',

  'marketing',
  'digital marketing',
  'social media manager',
  'seo specialist',
  'content marketer',

  'human resources',
  'human resource',
  'hr manager',
  'recruiter',
  'recruitment',
  'talent acquisition',

  'lawyer',
  'legal',
  'attorney',

  'doctor',
  'medical',
  'nurse',
  'healthcare',

  'hotel',
  'hospitality',
  'chef',
  'restaurant',

  'retail',
  'store manager',

  'teacher',
  'teaching',
  'school teacher',

  'real estate',

  'civil engineer',
  'mechanical engineer',
  'electrical engineer',
  'chemical engineer',
  'structural engineer',

  'architectural designer',

  'driver',
  'delivery driver',
  'warehouse',
  'construction',
  'security guard',
]

// ============================================================
// LOCATION HELPERS
// ============================================================

const indiaKeywords = [
  'india',
  'indian',
  'mumbai',
  'bombay',
  'delhi',
  'new delhi',
  'ncr',
  'noida',
  'gurgaon',
  'gurugram',
  'bengaluru',
  'bangalore',
  'hyderabad',
  'pune',
  'chennai',
  'kolkata',
  'ahmedabad',
  'surat',
  'jaipur',
  'kochi',
  'coimbatore',
  'lucknow',
  'indore',
  'bhubaneswar',
  'chandigarh',
  'nagpur',
  'vadodara',
  'visakhapatnam',
  'thiruvananthapuram',
]

const mumbaiKeywords = [
  'mumbai',
  'bombay',
  'mumbai metropolitan',
  'mmr',
  'thane',
  'navi mumbai',
]

const preferredCountries = [
  'usa',
  'united states',
  'us',
  'u.s.',
  'america',

  'uk',
  'united kingdom',
  'england',

  'canada',

  'australia',

  'uae',
  'united arab emirates',
  'dubai',
  'abu dhabi',
]

const remoteKeywords = [
  'remote',
  'fully remote',
  'remote worldwide',
  'worldwide remote',
  'remote anywhere',
  'work from anywhere',
  'work anywhere',
  'anywhere in the world',
  'global remote',
  'distributed',
]

function containsAny(
  value: string,
  keywords: string[],
) {
  return keywords.some((keyword) =>
    value.includes(keyword),
  )
}

function getLocationText(job: RawJob) {
  return normalizeText(
    [
      job.location,
      job.country,
      job.workplace,
      job.description,
      job.title,
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function isIndiaJob(job: RawJob) {
  const text = getLocationText(job)

  return containsAny(text, indiaKeywords)
}

function isMumbaiJob(job: RawJob) {
  const text = normalizeText(
    [
      job.location,
      job.country,
      job.description,
    ]
      .filter(Boolean)
      .join(' '),
  )

  return containsAny(text, mumbaiKeywords)
}

function isRemoteJob(job: RawJob) {
  const text = getLocationText(job)

  return containsAny(text, remoteKeywords)
}

function isPreferredForeignJob(job: RawJob) {
  const text = getLocationText(job)

  return containsAny(text, preferredCountries)
}

function isLikelyITJob(job: RawJob) {
  const title = normalizeText(job.title)
  const category = normalizeText(job.category)
  const description = normalizeText(
    job.description,
  )

  const titleCategoryText =
    `${title} ${category}`

  const titleHasIT =
    containsAny(
      titleCategoryText,
      itRoleKeywords,
    )

  const descriptionHasIT =
    containsAny(
      description,
      itRoleKeywords,
    )

  const blocked =
    containsAny(
      titleCategoryText,
      nonItKeywords,
    )

  if (blocked && !titleHasIT) {
    return false
  }

  return (
    titleHasIT ||
    descriptionHasIT
  )
}

// ============================================================
// LOCATION ELIGIBILITY
// ============================================================

function isLocationEligible(job: RawJob) {
  const india = isIndiaJob(job)
  const mumbai = isMumbaiJob(job)
  const remote = isRemoteJob(job)
  const foreign = isPreferredForeignJob(job)

  // India is ALWAYS eligible.
  if (india) {
    return true
  }

  // Worldwide / genuine remote is eligible.
  if (remote) {
    return true
  }

  // Preferred foreign countries are eligible.
  if (foreign) {
    return true
  }

  // Unknown locations can still go through Gemini
  // if they look like legitimate IT jobs.
  const location = normalizeText(
    [
      job.location,
      job.country,
    ]
      .filter(Boolean)
      .join(' '),
  )

  if (!location) {
    return true
  }

  return false
}

// ============================================================
// PRIORITY SCORE
// ============================================================

function getPriorityScore(job: RawJob) {
  const text = getLocationText(job)

  let score = 0

  // ----------------------------------------------------------
  // INDIA
  // ----------------------------------------------------------

  if (isIndiaJob(job)) {
    score += 100
  }

  // ----------------------------------------------------------
  // MUMBAI
  // ----------------------------------------------------------

  if (isMumbaiJob(job)) {
    score += 100
  }

  // ----------------------------------------------------------
  // REMOTE
  // ----------------------------------------------------------

  if (isRemoteJob(job)) {
    score += 70
  }

  // ----------------------------------------------------------
  // WORLDWIDE
  // ----------------------------------------------------------

  if (
    text.includes('worldwide') ||
    text.includes('global') ||
    text.includes('anywhere')
  ) {
    score += 55
  }

  // ----------------------------------------------------------
  // OTHER INDIAN TECH HUBS
  // ----------------------------------------------------------

  const indianTechCities = [
    'bengaluru',
    'bangalore',
    'hyderabad',
    'pune',
    'delhi',
    'new delhi',
    'noida',
    'gurgaon',
    'gurugram',
    'chennai',
    'ahmedabad',
    'kolkata',
    'kochi',
    'jaipur',
  ]

  if (
    containsAny(
      text,
      indianTechCities,
    )
  ) {
    score += 50
  }

  // ----------------------------------------------------------
  // FOREIGN PRIORITY
  // ----------------------------------------------------------

  if (
    text.includes('united states') ||
    text.includes('usa') ||
    text.includes('u.s.')
  ) {
    score += 35
  }

  if (
    text.includes('united kingdom') ||
    text.includes('uk')
  ) {
    score += 32
  }

  if (text.includes('canada')) {
    score += 30
  }

  if (text.includes('australia')) {
    score += 28
  }

  if (
    text.includes('uae') ||
    text.includes('dubai') ||
    text.includes('abu dhabi')
  ) {
    score += 26
  }

  // ----------------------------------------------------------
  // CORE SOFTWARE
  // ----------------------------------------------------------

  const title = normalizeText(
    job.title,
  )

  if (
    containsAny(title, [
      'software engineer',
      'software developer',
      'frontend',
      'front-end',
      'backend',
      'back-end',
      'full stack',
      'full-stack',
      'web developer',
      'developer',
    ])
  ) {
    score += 30
  }

  // ----------------------------------------------------------
  // AI / DATA / SECURITY
  // ----------------------------------------------------------

  if (
    containsAny(title, [
      'ai',
      'machine learning',
      'data engineer',
      'data scientist',
      'cybersecurity',
      'security engineer',
    ])
  ) {
    score += 25
  }

  // ----------------------------------------------------------
  // DEVOPS / CLOUD
  // ----------------------------------------------------------

  if (
    containsAny(title, [
      'devops',
      'cloud',
      'sre',
      'platform',
      'site reliability',
    ])
  ) {
    score += 24
  }

  // ----------------------------------------------------------
  // QA
  // ----------------------------------------------------------

  if (
    containsAny(title, [
      'qa',
      'quality assurance',
      'test engineer',
      'sdet',
    ])
  ) {
    score += 18
  }

  // ----------------------------------------------------------
  // FRESHNESS
  // ----------------------------------------------------------

  if (job.postedAt) {
    const postedTime =
      new Date(
        job.postedAt,
      ).getTime()

    const hoursAgo =
      Math.max(
        0,
        Date.now() -
          postedTime,
      ) / 3600000

    if (hoursAgo <= 24) {
      score += 20
    } else if (hoursAgo <= 72) {
      score += 12
    } else if (hoursAgo <= 168) {
      score += 5
    }
  }

  return score
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

  // ==========================================================
  // FETCH SOURCES
  // ==========================================================

  const allJobs: RawJob[] = []

  console.log(
    '🔎 Fetching Arbeitnow...',
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
      error,
    )
  }

  console.log(
    '🔎 Fetching Arbeitnow UK...',
  )

  try {
    const jobs =
      await fetchArbeitnowUKJobs()

    console.log(
      `   📥 ${jobs.length} jobs`,
    )

    allJobs.push(...jobs)
  } catch (error) {
    console.error(
      '⚠️ Arbeitnow UK failed:',
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

    if (!urlMap.has(url)) {
      urlMap.set(url, job)
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
  // DEDUPE COMPANY + TITLE
  // ==========================================================

  const jobMap =
    new Map<string, RawJob>()

  for (const job of uniqueUrlJobs) {
    const key =
      `${normalizeText(job.company)}::${normalizeText(job.title)}`

    if (!jobMap.has(key)) {
      jobMap.set(key, job)
    }
  }

  const uniqueJobs =
    Array.from(
      jobMap.values(),
    )

  console.log(
    `🧠 UNIQUE COMPANY + TITLE JOBS: ${uniqueJobs.length}`,
  )

  // ==========================================================
  // LOAD EXISTING JOBS
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
        'id,title,company,apply_url',
      )

  if (existingError) {
    throw new Error(
      `Failed to load existing jobs: ${existingError.message}`,
    )
  }

  const existingUrlSet =
    new Set(
      (existingJobs || [])
        .map((job) =>
          normalizeUrl(
            job.apply_url || '',
          ),
        )
        .filter(Boolean),
    )

  const existingTitleSet =
    new Set(
      (existingJobs || [])
        .map(
          (job) =>
            `${normalizeText(job.company)}::${normalizeText(job.title)}`,
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

        const titleKey =
          `${normalizeText(job.company)}::${normalizeText(job.title)}`

        return (
          !existingUrlSet.has(
            url,
          ) &&
          !existingTitleSet.has(
            titleKey,
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
  // IT FILTER
  // ==========================================================

  const likelyRelevant =
    freshJobs.filter(
      (job) =>
        isLikelyITJob(job) &&
        isLocationEligible(job),
    )

  console.log(
    `💻 IT + LOCATION JOBS: ${likelyRelevant.length}`,
  )

  // ==========================================================
  // PRIORITIZE
  // ==========================================================

  const prioritized =
    likelyRelevant
      .map((job) => ({
        job,
        priority:
          getPriorityScore(
            job,
          ),
      }))
      .sort(
        (a, b) =>
          b.priority -
          a.priority,
      )

  console.log(
    '\n🔥 TOP PRIORITY JOBS:',
  )

  prioritized
    .slice(0, 10)
    .forEach(
      ({
        job,
        priority,
      }) => {
        console.log(
          `   ${priority} | ${job.title} | ${job.company} | ${job.location || 'Remote/Unknown'}`,
        )
      },
    )

  // ==========================================================
  // GEMINI LIMIT
  // ==========================================================

  const MAX_AI_JOBS_PER_RUN = 10

  const jobsForAI =
    prioritized
      .slice(
        0,
        MAX_AI_JOBS_PER_RUN,
      )
      .map(
        (item) => item.job,
      )

  console.log(
    `\n🧠 GEMINI ANALYSIS: ${jobsForAI.length} jobs`,
  )

  // ==========================================================
  // PROCESS
  // ==========================================================

  let analyzed = 0
  let saved = 0
  let rejected = 0
  let duplicates = 0
  let failed = 0

  for (
    let index = 0;
    index < jobsForAI.length;
    index++
  ) {
    const job =
      jobsForAI[index]

    try {
      console.log(
        `\n[${index + 1}/${jobsForAI.length}] ${job.title}`,
      )

      console.log(
        `🏢 ${job.company}`,
      )

      console.log(
        `📍 ${job.location || 'Remote / Worldwide'}`,
      )

      console.log(
        `⭐ Priority: ${getPriorityScore(job)}`,
      )

      // Rate-limit protection for Gemini free tier.
      if (index > 0) {
        await sleep(6000)
      }

      const analysis =
        await analyzeJob(
          job,
        )

      analyzed++

      if (
        analysis.decision !==
        'keep'
      ) {
        rejected++

        console.log(
          `❌ Rejected: ${analysis.reason}`,
        )

        continue
      }

      const result =
        await saveAnalyzedJob(
          analysis,
        )

      if (result.saved) {
        saved++

        console.log(
          '✅ SAVED TO SUPABASE',
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
  // SUMMARY
  // ==========================================================

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    '📊 RUN SUMMARY',
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    `Collected:        ${allJobs.length}`,
  )

  console.log(
    `Valid URLs:       ${validUrlJobs.length}`,
  )

  console.log(
    `Unique URLs:      ${uniqueUrlJobs.length}`,
  )

  console.log(
    `Unique Jobs:      ${uniqueJobs.length}`,
  )

  console.log(
    `Already Saved:    ${
      uniqueJobs.length -
      freshJobs.length
    }`,
  )

  console.log(
    `Fresh Jobs:       ${freshJobs.length}`,
  )

  console.log(
    `IT + Location:    ${likelyRelevant.length}`,
  )

  console.log(
    `Analyzed:         ${analyzed}`,
  )

  console.log(
    `Saved:            ${saved}`,
  )

  console.log(
    `Rejected:         ${rejected}`,
  )

  console.log(
    `Duplicates:       ${duplicates}`,
  )

  console.log(
    `Failed:           ${failed}`,
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  return {
    collected: allJobs.length,
    validApplyUrls:
      validUrlJobs.length,
    uniqueApplyUrls:
      uniqueUrlJobs.length,
    unique: uniqueJobs.length,
    alreadySaved:
      uniqueJobs.length -
      freshJobs.length,
    fresh:
      freshJobs.length,
    likelyRelevant:
      likelyRelevant.length,
    analyzed,
    saved,
    rejected,
    duplicates,
    failed,
  }
}