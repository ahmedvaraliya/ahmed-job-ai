import type { RawJob } from './lever'

function stripHtml(value = ''): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function getTag(xml: string, tag: string): string {
  const match = xml.match(
    new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'),
  )

  return match?.[1]
    ?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .trim() || ''
}

export async function fetchLeverXmlJobs(
  companySlug: string,
): Promise<RawJob[]> {
  const url =
    `https://api.lever.co/v0/postings/${encodeURIComponent(companySlug)}` +
    `?mode=xml`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Lever XML failed for ${companySlug}: ${response.status}`,
    )
  }

  const xml = await response.text()

  const jobs = xml.match(/<job>[\s\S]*?<\/job>/gi) || []

  return jobs.map((job) => {
    const id = getTag(job, 'id')
    const title = getTag(job, 'position')
    const description = stripHtml(
      getTag(job, 'description'),
    )
    const location = getTag(job, 'location')
    const applyUrl = getTag(job, 'apply_url')
    const jobUrl = getTag(job, 'url')

    return {
      externalId: `lever-${companySlug}-${id}`,
      title,
      company: companySlug,
      location,
      workplace: /remote/i.test(location)
        ? 'Remote'
        : '',
      country: '',
      experience: '',
      category: '',
      salary: '',
      description,
      sourceName: 'Lever Public Feed',
      sourceUrl: jobUrl || applyUrl,
      applyUrl,
      postedAt: '',
    }
  })
}