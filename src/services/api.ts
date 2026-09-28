import axios from 'axios'
import type { PredictionInput, PredictionResponse } from '../types'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL
const useMockData = import.meta.env.VITE_USE_MOCK_DATA !== 'false'

export const predictTool = async (input: PredictionInput): Promise<PredictionResponse> => {
  if (apiBaseUrl && !useMockData) {
    const { data } = await axios.post<PredictionResponse>(`${apiBaseUrl}/api/predict`, {
      tool_id: input.toolId,
      machine_id: input.machineId,
      cad_document_number: input.cadNumber,
      Cutting_Speed_m_min: input.parameters.cuttingSpeed,
      Feed_Rate_mm_rev: input.parameters.feedRate,
      Depth_of_Cut_mm: input.parameters.depthOfCut,
      Spindle_Load_pct: input.parameters.spindleLoad,
      Tool_Vibration_mm_s: input.parameters.toolVibration,
    })
    return data
  }

  await new Promise((resolve) => window.setTimeout(resolve, 850))
  const { spindleLoad, toolVibration, cuttingSpeed, feedRate, depthOfCut } = input.parameters
  const risk = Math.max(
    0,
    Math.min(
      1,
      (spindleLoad - 55) / 110 +
        toolVibration / 17 +
        feedRate / 4 +
        depthOfCut / 40 -
        cuttingSpeed / 1500,
    ),
  )
  const condition =
    risk > 0.74 ? 'Failed' : risk > 0.58 ? 'Worn' : risk > 0.4 ? 'Warning' : 'Healthy'
  const scores =
    condition === 'Failed'
      ? [0.02, 0.04, 0.11, 0.83]
      : condition === 'Worn'
        ? [0.06, 0.18, 0.65, 0.11]
        : condition === 'Warning'
          ? [0.13, 0.61, 0.2, 0.06]
          : [0.91, 0.06, 0.02, 0.01]

  return {
    prediction_id: `MOCK-${Date.now().toString().slice(-6)}`,
    predicted_condition: condition,
    class_probabilities: Object.fromEntries(
      ['Healthy', 'Warning', 'Worn', 'Failed'].map((label, index) => [label, scores[index]]),
    ),
    alert_required: condition === 'Worn' || condition === 'Failed',
    timestamp: new Date().toISOString(),
  }
}

export const testWindchillConnection = async (serverUrl: string) => {
  await new Promise((resolve) => window.setTimeout(resolve, 700))
  return {
    connected: false,
    message: serverUrl
      ? 'Demo mode: no Windchill server request was sent.'
      : 'Enter a server URL first.',
  }
}
