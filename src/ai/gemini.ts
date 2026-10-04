import { GoogleGenAI } from '@google/genai'
import { env } from '../config/env'

export const gemini = new GoogleGenAI({
  apiKey: env.geminiApiKey,
})

export async function testGemini() {
  const response = await gemini.models.generateContent({
    model: env.geminiModel,
    contents: 'Reply with exactly: GEMINI_OK',
  })

  return response.text?.trim() || ''
}