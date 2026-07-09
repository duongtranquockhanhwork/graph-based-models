export interface User {
  id: number
  email: string
  full_name?: string
  avatar_url?: string
  role: 'customer' | 'admin'
  is_active?: boolean
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
  needs_manual_label?: boolean
  manual_sentiment?: string
  manual_event_type?: string
  labeled_at?: string
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

// ---- Admin ----

export interface AdminNewsStats {
  total_news: number
  news_symbol_rows: number
  model_ready_rows: number
  total_processed: number
  pass_count: number
  pass_pct: number
  review_count: number
  drop_count: number
}

export interface DataQuality {
  missing_values: number
  duplicates: number
  return_label_consistency: number
  split_leakage: number
  overall_status: 'PASS' | 'FAIL'
}

export interface ValidationResult {
  total_labeled: number
  sentiment_labeled_count: number
  accuracy_sentiment: number | null
  event_labeled_count: number
  accuracy_event: number | null
}

export interface ActivityLogEntry {
  id: number
  actor_name: string
  action: string
  detail?: string
  status: string
  created_at: string
}

export interface AdminDashboardStats {
  stats: AdminNewsStats
  data_quality: DataQuality
  trend_distribution: Record<string, number>
  sentiment_distribution: Record<string, number>
  activity: ActivityLogEntry[]
  alerts: string[]
  validation_results: ValidationResult
  users_summary: { total: number; admin: number; customer: number }
}

export interface EventKeyword {
  id: number
  event_type: string
  label_vi: string
  keyword: string
  is_active: boolean
  created_at?: string
}

export interface SystemSetting {
  key: string
  value: string
  description?: string
  updated_at?: string
}

export interface AdminUser {
  id: number
  email: string
  full_name?: string
  role: 'customer' | 'admin'
  is_active: boolean
  created_at?: string
}

export interface StockAggregation {
  symbol: string
  company?: string
  industry?: string
  mention_count: number
  sentiment_distribution: Record<string, number>
}

export type LabelingQueueItem = NewsArticle
