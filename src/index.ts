import { supabaseAdmin } from './config/supabase'
import { runJobPipeline } from './jobs/runJobPipeline'

import {
  startJobRun,
  finishJobRun,
  failJobRun,
} from './runs/jobRun'

async function main() {
  console.log('🤖 Ahmed Job AI starting...\n')

  // ---------------------------------------------------------
  // SUPABASE CONNECTION CHECK
  // ---------------------------------------------------------

  const { error } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .limit(1)

  if (error) {
    console.error('❌ Supabase connection failed:')
    console.error(error.message)
    process.exit(1)
  }

  console.log('✅ Supabase connection successful!')

  // ---------------------------------------------------------
  // START JOB RUN
  // ---------------------------------------------------------

  const runId = await startJobRun()

  console.log(`\n🆔 Job Run: ${runId}`)

  try {
    // -------------------------------------------------------
    // RUN JOB HUNTER
    // -------------------------------------------------------

    const summary = await runJobPipeline()

    // -------------------------------------------------------
    // SAVE RUN HISTORY
    // -------------------------------------------------------

    await finishJobRun(runId, summary)

    // -------------------------------------------------------
    // FINAL SUMMARY
    // -------------------------------------------------------

    console.log('\n🚀 JOB HUNTER FINISHED')

    console.log(
      JSON.stringify(
        summary,
        null,
        2,
      ),
    )
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error)

    // -------------------------------------------------------
    // SAVE FAILURE
    // -------------------------------------------------------

    await failJobRun(
      runId,
      message,
    )

    console.error(
      '\n❌ JOB HUNTER FAILED',
    )

    console.error(message)

    process.exit(1)
  }
}

// -----------------------------------------------------------
// GLOBAL ERROR HANDLER
// -----------------------------------------------------------

main().catch((error) => {
  console.error(
    '❌ Unexpected error:',
    error,
  )

  process.exit(1)
})