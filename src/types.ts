export type ToolCondition = 'Healthy' | 'Warning' | 'Worn' | 'Failed'
export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved'

export interface MachiningParameters {
  cuttingSpeed: number
  feedRate: number
  depthOfCut: number
  spindleLoad: number
  toolVibration: number
}

export interface ToolRecord {
  id: string
  name: string
  machineId: string
  cadNumber: string
  condition: ToolCondition
  inspectedAt: string
  lastPrediction: string
  maintenance: string
  material: string
  location: string
}

export interface PredictionRecord {
  id: string
  toolId: string
  machineId: string
  cadNumber: string
  parameters: MachiningParameters
  condition: ToolCondition
  probabilities: Record<string, number>
  timestamp: string
  alertStatus: 'None' | 'Open' | 'Acknowledged' | 'Resolved'
  simulated: boolean
}

export interface AlertRecord {
  id: string
  predictionId?: string
  toolId: string
  machineId: string
  cadNumber: string
  condition: ToolCondition
  failureProbability: number
  severity: 'Critical' | 'High' | 'Medium'
  timestamp: string
  recommendation: string
  deliveryStatus: string
  status: AlertStatus
}

export interface PredictionInput {
  toolId: string
  machineId: string
  cadNumber: string
  parameters: MachiningParameters
}

export interface PredictionResponse {
  prediction_id: string
  predicted_condition: string
  class_probabilities: Record<string, number>
  alert_required: boolean
  timestamp: string
}
