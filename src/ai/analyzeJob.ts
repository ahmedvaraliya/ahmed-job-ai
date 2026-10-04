import { gemini } from './gemini'
import { env } from '../config/env'

export type JobInput = {
  title: string
  company: string

  location?: string
  workplace?: string
  country?: string
  experience?: string
  category?: string

  salary?: string
  description?: string

  sourceName?: string
  sourceUrl?: string
  applyUrl?: string
  postedAt?: string
}

export type JobAnalysis = {
  decision: 'keep' | 'reject'
  score: number
  reason: string

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

  rejectionReasons: string[]
  matchedPreferences: string[]
}

const SYSTEM_PROMPT = `
You are Ahmed's professional AI Job Researcher.

Your job is to carefully analyze job listings and decide whether they
are legitimate, relevant IT/Technology jobs that Ahmed should see.

IMPORTANT:
Ahmed does NOT want only frontend or React jobs.

Ahmed wants jobs across the IT / Technology industry.

==================================================
ALLOWED IT / TECHNOLOGY FIELDS
==================================================

Consider legitimate roles from fields such as:

- Software Engineering
- Software Development
- Frontend Development
- Backend Development
- Full Stack Development
- Web Development
- React
- Angular
- Vue
- JavaScript
- TypeScript
- Java
- Python
- C#
- .NET
- PHP
- Node.js
- Ruby
- Go
- Rust
- C++
- Kotlin
- Swift
- Mobile Development
- Android
- iOS
- Flutter
- React Native
- QA
- Quality Assurance
- Software Testing
- Test Automation
- SDET
- DevOps
- Cloud
- AWS
- Azure
- Google Cloud
- Infrastructure
- Platform Engineering
- Site Reliability Engineering
- Cybersecurity
- Information Security
- Application Security
- Security Engineering
- Data Engineering
- Data Analysis
- Data Science
- Database Engineering
- SQL
- Business Intelligence
- Artificial Intelligence
- Machine Learning
- Deep Learning
- NLP
- Computer Vision
- Generative AI
- IT Support
- Technical Support
- System Administration
- Network Engineering
- IT Administration
- Solutions Architecture
- Software Architecture
- Cloud Architecture
- Technical Architecture
- WordPress
- Shopify
- Webflow
- CMS Development
- E-commerce Development
- Blockchain
- Web3
- Smart Contracts
- Game Development
- Technical Business Analysis
- Systems Analysis
- Technical Product Management
- Technical Program Management
- Technical Project Management
- Engineering Management
- Developer Relations
- Developer Advocacy
- Technical Writing
- Technology Consulting
- IT Consulting
- Solutions Engineering

This list is not exhaustive.

If a role is clearly part of the professional IT/Technology industry,
it can be considered.

==================================================
NON-IT JOBS TO REJECT
==================================================

Reject jobs that are primarily:

- Accounting
- Accountant
- Chartered Accountant / CA
- CPA
- Bookkeeping
- Finance
- Financial Analyst
- Banking roles that are not technology roles
- Sales
- Marketing
- HR
- Recruitment
- Talent Acquisition
- Legal
- Lawyer
- Attorney
- Medical
- Healthcare roles that are not technology roles
- Nursing
- Teaching
- Education
- Hospitality
- Restaurant
- Retail
- Customer Service
- General Administration
- Receptionist
- Warehouse
- Delivery
- Construction
- Mechanical Engineering
- Civil Engineering
- Electrical Engineering
- Chemical Engineering
- Biomedical Engineering
- Other clearly non-technology engineering roles

IMPORTANT:

Do NOT reject a technology role merely because its title contains
"Engineer", "Analyst", "Manager", "Consultant", or "Architect".

For example:

"Engineering Manager - Software"
= IT / Technology

"Data Analyst"
= IT / Technology

"Security Analyst"
= IT / Technology

"Technical Product Manager"
= IT / Technology

"Cloud Architect"
= IT / Technology

But:

"Financial Analyst"
= non-IT

"HR Manager"
= non-IT

"Sales Engineer"
needs careful analysis. If it is primarily selling technical products,
it should normally be rejected unless the listing is clearly a technical
engineering position.

==================================================
LOCATION PREFERENCE
==================================================

Preferred locations:

- USA
- United States
- UK
- United Kingdom
- Canada
- Australia
- UAE
- Dubai
- Abu Dhabi
- Worldwide
- Remote
- Work from anywhere

Remote jobs are strongly preferred.

Hybrid jobs can be kept if they are in one of the preferred countries.

On-site jobs can be kept if they are in one of the preferred countries,
but remote is preferred.

Jobs outside these preferred locations should normally be rejected unless
the listing explicitly says Worldwide, Remote Worldwide, or Work From
Anywhere.

==================================================
JOB QUALITY
==================================================

Behave like a careful human job researcher.

KEEP a job when:

1. It is genuinely an IT/Technology role.
2. The company/job listing appears legitimate.
3. The role has a real application URL.
4. The listing contains enough information to understand the role.
5. It matches Ahmed's preferred geographic/remote requirements.
6. It is not obviously expired, fake, spam, or misleading.

REJECT a job when:

- It is clearly non-IT.
- It is primarily accounting/CA/finance.
- It is primarily sales/marketing/HR/legal/medical/etc.
- It is clearly fake or suspicious.
- The application URL is missing or obviously fake.
- The role is obviously unrelated.
- The location conflicts strongly with Ahmed's preferences.
- The listing is too vague to verify.
- It appears to be an advertisement rather than a real vacancy.

==================================================
DO NOT INVENT INFORMATION
==================================================

Never invent:

- company names
- salary
- location
- experience
- workplace type
- application URLs
- source URLs
- dates
- technologies

If information is missing, return an empty string.

Preserve the original URLs exactly.

Do not replace a real application URL with another URL.

==================================================
SCORING
==================================================

Score from 0 to 100.

90-100:
Excellent legitimate IT job and strong match.

80-89:
Very strong IT job and good match.

70-79:
Good legitimate IT job.

60-69:
Potentially relevant but has some limitations.

0-59:
Generally reject.

A legitimate IT job does NOT need to be frontend/React.

A legitimate backend, DevOps, cybersecurity, QA, cloud, data,
AI/ML, mobile, networking, IT support, architecture, etc. job
can receive a high score.

==================================================
DECISION
==================================================

Return:

"keep"
when the job is a legitimate and useful IT/Technology opportunity.

Return:

"reject"
when it is non-IT, clearly unsuitable, suspicious, unverifiable,
or outside the geographic requirements.

If uncertain, reject rather than invent information.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

No Markdown.
No explanation outside JSON.
`

export async function analyzeJob(
  job: JobInput,
): Promise<JobAnalysis> {
  const userPrompt = `
Analyze this job listing.

JOB DATA:

Title:
${job.title || ''}

Company:
${job.company || ''}

Location:
${job.location || ''}

Workplace:
${job.workplace || ''}

Country:
${job.country || ''}

Experience:
${job.experience || ''}

Category:
${job.category || ''}

Salary:
${job.salary || ''}

Description:
${job.description || ''}

Source:
${job.sourceName || ''}

Source URL:
${job.sourceUrl || ''}

Apply URL:
${job.applyUrl || ''}

Posted At:
${job.postedAt || ''}

Return this exact JSON structure:

{
  "decision": "keep",
  "score": 0,
  "reason": "",
  "title": "",
  "company": "",
  "location": "",
  "workplace": "",
  "country": "",
  "experience": "",
  "category": "",
  "salary": "",
  "description": "",
  "sourceName": "",
  "sourceUrl": "",
  "applyUrl": "",
  "postedAt": "",
  "rejectionReasons": [],
  "matchedPreferences": []
}

Rules:

- Preserve original job information.
- Never invent missing values.
- Keep original source and apply URLs.
- Only keep legitimate IT/Technology jobs.
- Do not restrict the decision to frontend/React.
- Accounting/CA/finance/HR/sales/marketing/legal/medical/general
  non-IT jobs should be rejected.
- Technical roles across the wider IT industry should be considered.
- Remote and preferred countries are important.
`

  const response =
    await gemini.models.generateContent({
      model: env.geminiModel,

      contents: [
        {
          role: 'user',
          parts: [
            {
              text:
                `${SYSTEM_PROMPT}\n\n${userPrompt}`,
            },
          ],
        },
      ],

      config: {
        temperature: 0.1,
        responseMimeType:
          'application/json',
      },
    })

  const raw =
    response.text?.trim() || ''

  if (!raw) {
    throw new Error(
      'Gemini returned an empty response',
    )
  }

  // Remove accidental Markdown JSON fences
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  let parsed: JobAnalysis

  try {
    parsed =
      JSON.parse(cleaned) as JobAnalysis
  } catch {
    throw new Error(
      `Invalid Gemini JSON response: ${raw}`,
    )
  }

  // =========================================================
  // VALIDATION
  // =========================================================

  if (
    parsed.decision !== 'keep' &&
    parsed.decision !== 'reject'
  ) {
    throw new Error(
      'Gemini returned invalid decision',
    )
  }

  if (
    typeof parsed.score !== 'number' ||
    parsed.score < 0 ||
    parsed.score > 100
  ) {
    throw new Error(
      'Gemini returned invalid score',
    )
  }

  // =========================================================
  // SAFETY FALLBACKS
  // =========================================================

  parsed.title =
    parsed.title || job.title || ''

  parsed.company =
    parsed.company || job.company || ''

  parsed.location =
    parsed.location || job.location || ''

  parsed.workplace =
    parsed.workplace ||
    job.workplace ||
    ''

  parsed.country =
    parsed.country ||
    job.country ||
    ''

  parsed.experience =
    parsed.experience ||
    job.experience ||
    ''

  parsed.category =
    parsed.category ||
    job.category ||
    ''

  parsed.salary =
    parsed.salary ||
    job.salary ||
    ''

  parsed.description =
    parsed.description ||
    job.description ||
    ''

  parsed.sourceName =
    parsed.sourceName ||
    job.sourceName ||
    ''

  parsed.sourceUrl =
    parsed.sourceUrl ||
    job.sourceUrl ||
    ''

  parsed.applyUrl =
    parsed.applyUrl ||
    job.applyUrl ||
    ''

  parsed.postedAt =
    parsed.postedAt ||
    job.postedAt ||
    ''

  parsed.reason =
    parsed.reason ||
    'No reason provided'

  parsed.rejectionReasons =
    Array.isArray(
      parsed.rejectionReasons,
    )
      ? parsed.rejectionReasons
      : []

  parsed.matchedPreferences =
    Array.isArray(
      parsed.matchedPreferences,
    )
      ? parsed.matchedPreferences
      : []

  return parsed
}