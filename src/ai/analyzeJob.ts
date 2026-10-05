import { gemini } from './gemini'
import { env } from '../config/env'

// ============================================================
// JOB INPUT
// ============================================================

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


// ============================================================
// JOB ANALYSIS
// ============================================================

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


// ============================================================
// SYSTEM PROMPT
// ============================================================

const SYSTEM_PROMPT = `
You are Ahmed's professional AI Job Screening Assistant.

Your job is to behave like a careful HUMAN recruiter who understands
Ahmed's actual job preferences.

You must NOT behave like a generic "find IT jobs" classifier.

==================================================
AHMED'S EXACT JOB PREFERENCE
==================================================

Ahmed is looking specifically for:

1. Frontend Developer
2. Frontend Engineer
3. React Developer
4. React.js Developer
5. React Engineer
6. JavaScript Developer
7. JavaScript Engineer
8. Web Developer
9. Web Engineer
10. UI Developer
11. UI Engineer
12. User Interface Developer
13. WordPress Developer
14. WordPress Engineer
15. WordPress Web Developer
16. WooCommerce Developer
17. WooCommerce Engineer
18. Web Designer + Developer
19. Web Design + Development roles

The role must be genuinely related to frontend/web development.

==================================================
VERY IMPORTANT — DO NOT BROADEN THE ROLE
==================================================

DO NOT consider a job relevant merely because:

- the company is a technology company
- the company uses software
- the job mentions computers
- the job mentions SaaS
- the job uses digital tools
- the job works with developers
- the job is in an IT company

Judge the ACTUAL JOB ROLE.

Examples:

"Frontend Developer at Datadog"
= potentially KEEP

"React Developer at Microsoft"
= potentially KEEP

"WordPress Developer at a small agency"
= potentially KEEP

"Product Marketing Manager at Datadog"
= REJECT

"Account Executive at GitLab"
= REJECT

"Customer Success Manager at a SaaS company"
= REJECT

"HR Manager at a technology company"
= REJECT

"Sales Engineer"
= REJECT unless the listing is genuinely primarily
frontend/web development, which is extremely unlikely.

==================================================
DO NOT ACCEPT OTHER IT FIELDS
==================================================

Even though these are technology jobs, they are NOT Ahmed's target
for this job hunter:

- Backend Developer
- Backend Engineer
- Full Stack Developer
- Full Stack Engineer
- Software Engineer
- Software Developer
- Java Developer
- Python Developer
- C Developer
- C++ Developer
- C# Developer
- .NET Developer
- PHP Developer
- Laravel Developer
- Node.js Developer
- Go Developer
- Rust Developer
- Kotlin Developer
- Swift Developer
- Mobile Developer
- Android Developer
- iOS Developer
- Flutter Developer
- React Native Developer
- DevOps
- Cloud Engineer
- AWS Engineer
- Azure Engineer
- GCP Engineer
- SRE
- Site Reliability Engineer
- Cybersecurity
- Security Engineer
- SOC Analyst
- Data Analyst
- Data Scientist
- Data Engineer
- Machine Learning
- AI Engineer
- Deep Learning
- NLP
- Computer Vision
- Database Engineer
- DBA
- QA Engineer
- Test Engineer
- SDET
- Network Engineer
- System Administrator
- Systems Engineer
- IT Support
- Technical Support
- Help Desk
- Solutions Architect
- Cloud Architect
- Software Architect
- Technical Product Manager
- Product Manager
- Program Manager
- Project Manager
- Engineering Manager
- Technical Writer
- Technology Consultant
- IT Consultant

If the role is not primarily frontend/web/WordPress/UI development,
REJECT it.

==================================================
WORDPRESS RULE
==================================================

WordPress jobs are allowed.

KEEP:

- WordPress Developer
- WordPress Engineer
- WordPress Web Developer
- WordPress Theme Developer
- WordPress Plugin Developer
- WooCommerce Developer
- WordPress + Frontend Developer
- WordPress + PHP + frontend role when the job is clearly
  primarily WordPress/web development

REJECT:

- WordPress Sales
- WordPress Account Manager
- WordPress Customer Success
- WordPress Marketing
- WordPress Project Manager

The actual job must be development.

==================================================
FRONTEND RULE
==================================================

Frontend is the highest priority.

Strong matches include:

- Frontend Developer
- Frontend Engineer
- React Developer
- React.js Developer
- React Engineer
- JavaScript Developer
- UI Developer
- UI Engineer
- Web Developer
- Web Engineer

If the job clearly requires frontend development, KEEP it
when location requirements are satisfied.

==================================================
LOCATION — VERY IMPORTANT
==================================================

Ahmed wants ONLY TWO LOCATION GROUPS.

GROUP 1:
Mumbai / Mumbai Metropolitan Region, India

GROUP 2:
United States / USA

No other location should be accepted.

==================================================
MUMBAI LOCATIONS
==================================================

Treat these as Mumbai/Mumbai-region:

- Mumbai
- Bombay
- Mumbai, Maharashtra
- Mumbai Metropolitan Region
- MMR
- Navi Mumbai
- Thane

A job explicitly located in one of these locations can match
the Mumbai group.

==================================================
USA LOCATIONS
==================================================

Treat these as USA:

- United States
- United States of America
- USA
- U.S.
- US
- New York
- California
- Texas
- Washington
- Florida
- Massachusetts
- Illinois
- New Jersey
- Virginia
- Colorado
- Arizona
- Georgia
- North Carolina
- Pennsylvania
- Oregon
- any clearly identified US city/state

Only treat a location as USA when the listing provides enough
evidence that it is actually in the United States.

==================================================
OTHER COUNTRIES
==================================================

REJECT jobs located in:

- UK
- United Kingdom
- London
- Canada
- Australia
- UAE
- Dubai
- Abu Dhabi
- Germany
- France
- Paris
- Berlin
- Netherlands
- Singapore
- Ireland
- Spain
- Italy
- Poland
- Portugal
- Sweden
- Switzerland
- Denmark
- Norway
- New Zealand
- any other country outside India/USA

Do NOT keep them just because they are good IT jobs.

==================================================
REMOTE JOB RULE
==================================================

Remote jobs require special attention.

A remote job is NOT automatically a USA job.

Examples:

"Remote - Worldwide"
= REJECT

"Remote - Europe"
= REJECT

"Remote - UK"
= REJECT

"Remote - India"
= potentially MUMBAI/INDIA candidate only if the listing
explicitly indicates India eligibility.

"Remote - Mumbai"
= Mumbai candidate

"Remote - USA"
= USA candidate

"Remote - United States"
= USA candidate

"Remote - US only"
= USA candidate

If a remote job does not specify the allowed country/region,
DO NOT assume USA.

If a remote job says "Worldwide", DO NOT accept it.

==================================================
WORKPLACE TYPE
==================================================

All three workplace types are allowed:

- Remote
- Hybrid
- On-site

BUT location rules are mandatory.

Examples:

Frontend Developer
Mumbai
On-site
= KEEP

Frontend Developer
Mumbai
Hybrid
= KEEP

Frontend Developer
Mumbai
Remote
= KEEP

Frontend Developer
USA
On-site
= KEEP

Frontend Developer
USA
Hybrid
= KEEP

Frontend Developer
USA
Remote
= KEEP

Frontend Developer
London
Remote
= REJECT

Frontend Developer
Worldwide Remote
= REJECT

==================================================
NON-TECHNICAL ROLES — ALWAYS REJECT
==================================================

Reject roles primarily involving:

- Sales
- Sales Executive
- Sales Manager
- Account Executive
- Account Manager
- Business Development
- BDR
- SDR
- Marketing
- Product Marketing
- Partner Marketing
- Digital Marketing
- Social Media
- Content Marketing
- SEO Marketing
- Customer Success
- Customer Success Manager
- Customer Success Partner
- Client Success
- HR
- Human Resources
- Recruitment
- Recruiter
- Talent Acquisition
- Finance
- Accounting
- Accountant
- Banking
- Investment Banking
- Financial Analyst
- Legal
- Lawyer
- Attorney
- Medical
- Doctor
- Nursing
- Hospitality
- Restaurant
- Hotel
- Retail
- Store Manager
- Administration
- Receptionist
- Warehouse
- Delivery
- Logistics
- Construction
- Civil Engineering
- Mechanical Engineering
- Electrical Engineering
- Chemical Engineering
- Structural Engineering

==================================================
HUMAN-LIKE DECISION PROCESS
==================================================

Before deciding, think through these questions:

1. What is the ACTUAL job title?
2. What would Ahmed actually do every day?
3. Is frontend/web/WordPress development the core responsibility?
4. Is the location Mumbai/MMR or USA?
5. If remote, does the listing explicitly allow India/Mumbai or USA?
6. Is this a genuine vacancy?
7. Is there a real application URL?
8. Is the listing specific enough to understand the role?
9. Is the company/job information believable?
10. Is this actually useful to Ahmed?

Do NOT make decisions based only on the company name.

==================================================
LOCATION MUST BE EXPLICIT
==================================================

Do NOT infer location from:

- company headquarters
- company address
- company origin
- employee location
- description mentioning another city
- "we have offices in Mumbai"
- "our Mumbai team"
- company domain

The JOB LOCATION must match.

Example:

Company:
Google

Job:
Frontend Developer

Job location:
London

REJECT.

Do NOT say:
"Google has an office in Mumbai, so it can be Mumbai."

==================================================
APPLICATION URL
==================================================

A real application URL is required.

If apply URL is missing:
REJECT.

If apply URL is clearly fake:
REJECT.

Never invent an application URL.

Never replace the provided application URL.

==================================================
DUPLICATES
==================================================

You are not responsible for database-level duplicate detection.

The application handles duplicates separately.

However, if the listing itself clearly contains duplicate content,
do not treat it as a better job.

==================================================
NO INVENTION
==================================================

Never invent:

- salary
- location
- company
- technologies
- experience
- workplace type
- application URL
- source URL
- dates
- job responsibilities

If information is missing:
return an empty string.

==================================================
QUALITY
==================================================

Behave like a human job researcher.

KEEP when:

- the role is genuinely frontend/web/WordPress development
- location is Mumbai/MMR or USA
- application URL is real
- listing appears legitimate
- enough information exists
- role is actually useful for Ahmed

REJECT when:

- wrong role
- wrong location
- worldwide remote
- remote country is unspecified
- non-technical role
- fake/suspicious listing
- missing application URL
- unclear listing
- primarily sales/marketing/HR/etc.

==================================================
SCORING
==================================================

Score from 0 to 100.

90-100:
Excellent direct match.

80-89:
Very strong match.

70-79:
Good match.

60-69:
Potential match but some limitations.

0-59:
Weak or unsuitable.

Score must consider:

- exact role match
- location match
- job legitimacy
- quality of listing
- relevance to Ahmed

A Mumbai Frontend Developer should generally score very highly.

A USA React Developer should generally score highly.

A WordPress Developer in Mumbai should generally score highly.

A Frontend Developer in London must be REJECTED,
regardless of score.

A Marketing Manager at a tech company must be REJECTED.

==================================================
FINAL DECISION
==================================================

KEEP only when BOTH are true:

1. The role matches Ahmed's frontend/web/WordPress preference.
2. The location matches Mumbai/MMR or USA.

Otherwise:
REJECT.

Do not compromise these two conditions.

==================================================
OUTPUT
==================================================

Return ONLY valid JSON.

No Markdown.

No explanation outside JSON.
`


// ============================================================
// ANALYZE JOB
// ============================================================

export async function analyzeJob(
  job: JobInput,
): Promise<JobAnalysis> {

  const userPrompt = `
Analyze this job listing according to the COMPLETE SYSTEM RULES.

JOB DATA
==================================================

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


==================================================
IMPORTANT FINAL CHECK
==================================================

Before returning your answer:

1. Is this actually a frontend/web/WordPress development role?
2. Is the job location actually Mumbai/MMR or USA?
3. If remote, is the allowed region explicitly Mumbai/India or USA?
4. Is this NOT marketing, sales, HR, customer success, finance,
   operations, or another unrelated role?
5. Is there a real application URL?
6. Did you preserve the original job information?
7. Did you avoid inventing anything?

If ANY critical requirement fails:
decision = "reject"

Return the exact JSON structure below.

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
- Preserve original application URL.
- Keep ONLY frontend/web/WordPress/UI development roles.
- Keep ONLY Mumbai/MMR or USA locations.
- Remote worldwide is NOT acceptable.
- Remote with unspecified country is NOT automatically USA.
- UK is NOT acceptable.
- Canada is NOT acceptable.
- Australia is NOT acceptable.
- UAE is NOT acceptable.
- Europe is NOT acceptable.
- Other countries are NOT acceptable.
- Mumbai/MMR is highly preferred.
- USA is the only international location allowed.
- Remote, hybrid and on-site are all allowed.
- Reject sales.
- Reject marketing.
- Reject HR.
- Reject recruitment.
- Reject customer success.
- Reject finance.
- Reject accounting.
- Reject legal.
- Reject medical.
- Reject hospitality.
- Reject retail.
- Reject unrelated engineering fields.
- Reject backend-only roles.
- Reject full-stack roles unless the listing is clearly and
  predominantly frontend/web development.
- Reject generic software engineering roles.
- Reject data/AI/ML roles.
- Reject DevOps/cloud roles.
- Reject cybersecurity roles.
- Reject QA-only roles.
- Reject IT support roles.
- Reject product/project management roles.
- Never infer the job location from company headquarters.
- Never invent a missing location.
- Never invent a missing application URL.
`


  // ============================================================
  // GEMINI REQUEST
  // ============================================================

  const response =
    await gemini.models.generateContent({
      model:
        env.geminiModel,

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


  // ============================================================
  // RAW RESPONSE
  // ============================================================

  const raw =
    response.text?.trim() || ''


  if (!raw) {
    throw new Error(
      'Gemini returned an empty response',
    )
  }


  // ============================================================
  // CLEAN JSON
  // ============================================================

  const cleaned =
    raw
      .replace(
        /^```json\s*/i,
        '',
      )
      .replace(
        /^```\s*/i,
        '',
      )
      .replace(
        /\s*```$/i,
        '',
      )
      .trim()


  // ============================================================
  // PARSE
  // ============================================================

  let parsed: JobAnalysis

  try {
    parsed =
      JSON.parse(
        cleaned,
      ) as JobAnalysis
  } catch {
    throw new Error(
      `Invalid Gemini JSON response: ${raw}`,
    )
  }


  // ============================================================
  // VALIDATE DECISION
  // ============================================================

  if (
    parsed.decision !==
      'keep' &&
    parsed.decision !==
      'reject'
  ) {
    throw new Error(
      'Gemini returned invalid decision',
    )
  }


  // ============================================================
  // VALIDATE SCORE
  // ============================================================

  if (
    typeof parsed.score !==
      'number' ||
    parsed.score < 0 ||
    parsed.score > 100
  ) {
    throw new Error(
      'Gemini returned invalid score',
    )
  }


  // ============================================================
  // SAFETY FALLBACKS
  // ============================================================

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


  // ============================================================
  // ARRAY SAFETY
  // ============================================================

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


  // ============================================================
  // HARD SAFETY CHECK
  // ============================================================
  //
  // Gemini should already have made the decision, but we add
  // another safety layer here so a hallucinated KEEP cannot
  // accidentally bypass the requirements.
  //
  // ============================================================

  const title =
    `${parsed.title} ${parsed.category}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()


  const location =
    `${parsed.location} ${parsed.country} ${parsed.workplace}`
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()


  // ------------------------------------------------------------
  // Allowed roles
  // ------------------------------------------------------------

  const allowedRoleKeywords = [
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


  const hasAllowedRole =
    allowedRoleKeywords.some(
      (keyword) =>
        title.includes(
          keyword,
        ),
    )


  // ------------------------------------------------------------
  // Mumbai
  // ------------------------------------------------------------

  const mumbaiKeywords = [
    'mumbai',
    'bombay',
    'navi mumbai',
    'thane',
    'mumbai metropolitan region',
    'mumbai metropolitan',
    'mmr',
  ]


  const isMumbai =
    mumbaiKeywords.some(
      (keyword) =>
        location.includes(
          keyword,
        ),
    )


  // ------------------------------------------------------------
  // USA
  // ------------------------------------------------------------

  const usaKeywords = [
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


  const isUSA =
    usaKeywords.some(
      (keyword) =>
        location.includes(
          keyword,
        ),
    )


  // ------------------------------------------------------------
  // Worldwide / unsupported location
  // ------------------------------------------------------------

  const worldwideKeywords = [
    'worldwide',
    'remote worldwide',
    'work from anywhere',
    'anywhere in the world',
    'global remote',
    'global',
    'europe',
    'european union',
    'uk',
    'united kingdom',
    'london',
    'canada',
    'australia',
    'uae',
    'dubai',
    'germany',
    'france',
    'paris',
    'berlin',
    'netherlands',
    'singapore',
    'ireland',
    'spain',
    'italy',
    'poland',
    'portugal',
    'sweden',
    'switzerland',
    'denmark',
    'norway',
    'new zealand',
  ]


  const unsupportedLocation =
    worldwideKeywords.some(
      (keyword) =>
        location.includes(
          keyword,
        ),
    )


  // ------------------------------------------------------------
  // HARD REJECT
  // ------------------------------------------------------------

  if (
    parsed.decision ===
      'keep'
  ) {
    if (
      !hasAllowedRole
    ) {
      parsed.decision =
        'reject'

      parsed.rejectionReasons.push(
        'The role is not a target frontend, web, UI, React, JavaScript, WordPress, or WooCommerce development role.',
      )

      parsed.reason =
        'Rejected because the actual role is outside Ahmed’s target frontend/web/WordPress roles.'
    }


    if (
      unsupportedLocation
    ) {
      parsed.decision =
        'reject'

      parsed.rejectionReasons.push(
        'The job is outside the allowed Mumbai/MMR or USA locations.',
      )

      parsed.reason =
        'Rejected because the job location is outside Mumbai/MMR or USA.'
    }


    if (
      !isMumbai &&
      !isUSA
    ) {
      parsed.decision =
        'reject'

      parsed.rejectionReasons.push(
        'The listing does not clearly identify Mumbai/MMR or USA as the job location.',
      )

      parsed.reason =
        'Rejected because the job location is not clearly Mumbai/MMR or USA.'
    }
  }


  // ============================================================
  // FINAL MATCHED PREFERENCES
  // ============================================================

  const matched =
    Array.isArray(
      parsed.matchedPreferences,
    )
      ? parsed.matchedPreferences
      : []


  if (
    hasAllowedRole &&
    !matched.some(
      (item) =>
        item
          .toLowerCase()
          .includes(
            'frontend',
          ),
    )
  ) {
    matched.push(
      'Target frontend/web development role',
    )
  }


  if (isMumbai) {
    matched.push(
      'Mumbai/MMR location',
    )
  }


  if (isUSA) {
    matched.push(
      'USA location',
    )
  }


  if (
    location.includes(
      'remote',
    )
  ) {
    matched.push(
      'Remote',
    )
  }


  if (
    location.includes(
      'hybrid',
    )
  ) {
    matched.push(
      'Hybrid',
    )
  }


  if (
    location.includes(
      'on-site',
    ) ||
    location.includes(
      'onsite',
    ) ||
    location.includes(
      'on site',
    )
  ) {
    matched.push(
      'On-site',
    )
  }


  parsed.matchedPreferences =
    Array.from(
      new Set(
        matched,
      ),
    )


  // ============================================================
  // FINAL SCORE SAFETY
  // ============================================================

  if (
    parsed.decision ===
    'reject'
  ) {
    // Don't allow a rejected job to appear as a high-quality
    // match in downstream UI.
    parsed.score =
      Math.min(
        parsed.score,
        59,
      )
  }


  // ============================================================
  // RETURN
  // ============================================================

  return parsed
}