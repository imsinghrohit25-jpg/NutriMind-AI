// Biomarker platform — canonical types for lab results, CGM, and the biomarker registry.

export type BiomarkerPanel =
  | 'diabetes'
  | 'lipid'
  | 'thyroid'
  | 'kidney'
  | 'cbc'
  | 'vitamins'
  | 'liver'
  | 'inflammation';

export interface BiomarkerType {
  id:          string;
  displayName: string;
  unit:        string;
  normalMin?:  number;
  normalMax?:  number;
  panel?:      BiomarkerPanel;
  description?: string;
}

export type LabResultFlag = 'high' | 'low' | 'critical_high' | 'critical_low' | 'abnormal';
export type LabResultSource = 'lab_upload' | 'manual' | 'dexcom' | 'health_connect';

export interface LabResult {
  id?:           string;
  userId:        string;
  labReportId?:  string;
  biomarkerType: string;
  value:         number;
  unit:          string;
  measuredAt:    Date;
  source:        LabResultSource;
  flags?:        LabResultFlag[];
  notes?:        string;
}

export interface LabReport {
  id?:         string;
  userId:      string;
  reportDate:  string;   // YYYY-MM-DD
  labName?:    string;
  filePath?:   string;
  ocrRaw?:     string;
  parseStatus: 'pending' | 'processing' | 'done' | 'failed';
  parseError?: string;
}

export type GlucoseTrend =
  | 'rising_quickly'
  | 'rising'
  | 'stable'
  | 'falling'
  | 'falling_quickly'
  | 'unknown';

export interface GlucoseReading {
  id?:            string;
  userId:         string;
  valueMgdl:      number;
  trendArrow?:    GlucoseTrend;
  readingTime:    Date;
  sourcePlatform: 'dexcom' | 'libre' | 'manual';
  externalId:     string;
  transmitterId?: string;
}

export interface BiomarkerFlag {
  biomarkerType: string;
  displayName:   string;
  value:         number;
  unit:          string;
  normalMin?:    number;
  normalMax?:    number;
  flag:          LabResultFlag;
  severity:      'info' | 'warning' | 'critical';
}
