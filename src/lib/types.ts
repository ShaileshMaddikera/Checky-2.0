export interface Product {
  title: string;
  url: string;
  asin?: string;
  price?: number;
  currency?: string;
  rating?: number;
  reviews_count?: number;
  brand?: string;
  main_image?: string;
  description?: string;
  availability?: string;
  seller_name?: string;
  source?: 'amazon' | 'walmart' | 'target' | 'ebay' | string; // which retailer
}

export interface SearchResult {
  query: string;
  products: Product[];
  timestamp: number;
  source?: 'moss' | 'brightdata' | 'mock';
  pending?: boolean; // true when Bright Data is still fetching; mock shown in the meantime
}

export type AppState =
  | 'idle'
  | 'listening'   // agent connected, watching camera
  | 'activated'   // user said "Hey Checky"
  | 'capturing'   // product identified, show result overlay
  | 'ocr'         // legacy — kept for type compat
  | 'searching'   // agent is calling check_price()
  | 'speaking'    // agent is speaking back to user (TTS)
  | 'results';    // product results overlay is visible

export interface CaptureData {
  imageDataUrl: string;
  ocrText: string;
  confirmedText: string;
}

// ── LiveKit Data Channel Payloads ─────────────────────────────────────────────

export interface AgentPayloadReady {
  action: 'agent_ready';
}

export interface AgentPayloadSearching {
  action: 'searching';
  query: string;
}

export interface AgentPayloadShowProduct {
  action: 'show_product';
  data: {
    query: string;
    products: Product[];
    source: 'moss' | 'brightdata' | 'mock';
    pending: boolean;
  };
}

export type AgentPayload =
  | AgentPayloadReady
  | AgentPayloadSearching
  | AgentPayloadShowProduct;
