import { supabaseAdmin } from './config/supabase'
import { testGemini } from './ai/gemini'
import { runJobPipeline } from './jobs/runJobPipeline'

import {
  startJobRun,
  finishJobRun,
  failJobRun,
} from './runs/jobRun'

async function main() {
  console.log(
    '🤖 Ahmed Job AI starting...\n',
  )

  // ---------------------------------------------------------
  // SUPABASE
  // ---------------------------------------------------------

  const { error } = await supabaseAdmin
    .from('jobs')
    .select('id')
    .limit(1)

  if (error) {
    console.error(
      '❌ Supabase connection failed:',
    )
    console.error(error.message)
    process.exit(1)
  }

  console.log(
    '✅ Supabase connection successful!',
  )

  // ---------------------------------------------------------
  // GEMINI
  // ---------------------------------------------------------

  try {
    const result = await testGemini()

    console.log(
      '✅ Gemini connection successful!',
    )

    console.log(
      `🤖 Gemini response: ${result}`,
    )
  } catch (error) {
    console.error(
      '❌ Gemini connection failed:',
    )

    console.error(error)

    process.exit(1)
  }

  // ---------------------------------------------------------
  // START RUN
  // ---------------------------------------------------------

  const runId =
    await startJobRun()

  console.log(
    `\n🆔 Job Run: ${runId}`,
  )

  try {
    // -------------------------------------------------------
    // RUN JOB HUNTER
    // -------------------------------------------------------

    const summary =
      await runJobPipeline()

    // -------------------------------------------------------
    // SAVE RUN HISTORY
    // -------------------------------------------------------

    await finishJobRun(
      runId,
      summary,
    )

    console.log(
      '\n🚀 JOB HUNTER FINISHED',
    )

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

main().catch((error) => {
  console.error(
    '❌ Unexpected error:',
    error,
  )

  process.exit(1)
})