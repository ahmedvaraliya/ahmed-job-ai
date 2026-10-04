import http from 'node:http'
import { runJobPipeline } from './jobs/runJobPipeline'

const PORT = Number(
  process.env.PORT || 8080,
)

const server = http.createServer(
  async (req, res) => {
    // -------------------------------------------------------
    // HEALTH CHECK
    // -------------------------------------------------------

    if (
      req.method === 'GET' &&
      req.url === '/health'
    ) {
      res.writeHead(200, {
        'Content-Type':
          'application/json',
      })

      res.end(
        JSON.stringify({
          ok: true,
          service:
            'ahmed-job-ai',
        }),
      )

      return
    }

    // -------------------------------------------------------
    // JOB HUNTER
    // -------------------------------------------------------

    if (
      req.method === 'POST' &&
      req.url === '/run'
    ) {
      try {
        console.log(
          '\n☁️ CLOUD JOB RUN STARTED',
        )

        const summary =
          await runJobPipeline()

        console.log(
          '\n☁️ CLOUD JOB RUN FINISHED',
        )

        res.writeHead(200, {
          'Content-Type':
            'application/json',
        })

        res.end(
          JSON.stringify({
            ok: true,
            summary,
          }),
        )
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error)

        console.error(
          '❌ CLOUD JOB RUN FAILED:',
          message,
        )

        res.writeHead(500, {
          'Content-Type':
            'application/json',
        })

        res.end(
          JSON.stringify({
            ok: false,
            error: message,
          }),
        )
      }

      return
    }

    // -------------------------------------------------------
    // NOT FOUND
    // -------------------------------------------------------

    res.writeHead(404, {
      'Content-Type':
        'application/json',
    })

    res.end(
      JSON.stringify({
        error: 'Not found',
      }),
    )
  },
)

server.listen(
  PORT,
  '0.0.0.0',
  () => {
    console.log(
      `☁️ Ahmed Job AI server listening on port ${PORT}`,
    )
  },
)