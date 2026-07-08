export interface User {
  id: number
  email: string
  full_name?: string
  avatar_url?: string
  created_at?: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
  user: User
}

export interface NewsArticle {
  id: number
  title: string
  content?: string
  source?: string
  published_date?: string
  url?: string
  stocks_mentioned: string[]
  companies_mentioned: string[]
  industries_mentioned: string[]
  events_detected: string[]
  sentiment?: string
  impact_score?: number
  predicted_trend?: string
  prediction_confidence?: number
  prediction_explanation?: Record<string, unknown>
  is_analyzed: boolean
  created_at?: string
}

export interface GraphNode {
  id: string
  label: string
  type: string
  color: string
  size: number
  properties: Record<string, string>
}

export interface GraphEdge {
  source: string
  target: string
  relation: string
  weight: number
}

export interface GraphData {
  nodes: GraphNode[]
  edges: GraphEdge[]
  metadata: Record<string, number>
}

export interface DashboardStats {
  total_news: number
  analyzed_news: number
  total_stocks: number
  total_companies: number
  sentiment_distribution: Record<string, number>
  top_stocks: { symbol: string; count: number }[]
  top_industries: { industry: string; count: number }[]
  trend_distribution: Record<string, number>
  news_by_date: { date: string; count: number }[]
}

export interface Prediction {
  stock_symbol: string
  trend: string
  confidence: number
  sentiment?: string
  events?: string[]
  news_title?: string
  published_date?: string
  explanation?: {
    reasons: string[]
    composite_score: number
  }
  features?: Record<string, number>
}

export interface ModelEvaluation {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  confusion_matrix: number[][]
  baseline_accuracy: number
  graph_enhanced_accuracy: number
  labels: string[]
  class_report?: Record<string, Record<string, number>>
}
