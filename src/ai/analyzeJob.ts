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
are legitimate, relevant IT / Technology jobs that Ahmed should see.

Ahmed wants a WIDE RANGE of IT / Technology jobs.

Do NOT limit results to frontend, React, JavaScript, or web development.

==================================================
ALLOWED IT / TECHNOLOGY FIELDS
==================================================

Consider legitimate professional roles from fields such as:

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
- C
- C++
- C#
- .NET
- PHP
- Laravel
- Node.js
- Ruby
- Go
- Rust
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
- Cloud Engineering
- AWS
- Azure
- Google Cloud
- Infrastructure
- Platform Engineering
- Site Reliability Engineering
- SRE

- Cybersecurity
- Information Security
- Application Security
- Security Engineering
- SOC
- Security Analysis
- Penetration Testing

- Data Engineering
- Data Analysis
- Data Science
- Database Engineering
- SQL
- Business Intelligence

- Artificial Intelligence
- AI Engineering
- Machine Learning
- Deep Learning
- NLP
- Computer Vision
- Generative AI

- IT Support
- Technical Support
- Help Desk
- System Administration
- Systems Engineering
- Network Engineering
- Networking
- IT Administration

- Solutions Architecture
- Software Architecture
- Cloud Architecture
- Technical Architecture

- WordPress
- Shopify
- Webflow
- WooCommerce
- CMS Development
- E-commerce Development

- Blockchain
- Web3
- Smart Contracts

- Game Development
- Unity
- Unreal Engine

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

This list is NOT exhaustive.

If a role is clearly part of the professional IT / Technology industry,
consider it even if it is not explicitly listed above.

==================================================
NON-IT JOBS TO REJECT
==================================================

Reject jobs that are primarily:

- Accounting
- Accountant
- Chartered Accountant
- CA
- CPA
- Bookkeeping
- Finance
- Financial Analyst
- Banking roles that are not technology roles
- Investment Banking

- Sales
- Sales Executive
- Sales Manager
- SDR
- BDR
- Business Development roles that are primarily sales

- Marketing
- Digital Marketing
- Social Media Marketing
- Content Marketing
- SEO roles that are primarily marketing

- HR
- Human Resources
- Recruitment
- Recruiter
- Talent Acquisition

- Legal
- Lawyer
- Attorney

- Medical
- Doctor
- Nursing
- Healthcare roles that are not technology roles

- Teaching
- Teacher
- Education roles that are not technology roles

- Hospitality
- Restaurant
- Hotel

- Retail
- Store roles

- General Administration
- Receptionist
- Office Administration

- Warehouse
- Delivery
- Construction

- Civil Engineering
- Mechanical Engineering
- Electrical Engineering
- Chemical Engineering
- Structural Engineering
- Biomedical Engineering

IMPORTANT:

Do NOT reject a technology role simply because its title contains:

Engineer
Analyst
Manager
Consultant
Architect
Specialist

Examples:

Software Engineering Manager
= KEEP

Data Analyst
= KEEP

Security Analyst
= KEEP

Cloud Architect
= KEEP

Technical Product Manager
= KEEP

IT Consultant
= KEEP

Financial Analyst
= REJECT

HR Manager
= REJECT

Sales Executive
= REJECT

Sales Engineer
= usually REJECT if primarily sales/business development

==================================================
LOCATION PREFERENCE
==================================================

Ahmed wants jobs from INDIA as well as international locations.

IMPORTANT:

INDIA MUST NOT BE REJECTED.

India is an important target location.

The preferred location priority is:

1. Mumbai / Mumbai Metropolitan Region
2. Other India locations
3. Remote India
4. Worldwide Remote / Work From Anywhere
5. USA
6. UK
7. Canada
8. Australia
9. UAE
10. Other legitimate international locations

==================================================
INDIA PREFERENCE
==================================================

Strongly consider legitimate IT jobs from:

- Mumbai
- Navi Mumbai
- Thane
- Mumbai Metropolitan Region
- Bengaluru
- Bangalore
- Hyderabad
- Pune
- Delhi
- New Delhi
- Noida
- Gurgaon
- Gurugram
- Chennai
- Kolkata
- Ahmedabad
- Surat
- Jaipur
- Kochi
- Coimbatore
- Lucknow
- Indore
- Bhubaneswar
- Chandigarh
- Nagpur
- Vadodara
- Visakhapatnam
- Thiruvananthapuram

and other cities in India.

Mumbai is especially preferred.

A legitimate IT job in Mumbai should receive a strong preference.

A legitimate IT job anywhere in India should also be considered.

Do NOT reject an Indian IT job simply because it is:

- On-site
- Hybrid
- Remote

All three workplace types are acceptable.

Remote is preferred, but on-site/hybrid Indian IT jobs are still valid.

==================================================
INTERNATIONAL / REMOTE
==================================================

Also consider:

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
- Remote Worldwide
- Work From Anywhere
- Global Remote
- Anywhere in the World

Remote worldwide jobs are strongly preferred.

Remote India jobs are also strongly preferred.

Hybrid/on-site jobs are acceptable in India.

Hybrid/on-site jobs are also acceptable in USA, UK, Canada,
Australia and UAE.

Other countries can also be considered when the listing is clearly
a legitimate IT / Technology opportunity.

Do NOT automatically reject a legitimate IT job merely because it is
located in a country not listed above.

Location is a preference, not an automatic rejection criterion.

==================================================
LOCATION PRIORITY
==================================================

When scoring a legitimate IT job:

Mumbai / Mumbai region:
VERY HIGH preference.

Other India:
HIGH preference.

Remote India:
VERY HIGH preference.

Worldwide Remote:
VERY HIGH preference.

USA / UK / Canada / Australia / UAE:
HIGH preference.

Other legitimate international IT jobs:
MODERATE preference.

The location preference must NEVER cause a legitimate Mumbai or
Indian IT job to be rejected.

==================================================
JOB QUALITY
==================================================

Behave like a careful human job researcher.

KEEP a job when:

1. It is genuinely an IT / Technology role.
2. The company/job listing appears legitimate.
3. There is a real application URL.
4. There is enough information to understand the role.
5. It is a genuine vacancy rather than obvious spam.
6. The job is relevant to Ahmed's broad IT preferences.

REJECT a job when:

- It is clearly non-IT.
- It is primarily accounting / CA / finance.
- It is primarily sales / marketing / HR / recruitment.
- It is primarily legal / medical / hospitality / retail.
- It is clearly fake or suspicious.
- The application URL is missing or obviously fake.
- The role is obviously unrelated to technology.
- It appears to be an advertisement rather than a real vacancy.
- The listing is too vague to reasonably verify.

Do NOT reject solely because of location.

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

Preserve original URLs exactly.

Do not replace a real application URL with another URL.

==================================================
SCORING
==================================================

Score from 0 to 100.

90-100:
Excellent legitimate IT job and excellent match.

80-89:
Very strong IT job and strong match.

70-79:
Good legitimate IT job.

60-69:
Potentially relevant but has limitations.

0-59:
Weak or unsuitable.

Location can influence the score, but location alone must NOT cause
a legitimate IT job to be rejected.

Examples:

Senior Software Engineer - Mumbai
= potentially 90+

Frontend Developer - Bengaluru
= potentially 85+

Backend Developer - Pune
= potentially 85+

DevOps Engineer - India Remote
= potentially 90+

AI Engineer - Worldwide Remote
= potentially 90+

Software Engineer - USA
= potentially 85+

Cybersecurity Analyst - UK
= potentially 85+

Software Developer - Germany
= potentially 75+

The exact score depends on job quality and relevance.

==================================================
DECISION
==================================================

Return:

"keep"

when the job is a legitimate and useful IT / Technology opportunity.

Return:

"reject"

when it is clearly non-IT, fake, suspicious, unrelated, or otherwise
not a useful technology vacancy.

IMPORTANT:

A legitimate IT job in INDIA should normally be KEPT.

A legitimate IT job in MUMBAI should receive especially strong preference.

A legitimate remote worldwide IT job should normally be KEPT.

Do NOT reject a job simply because it is located in India.

Do NOT reject a job simply because it is outside USA/UK/Canada/Australia/UAE.

If uncertain about location preference but the role is clearly legitimate
IT/Technology, prefer KEEP.

If uncertain whether the role itself is IT, inspect the complete listing
before deciding.

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
Analyze this job listing carefully.

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
- Preserve original source URL.
- Preserve original apply URL.
- Only keep legitimate IT / Technology jobs.
- Consider the FULL IT industry, not only frontend or React.
- Mumbai IT jobs are highly preferred.
- Indian IT jobs are strongly preferred and MUST NOT be rejected merely
  because they are in India.
- Remote India jobs are highly preferred.
- Worldwide remote jobs are highly preferred.
- USA, UK, Canada, Australia and UAE are also preferred.
- Other legitimate international IT jobs may also be kept.
- Do not reject solely because of country.
- Reject accounting, CA, finance, sales, marketing, HR, recruitment,
  legal, medical, hospitality, retail and clearly unrelated jobs.
- Technical roles such as software engineering, data, security, DevOps,
  cloud, QA, networking, IT support, architecture, AI/ML and technical
  product/project roles should be considered.
- Verify the job based on the actual listing information.
- Do not invent technologies, salary, experience or location.
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
    parsed.title ||
    job.title ||
    ''

  parsed.company =
    parsed.company ||
    job.company ||
    ''

  parsed.location =
    parsed.location ||
    job.location ||
    ''

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