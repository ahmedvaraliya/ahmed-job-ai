import 'dotenv/config'

function required(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`)
  }

  return value
}

export const env = {
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  geminiApiKey: required('GEMINI_API_KEY'),
  geminiModel: process.env.GEMINI_MODEL || 'gemini-2.5-flash',

  jobHunterEmail: required('JOB_HUNTER_EMAIL'),

  emailApiKey: process.env.EMAIL_API_KEY || '',

  jobBatchSize: Number(process.env.JOB_BATCH_SIZE || 30),
}