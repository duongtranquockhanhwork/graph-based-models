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

export interface LiveQuote {
  symbol: string
  company_name: string | null
  exchange: string | null
  price: number
  reference_price: number
  ceiling: number
  floor: number
  open_price: number
  avg_price: number
  highest: number
  lowest: number
  volume: number
  change: number
  percent_change: number
  bid_1_price: number
  bid_1_volume: number
  bid_2_price: number
  bid_2_volume: number
  bid_3_price: number
  bid_3_volume: number
  ask_1_price: number
  ask_1_volume: number
  ask_2_price: number
  ask_2_volume: number
  ask_3_price: number
  ask_3_volume: number
  updated_at: string
}

export interface Candle {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export interface IntradayTrade {
  time: string
  price: number
  volume: number
  match_type: 'buy' | 'sell' | string
  id: string
}

export interface StockOverview {
  symbol: string
  organ_name?: string | null
  sector?: string | null
  market_cap?: number | null
  issue_share?: number | null
  company_profile?: string | null
  listing_date?: string | null
  foreigner_percentage?: number | null
  maximum_foreign_percentage?: number | null
  state_percentage?: number | null
  target_price?: number | null
  dividend_per_share_tsr?: number | null
  average_match_value1_month?: number | null
  average_match_volume1_month?: number | null
  highest_price1_year?: number | null
  lowest_price1_year?: number | null
  [key: string]: unknown
}

export interface Shareholder {
  share_holder: string
  quantity: number
  share_own_percent: number
  update_date?: string | null
}

export interface CompanyEvent {
  id: string
  event_title_vi?: string | null
  event_title_en?: string | null
  action_type_vi?: string | null
  public_date?: string | null
  category?: string | null
  [key: string]: unknown
}

export interface FinancialLineItem {
  item: string
  item_en?: string
  item_id?: string
  [year: string]: string | number | null | undefined
}

export interface FinancialStatements {
  income_statement: FinancialLineItem[]
  balance_sheet: FinancialLineItem[]
  cash_flow: FinancialLineItem[]
  available: boolean
}

export interface ModelEvaluation {
  accuracy: number
  precision: number
  recall: number
  f1_score: number
  confusion_matrix: number[][]
  baseline_accuracy: number
  graph_enhanced_accuracy: number
  ecbm_accuracy?: number | null
  ecbm_confusion_matrix?: number[][] | null
  ecbm_class_report?: Record<string, Record<string, number>> | null
  labels: string[]
  class_report?: Record<string, Record<string, number>>
  sample_size: number
  insufficient_data: boolean
}

export interface ModelInfo {
  active_model: 'ecbm' | 'heuristic_baseline'
  last_training_metrics: {
    trained: boolean
    sample_size?: number
    real_price_labels?: number
    sentiment_proxy_labels?: number
    train_size?: number
    val_size?: number
    val_accuracy?: number
    val_f1_weighted?: number
    val_f1_macro?: number
    epochs_run?: number
    labels?: string[]
    reason?: string
  } | null
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
