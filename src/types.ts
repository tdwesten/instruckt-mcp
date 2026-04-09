export interface Annotation {
  id: string;
  url: string;
  x: number;
  y: number;
  element: string;
  element_path: string;
  css_classes: string | null;
  bounding_box: Record<string, number> | null;
  selected_text: string | null;
  nearby_text: string | null;
  comment: string;
  screenshot: string | null;
  intent: string;
  severity: string;
  framework: { component: string } | null;
  resolved: boolean;
  created_at: string;
}

export interface CreateAnnotationInput {
  url: string;
  x: number;
  y: number;
  element: string;
  element_path: string;
  css_classes?: string | null;
  bounding_box?: Record<string, number> | null;
  selected_text?: string | null;
  nearby_text?: string | null;
  comment: string;
  screenshot?: string | null;
  intent?: string;
  severity?: string;
  framework?: { component: string } | null;
}

export interface UpdateAnnotationInput {
  comment?: string;
  screenshot?: string | null;
  resolved?: boolean;
  severity?: string;
}
