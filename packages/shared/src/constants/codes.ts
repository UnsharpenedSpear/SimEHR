export const CODE_SYSTEMS = {
  ICD10: 'http://hl7.org/fhir/sid/icd-10',
  SNOMED_CT: 'http://snomed.info/sct',
  LOINC: 'http://loinc.org',
  RXNORM: 'http://www.nlm.nih.gov/research/umls/rxnorm',
  CVX: 'http://hl7.org/fhir/sid/cvx',
  CPT: 'http://www.ama-assn.org/go/cpt',
} as const;

export interface CodedConcept {
  system: string;
  code: string;
  display: string;
}

export interface ReferenceRange {
  low?: number;
  high?: number;
  unit: string;
  criticalLow?: number;
  criticalHigh?: number;
}

export const LAB_REFERENCE_RANGES: Record<string, ReferenceRange> = {
  '718-7': { low: 13.8, high: 17.2, criticalLow: 7.0, criticalHigh: 20.0, unit: 'g/dL' }, // Hemoglobin (Male adult)
  '6690-2': { low: 4.5, high: 11.0, criticalLow: 2.0, criticalHigh: 30.0, unit: '10*3/uL' }, // WBC
  '777-3': { low: 150, high: 450, criticalLow: 20, criticalHigh: 1000, unit: '10*3/uL' }, // Platelets
  '2345-7': { low: 70, high: 99, criticalLow: 45, criticalHigh: 400, unit: 'mg/dL' }, // Glucose Fasting
  '2823-3': { low: 136, high: 145, criticalLow: 120, criticalHigh: 160, unit: 'mmol/L' }, // Sodium
  '2885-2': { low: 3.5, high: 5.0, criticalLow: 2.8, criticalHigh: 6.2, unit: 'mmol/L' }, // Potassium
  '2160-0': { low: 0.7, high: 1.3, criticalHigh: 3.5, unit: 'mg/dL' }, // Creatinine
};

export const COMMON_DRUG_INTERACTIONS: Array<{
  drugA: string; // RxNorm or Drug Name
  drugB: string;
  severity: 'MAJOR' | 'MODERATE' | 'MINOR';
  description: string;
}> = [
  {
    drugA: 'Warfarin',
    drugB: 'Aspirin',
    severity: 'MAJOR',
    description: 'Concurrent use increases risk of severe gastrointestinal bleeding.',
  },
  {
    drugA: 'Warfarin',
    drugB: 'Ibuprofen',
    severity: 'MAJOR',
    description: 'NSAIDs increase anticoagulant effect of Warfarin and risk of severe bleeding.',
  },
  {
    drugA: 'Lisinopril',
    drugB: 'Spironolactone',
    severity: 'MAJOR',
    description: 'Risk of severe hyperkalemia. Monitor serum potassium closely.',
  },
  {
    drugA: 'Metformin',
    drugB: 'Iodinated Contrast',
    severity: 'MAJOR',
    description: 'Risk of contrast-induced nephropathy leading to lactic acidosis.',
  },
  {
    drugA: 'Simvastatin',
    drugB: 'Amiodarone',
    severity: 'MAJOR',
    description: 'Increased risk of rhabdomyolysis and myopathy.',
  },
];
