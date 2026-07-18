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
  | 'listening'
  | 'activated'
  | 'capturing'
  | 'ocr'
  | 'searching'
  | 'results';

export interface CaptureData {
  imageDataUrl: string;
  ocrText: string;
  confirmedText: string;
}
