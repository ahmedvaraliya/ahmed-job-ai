export type RawJob = {
  externalId: string
  title: string
  company: string
  location: string
  workplace: string
  country: string
  experience: string
  category: string
  salary: string
  description: string
  sourceName: string
  sourceUrl: string
  applyUrl: string
  postedAt: string
}

type LeverPosting = {
  id: string
  text?: string
  createdAt?: number
  categories?: {
    location?: string
    team?: string
    level?: string
  }
  content?: {
    description?: string
  }
  salaryDescription?: string
  urls?: {
    show?: string
    apply?: string
  }
  workplaceType?: string
}

type LeverResponse = {
  data: LeverPosting[]
  hasNext?: boolean
  next?: string
}

export async function fetchLeverJobs(
  company: string,
): Promise<RawJob[]> {
  const url =
    `https://api.lever.co/v1/postings` +
    `?mode=json&limit=100&distributionChannel=public`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Lever request failed: ${response.status}`,
    )
  }

  const json = (await response.json()) as LeverResponse

  return json.data
    .filter((job) => job.text && job.urls?.show)
    .map((job) => ({
      externalId: `lever-${company}-${job.id}`,

      title: job.text || '',

      company,

      location: job.categories?.location || '',

      workplace: job.workplaceType || '',

      country: '',

      experience: job.categories?.level || '',

      category:
        job.categories?.team || 'Frontend',

      salary: job.salaryDescription || '',

      description:
        job.content?.description || '',

      sourceName: 'Lever',

      sourceUrl: job.urls?.show || '',

      applyUrl: job.urls?.apply || job.urls?.show || '',

      postedAt: job.createdAt
        ? new Date(job.createdAt).toISOString()
        : '',
    }))
}