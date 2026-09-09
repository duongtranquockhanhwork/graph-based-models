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
  prediction_decision?: string
  prediction_explanation?: PredictionExplanation
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

export interface KgExplanation {
  kind: 'DIRECT_MENTION' | 'COMENTION_HISTORY' | 'INDIRECT_EXPOSURE' | string
  detail?: string
  path?: string
  peers?: string[]
}

export interface ScoredSymbol {
  symbol: string
  predicted_label: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL'
  confidence: number
  decision: string
  focus_role?: string
}

/** Đầu ra của bộ dự đoán, lưu nguyên trong NewsArticle.prediction_explanation.
 *  `engine` cho biết kết quả đến từ mô hình đã kiểm chứng hay từ bộ luật —
 *  giao diện phải hiển thị khác nhau cho hai trường hợp này. */
export interface PredictionExplanation {
  engine?: 'finnexus' | 'heuristic'
  status?: 'SCORED' | 'REFUSED' | 'UNAVAILABLE' | string
  stage?: string
  reason?: string
  message?: string
  warning?: string
  primary_symbol?: string
  focus_role?: string
  focus_reason?: string
  predicted_label?: string
  probabilities?: Record<string, number>
  one_variable_baseline_label?: string
  decision?: string
  decision_reason?: string
  human_explanation?: string
  confidence_floor?: number
  kg_explanation?: KgExplanation[]
  article_type?: string
  article_type_caveat?: string
  label_meaning?: string
  scored_symbols?: ScoredSymbol[]
  refused_symbols?: { symbol: string; reason: string }[]
  buy_reachable?: boolean
  graph_view?: FinNexusGraphView
  reasons?: string[]
  composite_score?: number
  fallback?: PredictionExplanation
  fallback_trend?: string
}

export interface FinNexusGraphNode {
  id: string
  kind: 'stock' | 'peer'
  role: string
  label: string | null
  confidence: number | null
  decision: string | null
}

export interface FinNexusGraphView {
  nodes: FinNexusGraphNode[]
  edges: { source: string; target: string; kind: string }[]
}

export interface Prediction {
  stock_symbol: string
  trend: string
  confidence: number
  decision?: string
  sentiment?: string
  events?: string[]
  news_id?: number
  news_title?: string
  published_date?: string
  engine?: string
  is_primary?: boolean
}

/** Kết quả /api/prediction/stock/{symbol} — tổng hợp theo luật ở cấp mã.
 *  KHÔNG phải đầu ra của mô hình FinNexus: mô hình chấm theo cặp bài–mã. */
export interface StockPrediction {
  stock_symbol: string
  trend: string
  confidence: number
  decision?: string
  based_on_news_count: number
  is_investment_advice: boolean
  explanation: PredictionExplanation
}

export interface PredictionList {
  predictions: Prediction[]
  refused_count: number
  engine: string
  is_investment_advice: boolean
}

/** Nguồn sự thật duy nhất cho mọi con số hiệu năng hiển thị trên giao diện. */
export interface ModelInfo {
  available: boolean
  reason?: string
  active_model: string
  version?: string
  status?: string
  labels?: string[]
  label_meaning?: string
  frozen_threshold?: number
  feature_count?: number
  performance?: {
    out_of_fold_macro_f1: number
    baseline_macro_f1: number
    delta_vs_baseline: number
    baseline_description: string
    beats_majority_on_accuracy: boolean
  }
  operating_point?: {
    confidence_floor: number
    coverage_on_development: number
    expected_accuracy_at_this_coverage: number
    evidence_grade: string
    meaning: string
  }
  policy_gates?: Record<string, boolean>
  buy_reachable?: boolean
  is_investment_advice: boolean
  tradeable: boolean
  disclaimer?: string
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

/** Kết quả /api/prediction/evaluate — đo trên nhãn giá thật, kèm baseline.
 *  Không còn trường nào lấy nhãn cảm xúc gán tay làm ground truth. */
export interface ModelEvaluation {
  engine: string
  ground_truth: string
  labels: string[]
  insufficient_data: boolean
  sample_size: number
  required_samples?: number
  message?: string
  accuracy?: number
  precision?: number
  recall?: number
  f1_score?: number
  macro_f1?: number
  confusion_matrix?: number[][]
  class_report?: Record<string, Record<string, number>>
  baseline?: {
    name: string
    predicts: string
    accuracy: number
    macro_f1: number
  }
  delta_accuracy_vs_majority?: number
  beats_majority?: boolean
  label_distribution?: Record<string, number>
  caveat?: string
  is_investment_advice: boolean
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
  pass_pct: number
  checks: Record<string, boolean>
  failed_checks: string[]
  split_leakage_note: string
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
