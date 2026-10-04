import type { RawJob } from './lever'

type ArbeitnowJob = {
  slug?: string
  company_name?: string
  title?: string
  description?: string
  location?: string
  remote?: boolean
  url?: string
  tags?: string[]
  job_types?: string[]
  created_at?: number
}

type ArbeitnowResponse = {
  data?: ArbeitnowJob[]
  meta?: {
    current_page?: number
    last_page?: number
  }
}

function stripHtml(value = '') {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchApi(
  endpoint: string,
  sourceName: string,
): Promise<RawJob[]> {
  const response = await fetch(endpoint)

  if (!response.ok) {
    throw new Error(
      `${sourceName} failed: ${response.status}`,
    )
  }

  const json =
    (await response.json()) as ArbeitnowResponse

  return (json.data || []).map((job) => ({
    externalId:
      `arbeitnow-${job.slug || job.url || job.title}`,

    title: job.title || '',

    company: job.company_name || '',

    location: job.location || '',

    workplace: job.remote ? 'Remote' : 'On-site',

    country: '',

    experience: '',

    category:
      job.tags?.join(', ') || '',

    salary: '',

    description:
      stripHtml(job.description || ''),

    sourceName,

    sourceUrl: job.url || '',

    applyUrl: job.url || '',

    postedAt: job.created_at
      ? new Date(job.created_at * 1000).toISOString()
      : '',
  }))
}

export async function fetchArbeitnowJobs() {
  return fetchApi(
    'https://www.arbeitnow.com/api/job-board-api',
    'Arbeitnow',
  )
}

export async function fetchArbeitnowUKJobs() {
  return fetchApi(
    'https://www.arbeitnow.co.uk/api/job-board-api',
    'Arbeitnow UK',
  )
}