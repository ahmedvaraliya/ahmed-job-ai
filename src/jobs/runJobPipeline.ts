import { analyzeJob } from '../ai/analyzeJob'
import { saveAnalyzedJob } from './saveJob'
import { supabaseAdmin } from '../config/supabase'
import {
  fetchArbeitnowJobs,
  fetchArbeitnowUKJobs,
} from '../sources/arbeitnow'

const MAX_AI_JOBS_PER_RUN = 10
const AI_DELAY_MS = 6000

type CandidateJob = {
  externalId?: string
  title: string
  company: string
  location?: string
  workplace?: string
  country?: string
  experience?: string
  category?: string
  salary?: string
  description?: string
  sourceName: string
  sourceUrl: string
  applyUrl: string
  postedAt?: string
}

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrl(value = '') {
  try {
    const url = new URL(value.trim())

    url.hash = ''

    const removableParams = [
      'utm_source',
      'utm_medium',
      'utm_campaign',
      'utm_term',
      'utm_content',
      'ref',
    ]

    for (const param of removableParams) {
      url.searchParams.delete(param)
    }

    return url.toString().replace(/\/$/, '')
  } catch {
    return value.trim().toLowerCase().replace(/\/$/, '')
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

/*
|--------------------------------------------------------------------------
| BROAD IT / TECH KEYWORDS
|--------------------------------------------------------------------------
*/

const itKeywords = [
  // Software development
  'software developer',
  'software engineer',
  'application developer',
  'application engineer',
  'web developer',
  'web engineer',
  'frontend developer',
  'front-end developer',
  'frontend engineer',
  'front-end engineer',
  'backend developer',
  'back-end developer',
  'backend engineer',
  'back-end engineer',
  'full stack developer',
  'full-stack developer',
  'full stack engineer',
  'full-stack engineer',

  // Languages
  'javascript',
  'typescript',
  'python developer',
  'java developer',
  'c++ developer',
  'c# developer',
  '.net developer',
  'php developer',
  'ruby developer',
  'golang developer',
  'go developer',
  'rust developer',
  'kotlin developer',
  'swift developer',

  // Frameworks
  'react developer',
  'react engineer',
  'next.js',
  'nextjs',
  'angular developer',
  'vue developer',
  'node.js',
  'nodejs',
  'express.js',
  'nestjs',
  'django',
  'flask',
  'spring boot',
  'spring developer',
  'laravel',
  'symfony',

  // Mobile
  'android developer',
  'ios developer',
  'mobile developer',
  'mobile engineer',
  'flutter developer',
  'react native',
  'ios engineer',
  'android engineer',

  // QA / Testing
  'qa engineer',
  'qa developer',
  'qa analyst',
  'quality assurance engineer',
  'software tester',
  'software testing',
  'test engineer',
  'automation tester',
  'automation engineer',
  'sdet',
  'test automation',

  // DevOps / Cloud / Infrastructure
  'devops',
  'devops engineer',
  'cloud engineer',
  'cloud architect',
  'cloud developer',
  'platform engineer',
  'site reliability engineer',
  'sre',
  'infrastructure engineer',
  'systems engineer',
  'system administrator',
  'sysadmin',
  'kubernetes',
  'docker',
  'terraform',
  'aws',
  'azure',
  'google cloud',
  'gcp',

  // Cybersecurity
  'cybersecurity',
  'cyber security',
  'security engineer',
  'security analyst',
  'information security',
  'application security',
  'cloud security',
  'penetration tester',
  'penetration testing',
  'soc analyst',

  // Data / AI / ML
  'data engineer',
  'data analyst',
  'data scientist',
  'machine learning',
  'machine learning engineer',
  'ml engineer',
  'ai engineer',
  'artificial intelligence',
  'ai developer',
  'generative ai',
  'llm engineer',
  'nlp engineer',
  'computer vision',
  'deep learning',
  'analytics engineer',
  'business intelligence',
  'bi developer',

  // Database
  'database administrator',
  'database engineer',
  'database developer',
  'sql developer',
  'postgresql',
  'mysql',
  'mongodb',
  'oracle database',

  // Networking / IT
  'network engineer',
  'network administrator',
  'network security',
  'it engineer',
  'it support',
  'technical support',
  'help desk',
  'service desk',
  'desktop support',
  'systems administrator',
  'information technology',
  'it technician',

  // Architecture / leadership
  'software architect',
  'solution architect',
  'solutions architect',
  'technical architect',
  'enterprise architect',
  'engineering manager',
  'software engineering manager',
  'director of engineering',
  'vp engineering',
  'vp of engineering',

  // Product / technical management
  'technical product manager',
  'technical project manager',
  'technical program manager',
  'software product manager',
  'product manager software',
  'program manager technology',
  'project manager technology',

  // Technical writing / developer relations
  'technical writer',
  'developer advocate',
  'developer relations',
  'developer experience',
  'devrel',

  // Web platforms
  'wordpress developer',
  'wordpress engineer',
  'shopify developer',
  'shopify engineer',
  'webflow developer',
  'webflow designer',
  'woocommerce developer',

  // Blockchain / Game
  'blockchain developer',
  'blockchain engineer',
  'web3 developer',
  'smart contract developer',
  'solidity developer',
  'game developer',
  'game programmer',
  'unity developer',
  'unreal developer',

  // Generic but useful technical signals
  'software',
  'technology',
  'technical',
  'developer',
  'programmer',
  'coding',
  'programming',
  'engineering software',
]

/*
|--------------------------------------------------------------------------
| NON-IT BLOCK LIST
|--------------------------------------------------------------------------
*/

const nonItKeywords = [
  'accountant',
  'accounting',
  'chartered accountant',
  'ca ',
  'finance manager',
  'financial analyst',
  'investment banker',
  'banking officer',
  'sales',
  'sales representative',
  'sales manager',
  'business development representative',
  'marketing',
  'digital marketing',
  'seo specialist',
  'social media manager',
  'human resources',
  'hr manager',
  'recruiter',
  'recruitment',
  'legal',
  'lawyer',
  'attorney',
  'paralegal',
  'doctor',
  'physician',
  'nurse',
  'nursing',
  'medical',
  'pharmacy',
  'pharmacist',
  'dentist',
  'hospitality',
  'hotel manager',
  'restaurant manager',
  'chef',
  'waiter',
  'retail associate',
  'store manager',
  'cashier',
  'warehouse worker',
  'driver',
  'truck driver',
  'construction worker',
  'electrician',
  'plumber',
  'mechanic',
  'civil engineer',
  'mechanical engineer',
  'chemical engineer',
  'electrical engineer',
  'automotive engineer',
  'aerospace engineer',
  'helicopter engineer',
  'manufacturing engineer',
  'industrial engineer',
  'architectural engineer',
  'real estate',
  'insurance agent',
  'customer service representative',
  'administrative assistant',
  'receptionist',
]

/*
|--------------------------------------------------------------------------
| LOCATION
|--------------------------------------------------------------------------
*/

const preferredCountries = [
  'usa',
  'united states',
  'us',
  'uk',
  'united kingdom',
  'canada',
  'australia',
  'uae',
  'united arab emirates',
]

const remoteSignals = [
  'remote',
  'fully remote',
  'remote worldwide',
  'remote anywhere',
  'worldwide',
  'work from anywhere',
  'work anywhere',
  'distributed',
  'remote-first',
  'remote first',
]

const clearlyNonPreferredCountries = [
  'germany',
  'france',
  'switzerland',
  'spain',
  'italy',
  'netherlands',
  'belgium',
  'austria',
  'ireland',
  'poland',
  'portugal',
  'sweden',
  'norway',
  'denmark',
  'finland',
  'czech republic',
  'czechia',
  'romania',
  'hungary',
  'croatia',
  'greece',
  'japan',
  'china',
  'singapore',
  'india',
  'brazil',
  'mexico',
]

function containsAny(
  text: string,
  keywords: string[],
) {
  return keywords.some((keyword) =>
    text.includes(keyword),
  )
}

function looksLikeIT(job: CandidateJob) {
  const text = normalizeText(
    [
      job.title,
      job.category,
      job.description,
    ].join(' '),
  )

  const hasITKeyword = containsAny(
    text,
    itKeywords,
  )

  const hasStrongNonITKeyword = containsAny(
    text,
    nonItKeywords,
  )

  /*
   * If there is a clear IT signal, keep it.
   * Gemini will make the final decision.
   */
  if (hasITKeyword) {
    return true
  }

  /*
   * Generic "engineer" can be dangerous,
   * but technical context can still make it valid.
   */
  if (
    text.includes('engineer') &&
    (
      text.includes('software') ||
      text.includes('technology') ||
      text.includes('technical') ||
      text.includes('developer') ||
      text.includes('cloud') ||
      text.includes('data') ||
      text.includes('platform') ||
      text.includes('systems')
    )
  ) {
    return true
  }

  if (hasStrongNonITKeyword) {
    return false
  }

  return false
}

function looksLikePreferredLocation(
  job: CandidateJob,
) {
  const text = normalizeText(
    [
      job.location,
      job.country,
      job.workplace,
      job.description,
    ].join(' '),
  )

  const isRemote = containsAny(
    text,
    remoteSignals,
  )

  const isPreferredCountry =
    containsAny(
      text,
      preferredCountries,
    )

  const isClearlyNonPreferred =
    containsAny(
      text,
      clearlyNonPreferredCountries,
    )

  /*
   * Remote worldwide jobs are useful even when
   * the physical company location is elsewhere.
   */
  if (isRemote) {
    return true
  }

  if (isPreferredCountry) {
    return true
  }

  if (isClearlyNonPreferred) {
    return false
  }

  /*
   * Unknown location:
   * let Gemini decide instead of throwing it away.
   */
  return true
}

function calculatePriority(
  job: CandidateJob,
) {
  const text = normalizeText(
    [
      job.title,
      job.category,
      job.description,
      job.location,
      job.country,
    ].join(' '),
  )

  let score = 0

  if (
    containsAny(text, remoteSignals)
  ) {
    score += 40
  }

  if (
    text.includes('remote worldwide') ||
    text.includes('worldwide') ||
    text.includes('work from anywhere')
  ) {
    score += 20
  }

  if (
    containsAny(text, [
      'usa',
      'united states',
      'us',
    ])
  ) {
    score += 30
  }

  if (
    containsAny(text, [
      'uk',
      'united kingdom',
    ])
  ) {
    score += 28
  }

  if (text.includes('canada')) {
    score += 26
  }

  if (text.includes('australia')) {
    score += 24
  }

  if (
    containsAny(text, [
      'uae',
      'united arab emirates',
    ])
  ) {
    score += 22
  }

  if (
    containsAny(text, [
      'software developer',
      'software engineer',
      'frontend',
      'backend',
      'full stack',
      'full-stack',
      'web developer',
      'mobile developer',
    ])
  ) {
    score += 20
  }

  if (
    containsAny(text, [
      'ai',
      'machine learning',
      'data engineer',
      'data scientist',
      'cybersecurity',
      'security engineer',
    ])
  ) {
    score += 18
  }

  if (
    containsAny(text, [
      'devops',
      'cloud',
      'platform engineer',
      'site reliability',
      'sre',
    ])
  ) {
    score += 18
  }

  if (
    containsAny(text, [
      'qa',
      'quality assurance',
      'test engineer',
      'sdet',
      'automation testing',
    ])
  ) {
    score += 15
  }

  return score
}

export async function runJobPipeline() {
  console.log(
    '🤖 AHMED JOB HUNTER',
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  /*
  |--------------------------------------------------------------------------
  | FETCH
  |--------------------------------------------------------------------------
  */

  console.log(
    '🔎 Fetching Arbeitnow...',
  )

  const mainJobs =
    await fetchArbeitnowJobs()

  console.log(
    `   📥 ${mainJobs.length} jobs`,
  )

  let ukJobs: CandidateJob[] = []

  try {
    console.log(
      '🔎 Fetching Arbeitnow UK...',
    )

    ukJobs =
      await fetchArbeitnowUKJobs()

    console.log(
      `   📥 ${ukJobs.length} UK jobs`,
    )
  } catch (error) {
    console.warn(
      `⚠️ Arbeitnow UK failed: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    )
  }

  const collectedJobs =
    [
      ...mainJobs,
      ...ukJobs,
    ] as CandidateJob[]

  console.log(
    `📦 TOTAL COLLECTED: ${collectedJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | VALID URL FILTER
  |--------------------------------------------------------------------------
  */

  const validUrlJobs =
    collectedJobs.filter(
      (job) =>
        isValidHttpUrl(job.applyUrl) &&
        !normalizeUrl(job.applyUrl).includes(
          'example.com',
        ),
    )

  console.log(
    `🔗 VALID APPLY URL JOBS: ${validUrlJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | APPLY URL DEDUPE
  |--------------------------------------------------------------------------
  */

  const seenApplyUrls =
    new Set<string>()

  const uniqueApplyJobs =
    validUrlJobs.filter((job) => {
      const normalized =
        normalizeUrl(job.applyUrl)

      if (seenApplyUrls.has(normalized)) {
        return false
      }

      seenApplyUrls.add(normalized)

      return true
    })

  console.log(
    `♻️ UNIQUE APPLY URLs: ${uniqueApplyJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | COMPANY + TITLE DEDUPE
  |--------------------------------------------------------------------------
  */

  const seenCompanyTitles =
    new Set<string>()

  const uniqueJobs =
    uniqueApplyJobs.filter((job) => {
      const key =
        `${normalizeText(job.company)}|${normalizeText(job.title)}`

      if (seenCompanyTitles.has(key)) {
        return false
      }

      seenCompanyTitles.add(key)

      return true
    })

  console.log(
    `🧠 UNIQUE COMPANY + TITLE JOBS: ${uniqueJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | EXISTING DATABASE JOBS
  |--------------------------------------------------------------------------
  */

  console.log(
    '🔎 Checking existing Supabase jobs...',
  )

  const { data: existingJobs, error } =
    await supabaseAdmin
      .from('jobs')
      .select(
        'apply_url, company, title',
      )

  if (error) {
    throw new Error(
      `Failed to load existing jobs: ${error.message}`,
    )
  }

  const existingUrls =
    new Set(
      (existingJobs || [])
        .filter((job) => job.apply_url)
        .map((job) =>
          normalizeUrl(
            job.apply_url,
          ),
        ),
    )

  const existingCompanyTitles =
    new Set(
      (existingJobs || []).map(
        (job) =>
          `${normalizeText(job.company)}|${normalizeText(job.title)}`,
      ),
    )

  const freshJobs =
    uniqueJobs.filter((job) => {
      const url =
        normalizeUrl(job.applyUrl)

      const companyTitle =
        `${normalizeText(job.company)}|${normalizeText(job.title)}`

      return (
        !existingUrls.has(url) &&
        !existingCompanyTitles.has(
          companyTitle,
        )
      )
    })

  const alreadySaved =
    uniqueJobs.length -
    freshJobs.length

  console.log(
    `♻️ ALREADY IN SUPABASE: ${alreadySaved}`,
  )

  console.log(
    `🆕 FRESH JOBS NOT IN DATABASE: ${freshJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | SMART IT FILTER
  |--------------------------------------------------------------------------
  */

  const relevantJobs =
    freshJobs
      .filter(looksLikeIT)
      .filter(looksLikePreferredLocation)
      .sort(
        (a, b) =>
          calculatePriority(b) -
          calculatePriority(a),
      )

  console.log(
    `🎯 FRESH IT/TECH JOBS AFTER SMART FILTER: ${relevantJobs.length}`,
  )

  /*
  |--------------------------------------------------------------------------
  | GEMINI LIMIT
  |--------------------------------------------------------------------------
  */

  const jobsForAI =
    relevantJobs.slice(
      0,
      MAX_AI_JOBS_PER_RUN,
    )

  console.log(
    `🧠 GEMINI LIMIT: ${MAX_AI_JOBS_PER_RUN}`,
  )

  console.log(
    `🧠 SENT TO GEMINI: ${jobsForAI.length}`,
  )

  let analyzed = 0
  let saved = 0
  let rejected = 0
  let duplicates = 0
  let failed = 0

  /*
  |--------------------------------------------------------------------------
  | GEMINI ANALYSIS
  |--------------------------------------------------------------------------
  */

  for (
    let index = 0;
    index < jobsForAI.length;
    index++
  ) {
    const job =
      jobsForAI[index]

    try {
      if (index > 0) {
        console.log(
          `⏳ Waiting ${AI_DELAY_MS / 1000}s before next Gemini request...`,
        )

        await sleep(AI_DELAY_MS)
      }

      console.log(
        `\n🧠 AI ${index + 1}/${jobsForAI.length}`,
      )

      console.log(
        `   ${job.title} — ${job.company}`,
      )

      const analysis =
        await analyzeJob({
          title: job.title,
          company: job.company,
          location:
            job.location || '',
          workplace:
            job.workplace || '',
          country:
            job.country || '',
          experience:
            job.experience || '',
          category:
            job.category || '',
          salary:
            job.salary || '',
          description:
            job.description || '',
          sourceName:
            job.sourceName,
          sourceUrl:
            job.sourceUrl,
          applyUrl:
            job.applyUrl,
          postedAt:
            job.postedAt || '',
        })

      analyzed++

      if (
        analysis.decision !== 'keep'
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
          '💾 SAVED TO SUPABASE',
        )
      } else if (
        result.reason === 'Duplicate'
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
        '❌ Job analysis failed:',
        error instanceof Error
          ? error.message
          : String(error),
      )
    }
  }

  /*
  |--------------------------------------------------------------------------
  | SUMMARY
  |--------------------------------------------------------------------------
  */

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
    `Collected:        ${collectedJobs.length}`,
  )

  console.log(
    `Valid URLs:       ${validUrlJobs.length}`,
  )

  console.log(
    `Unique URLs:      ${uniqueApplyJobs.length}`,
  )

  console.log(
    `Unique Jobs:      ${uniqueJobs.length}`,
  )

  console.log(
    `Already Saved:    ${alreadySaved}`,
  )

  console.log(
    `Fresh Jobs:       ${freshJobs.length}`,
  )

  console.log(
    `IT Jobs Found:    ${relevantJobs.length}`,
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
    collected: collectedJobs.length,
    validApplyUrls: validUrlJobs.length,
    uniqueApplyUrls:
      uniqueApplyJobs.length,
    unique: uniqueJobs.length,
    alreadySaved,
    fresh: freshJobs.length,
    likelyRelevant:
      relevantJobs.length,
    analyzed,
    saved,
    rejected,
    duplicates,
    failed,
  }
}