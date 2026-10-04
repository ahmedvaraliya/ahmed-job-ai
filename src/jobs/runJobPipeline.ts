import { analyzeJob } from '../ai/analyzeJob'
import { saveAnalyzedJob } from './saveJob'
import { supabaseAdmin } from '../config/supabase'

import {
  fetchArbeitnowJobs,
  fetchArbeitnowUKJobs,
} from '../sources/arbeitnow'

function normalizeText(value = '') {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeUrl(value = '') {
  return value
    .trim()
    .replace(/\/+$/, '')
    .toLowerCase()
}

function isValidHttpUrl(value = '') {
  const url = value.trim().toLowerCase()

  if (!url) {
    return false
  }

  if (url.includes('example.com')) {
    return false
  }

  return (
    url.startsWith('http://') ||
    url.startsWith('https://')
  )
}

export async function runJobPipeline() {
  console.log('\n🤖 AHMED JOB HUNTER')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  // =========================================================
  // 1. FETCH JOBS
  // =========================================================

  const rawJobs: Awaited<
    ReturnType<typeof fetchArbeitnowJobs>
  > = []

  try {
    console.log('🔎 Fetching Arbeitnow...')

    const jobs = await fetchArbeitnowJobs()

    console.log(`   📥 ${jobs.length} jobs`)

    rawJobs.push(...jobs)
  } catch (error) {
    console.error(
      '⚠️ Arbeitnow failed:',
      error instanceof Error
        ? error.message
        : String(error),
    )
  }

  try {
    console.log('🔎 Fetching Arbeitnow UK...')

    const jobs = await fetchArbeitnowUKJobs()

    console.log(`   📥 ${jobs.length} jobs`)

    rawJobs.push(...jobs)
  } catch (error) {
    console.error(
      '⚠️ Arbeitnow UK failed:',
      error instanceof Error
        ? error.message
        : String(error),
    )
  }

  console.log(
    `\n📦 TOTAL COLLECTED: ${rawJobs.length}`,
  )

  // =========================================================
  // 2. VALID APPLY URL
  // =========================================================

  const jobsWithApplyUrl = rawJobs.filter(
    (job) =>
      isValidHttpUrl(
        job.applyUrl || '',
      ),
  )

  console.log(
    `🔗 VALID APPLY URL JOBS: ${jobsWithApplyUrl.length}`,
  )

  // =========================================================
  // 3. URL DEDUPLICATION
  // =========================================================

  const urlMap = new Map<
    string,
    (typeof jobsWithApplyUrl)[number]
  >()

  for (const job of jobsWithApplyUrl) {
    const key = normalizeUrl(
      job.applyUrl || '',
    )

    if (!key) {
      continue
    }

    if (!urlMap.has(key)) {
      urlMap.set(key, job)
    }
  }

  const urlUniqueJobs = Array.from(
    urlMap.values(),
  )

  console.log(
    `♻️ UNIQUE APPLY URLs: ${urlUniqueJobs.length}`,
  )

  // =========================================================
  // 4. COMPANY + TITLE DEDUPLICATION
  // =========================================================

  const identityMap = new Map<
    string,
    (typeof urlUniqueJobs)[number]
  >()

  for (const job of urlUniqueJobs) {
    const company = normalizeText(
      job.company || '',
    )

    const title = normalizeText(
      job.title || '',
    )

    if (!title) {
      continue
    }

    const identity =
      `${company}::${title}`

    if (!identityMap.has(identity)) {
      identityMap.set(identity, job)
    }
  }

  const uniqueJobs = Array.from(
    identityMap.values(),
  )

  console.log(
    `🧠 UNIQUE COMPANY + TITLE JOBS: ${uniqueJobs.length}`,
  )

  // =========================================================
  // 5. REMOVE JOBS ALREADY IN SUPABASE
  //
  // IMPORTANT:
  // This happens BEFORE Gemini.
  //
  // So previously saved jobs DO NOT consume
  // Gemini requests.
  // =========================================================

  console.log(
    '\n🔍 Checking existing Supabase jobs...',
  )

  const existingApplyUrls =
    new Set<string>()

  const existingCompanyTitles =
    new Set<string>()

  const {
    data: existingJobs,
    error: existingError,
  } = await supabaseAdmin
    .from('jobs')
    .select(
      'company, title, apply_url',
    )

  if (existingError) {
    throw new Error(
      `Failed to load existing jobs: ${existingError.message}`,
    )
  }

  for (const existing of
    existingJobs || []) {
    const applyUrl =
      normalizeUrl(
        existing.apply_url || '',
      )

    if (applyUrl) {
      existingApplyUrls.add(
        applyUrl,
      )
    }

    const company =
      normalizeText(
        existing.company || '',
      )

    const title =
      normalizeText(
        existing.title || '',
      )

    if (company || title) {
      existingCompanyTitles.add(
        `${company}::${title}`,
      )
    }
  }

  const freshJobs = uniqueJobs.filter(
    (job) => {
      const applyUrl =
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

      const identity =
        `${company}::${title}`

      // Same apply URL already exists
      if (
        applyUrl &&
        existingApplyUrls.has(
          applyUrl,
        )
      ) {
        return false
      }

      // Same company + title already exists
      if (
        existingCompanyTitles.has(
          identity,
        )
      ) {
        return false
      }

      return true
    },
  )

  const alreadySaved =
    uniqueJobs.length -
    freshJobs.length

  console.log(
    `♻️ ALREADY IN SUPABASE: ${alreadySaved}`,
  )

  console.log(
    `🆕 FRESH JOBS NOT IN DATABASE: ${freshJobs.length}`,
  )

  // =========================================================
  // 6. IT / TECH ROLE KEYWORDS
  // =========================================================

  const itRoleKeywords = [
    // Software
    'software engineer',
    'software developer',
    'software development',
    'application engineer',
    'application developer',
    'computer engineer',
    'computer scientist',
    'developer',
    'engineer',

    // Frontend / Web / UI / UX
    'frontend',
    'front-end',
    'front end',
    'frontend developer',
    'frontend engineer',
    'web developer',
    'web engineer',
    'web development',
    'ui developer',
    'ui engineer',
    'ui/ux',
    'ux designer',
    'ux engineer',
    'ui designer',
    'web designer',

    // Backend / API
    'backend',
    'back-end',
    'back end',
    'backend developer',
    'backend engineer',
    'api developer',
    'api engineer',

    // Full stack
    'full-stack',
    'full stack',
    'fullstack',

    // JavaScript ecosystem
    'javascript',
    'typescript',
    'react',
    'react.js',
    'reactjs',
    'angular',
    'vue',
    'vue.js',
    'node.js',
    'nodejs',
    'node',
    'next.js',
    'nextjs',

    // Programming languages
    'java developer',
    'java engineer',
    'python developer',
    'python engineer',
    'c++ developer',
    'c++ engineer',
    'c# developer',
    '.net developer',
    '.net engineer',
    'php developer',
    'php engineer',
    'ruby developer',
    'ruby engineer',
    'go developer',
    'golang developer',
    'rust developer',
    'rust engineer',
    'kotlin developer',
    'swift developer',

    // Mobile
    'mobile developer',
    'mobile engineer',
    'android developer',
    'android engineer',
    'ios developer',
    'ios engineer',
    'flutter developer',
    'flutter engineer',
    'react native developer',
    'react native engineer',

    // QA / Testing
    'qa engineer',
    'qa developer',
    'qa analyst',
    'quality assurance',
    'quality engineer',
    'test engineer',
    'software tester',
    'automation tester',
    'test automation',
    'sdet',

    // DevOps / Cloud / Infrastructure
    'devops',
    'devops engineer',
    'cloud engineer',
    'cloud developer',
    'cloud architect',
    'aws',
    'azure',
    'google cloud',
    'gcp',
    'site reliability engineer',
    'sre',
    'platform engineer',
    'infrastructure engineer',
    'release engineer',

    // Cybersecurity
    'cybersecurity',
    'cyber security',
    'security engineer',
    'security analyst',
    'information security',
    'application security',
    'cloud security',
    'security architect',
    'penetration tester',
    'penetration testing',
    'ethical hacker',
    'soc analyst',

    // Data
    'data engineer',
    'data analyst',
    'data scientist',
    'data science',
    'data developer',
    'database engineer',
    'database administrator',
    'database developer',
    'sql developer',
    'bi developer',
    'business intelligence',
    'analytics engineer',

    // AI / ML
    'ai engineer',
    'ai developer',
    'artificial intelligence',
    'machine learning',
    'machine learning engineer',
    'ml engineer',
    'ml developer',
    'deep learning',
    'nlp engineer',
    'computer vision',
    'generative ai',
    'genai',

    // IT / Support / Networking
    'it engineer',
    'it specialist',
    'it administrator',
    'it support',
    'it technician',
    'technical support',
    'technical support engineer',
    'systems administrator',
    'system administrator',
    'network engineer',
    'network administrator',
    'network security',
    'infrastructure',
    'desktop support',
    'help desk',
    'helpdesk',

    // Architecture
    'software architect',
    'solutions architect',
    'solution architect',
    'technical architect',
    'system architect',
    'cloud architect',
    'enterprise architect',

    // CMS / Ecommerce
    'wordpress',
    'wordpress developer',
    'shopify developer',
    'shopify',
    'webflow developer',
    'webflow',
    'woocommerce',
    'cms developer',
    'ecommerce developer',

    // Blockchain / Web3
    'blockchain developer',
    'blockchain engineer',
    'web3 developer',
    'web3 engineer',
    'smart contract developer',
    'solidity developer',

    // Game development
    'game developer',
    'game engineer',
    'unity developer',
    'unreal developer',

    // Technical product / business
    'technical product manager',
    'technical program manager',
    'technical project manager',
    'business analyst',
    'technical business analyst',
    'systems analyst',
    'product analyst',

    // Management
    'engineering manager',
    'software engineering manager',
    'it manager',
    'technology manager',
    'technical manager',

    // Technical consulting / writing
    'technical consultant',
    'technology consultant',
    'it consultant',
    'solutions engineer',
    'developer advocate',
    'developer relations',
    'technical writer',
    'documentation engineer',
  ]

  // =========================================================
  // 7. NON-IT BLOCK LIST
  // =========================================================

  const blockedRoleKeywords = [
    // Finance / Accounting
    'accountant',
    'accounting',
    'chartered accountant',
    'bookkeeper',
    'bookkeeping',
    'finance manager',
    'financial analyst',
    'financial advisor',
    'financial controller',
    'investment banker',

    // Sales
    'sales representative',
    'sales executive',
    'sales manager',
    'sales director',
    'account executive',
    'account manager',
    'business development representative',
    'business development executive',

    // Marketing
    'marketing manager',
    'marketing specialist',
    'marketing executive',
    'digital marketing',
    'social media manager',
    'seo specialist',
    'seo manager',
    'content marketing',

    // HR
    'human resources',
    'hr manager',
    'hr specialist',
    'hr executive',
    'recruiter',
    'recruitment',
    'talent acquisition',

    // Legal
    'lawyer',
    'attorney',
    'legal counsel',
    'legal assistant',
    'paralegal',

    // Medical
    'doctor',
    'physician',
    'nurse',
    'nursing',
    'dentist',
    'pharmacist',
    'medical assistant',
    'healthcare assistant',

    // Education
    'teacher',
    'teaching',
    'professor',
    'lecturer',
    'school administrator',

    // Hospitality
    'hotel manager',
    'hotel receptionist',
    'restaurant manager',
    'chef',
    'cook',
    'waiter',
    'waitress',

    // Admin
    'administrative assistant',
    'administration assistant',
    'office administrator',
    'office manager',
    'receptionist',

    // Non-IT engineering
    'mechanical engineer',
    'mechanical engineering',
    'civil engineer',
    'civil engineering',
    'electrical engineer',
    'electrical engineering',
    'chemical engineer',
    'chemical engineering',
    'biomedical engineer',
    'biomedical engineering',
    'aerospace engineer',
    'aerospace engineering',
    'automotive engineer',
    'automotive engineering',

    // Physical / manual
    'construction worker',
    'warehouse worker',
    'warehouse associate',
    'truck driver',
    'delivery driver',
    'security guard',
    'maintenance technician',
    'maintenance engineer',

    // Retail
    'retail associate',
    'retail manager',
    'store manager',
    'cashier',

    // Generic customer service
    'customer service representative',
    'customer service agent',
    'customer care executive',
    'customer care representative',
  ]

  // =========================================================
  // 8. PREFERRED LOCATIONS
  // =========================================================

  const preferredLocations = [
    // USA
    'usa',
    'u.s.a',
    'u.s.',
    'united states',
    'united states of america',

    // UK
    'uk',
    'u.k.',
    'united kingdom',
    'england',
    'scotland',
    'wales',
    'northern ireland',

    // Canada
    'canada',

    // Australia
    'australia',

    // UAE
    'uae',
    'u.a.e',
    'dubai',
    'abu dhabi',
    'sharjah',

    // Remote
    'remote',
    'fully remote',
    'remote worldwide',
    'remote anywhere',
    'worldwide',
    'work from anywhere',
    'work anywhere',
    'anywhere',
  ]

  // =========================================================
  // 9. PRIORITY SCORE
  // =========================================================

  function getPriorityScore(
    job: (typeof freshJobs)[number],
  ) {
    const title =
      normalizeText(
        job.title || '',
      )

    const location =
      normalizeText(
        `${job.location || ''} ${
          job.workplace || ''
        } ${job.country || ''}`,
      )

    const description =
      normalizeText(
        job.description || '',
      )

    let score = 0

    // -------------------------------------------------------
    // Remote
    // -------------------------------------------------------

    if (
      location.includes('remote') ||
      description.includes('fully remote') ||
      description.includes('remote worldwide') ||
      description.includes('work from anywhere') ||
      description.includes('work anywhere')
    ) {
      score += 40
    }

    // -------------------------------------------------------
    // Worldwide
    // -------------------------------------------------------

    if (
      location.includes('worldwide') ||
      location.includes(
        'work from anywhere',
      ) ||
      location.includes(
        'work anywhere',
      ) ||
      location.includes('anywhere')
    ) {
      score += 35
    }

    // -------------------------------------------------------
    // Preferred countries
    // -------------------------------------------------------

    if (
      location.includes(
        'united states',
      ) ||
      location.includes('usa') ||
      location.includes('u.s.')
    ) {
      score += 30
    }

    if (
      location.includes(
        'united kingdom',
      ) ||
      location.includes('uk') ||
      location.includes('u.k.')
    ) {
      score += 28
    }

    if (
      location.includes('canada')
    ) {
      score += 26
    }

    if (
      location.includes('australia')
    ) {
      score += 24
    }

    if (
      location.includes('uae') ||
      location.includes('dubai') ||
      location.includes('abu dhabi')
    ) {
      score += 22
    }

    // -------------------------------------------------------
    // Core software roles
    // -------------------------------------------------------

    if (
      title.includes('software') ||
      title.includes('developer') ||
      title.includes('frontend') ||
      title.includes('backend') ||
      title.includes('full stack') ||
      title.includes('fullstack')
    ) {
      score += 20
    }

    // -------------------------------------------------------
    // AI / Data / Security
    // -------------------------------------------------------

    if (
      title.includes('ai ') ||
      title.startsWith('ai') ||
      title.includes(
        'machine learning',
      ) ||
      title.includes('data') ||
      title.includes('cyber') ||
      title.includes('security')
    ) {
      score += 18
    }

    // -------------------------------------------------------
    // DevOps / Cloud
    // -------------------------------------------------------

    if (
      title.includes('devops') ||
      title.includes('cloud') ||
      title.includes('platform') ||
      title.includes('sre')
    ) {
      score += 18
    }

    // -------------------------------------------------------
    // QA / Testing
    // -------------------------------------------------------

    if (
      title.includes('qa') ||
      title.includes('test') ||
      title.includes('automation')
    ) {
      score += 15
    }

    // -------------------------------------------------------
    // Remote description
    // -------------------------------------------------------

    if (
      description.includes('remote') ||
      description.includes(
        'work from home',
      )
    ) {
      score += 10
    }

    // -------------------------------------------------------
    // Freshness
    // -------------------------------------------------------

    if (job.postedAt) {
      const posted =
        new Date(job.postedAt)

      if (
        !Number.isNaN(
          posted.getTime(),
        )
      ) {
        const ageDays =
          (Date.now() -
            posted.getTime()) /
          (1000 * 60 * 60 * 24)

        if (ageDays <= 3) {
          score += 15
        } else if (ageDays <= 7) {
          score += 10
        } else if (ageDays <= 14) {
          score += 5
        }
      }
    }

    return score
  }

  // =========================================================
  // 10. SMART IT + LOCATION FILTER
  // =========================================================

  const candidates = freshJobs
    .filter((job) => {
      const title =
        job.title?.trim() || ''

      if (!title) {
        return false
      }

      const lowerTitle =
        title.toLowerCase()

      // -----------------------------------------------------
      // Reject known non-IT roles
      // -----------------------------------------------------

      const isBlocked =
        blockedRoleKeywords.some(
          (keyword) =>
            lowerTitle.includes(
              keyword,
            ),
        )

      if (isBlocked) {
        return false
      }

      // -----------------------------------------------------
      // Must look like IT / Technology
      // -----------------------------------------------------

      const hasITRole =
        itRoleKeywords.some(
          (keyword) =>
            lowerTitle.includes(
              keyword,
            ),
        )

      if (!hasITRole) {
        return false
      }

      // -----------------------------------------------------
      // Preferred location
      // -----------------------------------------------------

      const locationText = `
        ${job.location || ''}
        ${job.workplace || ''}
        ${job.country || ''}
        ${job.description || ''}
      `.toLowerCase()

      const hasPreferredLocation =
        preferredLocations.some(
          (location) =>
            locationText.includes(
              location,
            ),
        )

      if (!hasPreferredLocation) {
        return false
      }

      return true
    })
    .map((job) => ({
      job,
      priority:
        getPriorityScore(job),
    }))
    .sort(
      (a, b) =>
        b.priority - a.priority,
    )

  console.log(
    `🎯 FRESH IT JOBS AFTER SMART FILTER: ${candidates.length}`,
  )

  // =========================================================
  // 11. TOP PRIORITIES
  // =========================================================

  console.log(
    '\n🏆 TOP FRESH JOB PRIORITIES',
  )

  if (candidates.length === 0) {
    console.log(
      '   No new matching jobs found.',
    )
  } else {
    candidates
      .slice(0, 10)
      .forEach(
        ({ job, priority }, index) => {
          console.log(
            `   ${index + 1}. ${job.title} — ${job.company} [${priority}]`,
          )
        },
      )
  }

  // =========================================================
  // 12. GEMINI LIMIT
  //
  // Free tier currently being used.
  // Keep this at 15 per run.
  // =========================================================

  const MAX_AI_JOBS_PER_RUN = 15

  const batch = candidates
    .slice(
      0,
      MAX_AI_JOBS_PER_RUN,
    )
    .map(
      ({ job }) => job,
    )

  console.log(
    `\n🧠 SENT TO GEMINI: ${batch.length}`,
  )

  // =========================================================
  // 13. PROCESS WITH GEMINI
  // =========================================================

  let saved = 0
  let rejected = 0
  let duplicates = 0
  let failed = 0

  for (
    let index = 0;
    index < batch.length;
    index++
  ) {
    const job = batch[index]

    try {
      console.log(
        `\n🧠 [${index + 1}/${batch.length}] ${job.title} — ${job.company}`,
      )

      const analysis =
        await analyzeJob({
          title: job.title,
          company: job.company,

          location: job.location,
          workplace: job.workplace,
          country: job.country,
          experience: job.experience,
          category: job.category,

          salary: job.salary,
          description: job.description,

          sourceName: job.sourceName,
          sourceUrl: job.sourceUrl,
          applyUrl: job.applyUrl,

          postedAt: job.postedAt,
        })

      console.log(
        `   🤖 AI: ${analysis.decision.toUpperCase()} — ${analysis.score}/100`,
      )

      // -----------------------------------------------------
      // AI REJECT
      // -----------------------------------------------------

      if (
        analysis.decision ===
        'reject'
      ) {
        rejected++

        console.log(
          `   ❌ ${analysis.reason}`,
        )

        continue
      }

      // -----------------------------------------------------
      // SAVE
      // -----------------------------------------------------

      const result =
        await saveAnalyzedJob(
          analysis,
        )

      if (result.saved) {
        saved++

        console.log(
          '   💾 SAVED TO SUPABASE',
        )

        continue
      }

      // -----------------------------------------------------
      // DUPLICATE
      // -----------------------------------------------------

      if (
        result.reason ===
        'Duplicate'
      ) {
        duplicates++

        console.log(
          '   ♻️ DUPLICATE',
        )

        continue
      }

      // -----------------------------------------------------
      // OTHER REJECTION
      // -----------------------------------------------------

      rejected++

      console.log(
        `   🚫 NOT SAVED: ${result.reason}`,
      )
    } catch (error) {
      failed++

      console.error(
        `   ⚠️ FAILED: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`,
      )
    }
  }

  // =========================================================
  // 14. SUMMARY
  // =========================================================

  const summary = {
    collected:
      rawJobs.length,

    validApplyUrls:
      jobsWithApplyUrl.length,

    uniqueApplyUrls:
      urlUniqueJobs.length,

    unique:
      uniqueJobs.length,

    alreadySaved,

    fresh:
      freshJobs.length,

    likelyRelevant:
      candidates.length,

    analyzed:
      batch.length,

    saved,

    rejected,

    duplicates,

    failed,
  }

  // =========================================================
  // 15. FINAL LOG
  // =========================================================

  console.log(
    '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    '📊 RUN SUMMARY',
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  console.log(
    `Collected:        ${summary.collected}`,
  )

  console.log(
    `Valid URLs:        ${summary.validApplyUrls}`,
  )

  console.log(
    `Unique URLs:       ${summary.uniqueApplyUrls}`,
  )

  console.log(
    `Unique Jobs:       ${summary.unique}`,
  )

  console.log(
    `Already Saved:     ${summary.alreadySaved}`,
  )

  console.log(
    `Fresh Jobs:        ${summary.fresh}`,
  )

  console.log(
    `IT Jobs Found:     ${summary.likelyRelevant}`,
  )

  console.log(
    `Analyzed:          ${summary.analyzed}`,
  )

  console.log(
    `Saved:             ${summary.saved}`,
  )

  console.log(
    `Rejected:          ${summary.rejected}`,
  )

  console.log(
    `Duplicates:        ${summary.duplicates}`,
  )

  console.log(
    `Failed:            ${summary.failed}`,
  )

  console.log(
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
  )

  return summary
}