// Copilot guardrails — pure function, no LLM, no side effects.
// Checks user query for prohibited topics BEFORE sending to LLM.
// If triggered: returns a refusal message and redirects to appropriate resources.
// Gate requirement: medication question → refusal + redirect.

export interface GuardrailResult {
  blocked:        boolean;
  category?:      GuardrailCategory;
  refusalMessage?: string;
  redirectNote?:  string;
}

export type GuardrailCategory =
  | 'medication'
  | 'diagnosis'
  | 'treatment'
  | 'emergency'
  | 'supplement_dose'
  | 'weight_loss_extreme';

// Keywords that signal a prohibited query type
const MEDICATION_SIGNALS = [
  'metformin', 'insulin', 'statins', 'lisinopril', 'amlodipine', 'atorvastatin',
  'glipizide', 'sitagliptin', 'ramipril', 'telmisartan', 'losartan',
  'drug interaction', 'medicine', 'medication', 'prescription', 'tablet mg',
  'dose', 'dosage', 'overdose', 'side effect of drug',
];

const DIAGNOSIS_SIGNALS = [
  'do i have diabetes', 'do i have hypertension', 'am i diabetic',
  'diagnose me', 'what disease', 'am i sick', 'is this cancer',
  'do i have heart disease', 'should i get tested',
];

const TREATMENT_SIGNALS = [
  'cure my', 'treat my', 'reverse my diabetes', 'heal my', 'fix my disease',
  'how to cure', 'treatment for my', 'how do i treat',
];

const EMERGENCY_SIGNALS = [
  'chest pain', 'heart attack', 'stroke', 'can\'t breathe', 'emergency',
  'call ambulance', 'allergic reaction', 'anaphylaxis',
];

const SUPPLEMENT_SIGNALS = [
  'how much supplement', 'supplement dose', 'vitamin dose', 'mineral dose',
  'iron tablets', 'calcium dose', 'zinc supplement mg',
];

export function checkGuardrails(query: string): GuardrailResult {
  const q = query.toLowerCase();

  if (EMERGENCY_SIGNALS.some((s) => q.includes(s))) {
    return {
      blocked: true,
      category: 'emergency',
      refusalMessage:
        'This sounds like a medical emergency. Please call 112 (India emergency services) or go to the nearest hospital immediately.',
      redirectNote: 'Emergency: 112 | Poison Control: 1800-11-6117',
    };
  }

  if (MEDICATION_SIGNALS.some((s) => q.includes(s))) {
    return {
      blocked: true,
      category: 'medication',
      refusalMessage:
        'I can provide general nutrition information, but I\'m not able to give advice about specific medications, drug interactions, or medication dosages. ' +
        'Please consult your doctor or pharmacist for medication-related questions.',
      redirectNote: 'Consult a registered medical practitioner or pharmacist.',
    };
  }

  if (DIAGNOSIS_SIGNALS.some((s) => q.includes(s))) {
    return {
      blocked: true,
      category: 'diagnosis',
      refusalMessage:
        'I\'m not able to diagnose medical conditions. Only a qualified doctor can diagnose a health condition after a proper examination. ' +
        'I can help you understand nutrition labels and healthy eating patterns.',
      redirectNote: 'Consult a registered medical practitioner for diagnosis.',
    };
  }

  if (TREATMENT_SIGNALS.some((s) => q.includes(s))) {
    return {
      blocked: true,
      category: 'treatment',
      refusalMessage:
        'I\'m not able to provide medical treatment advice. While healthy eating can support wellbeing, it cannot replace medical treatment. ' +
        'Please work with your healthcare team for treatment decisions.',
      redirectNote: 'Consult a registered dietitian and medical practitioner.',
    };
  }

  if (SUPPLEMENT_SIGNALS.some((s) => q.includes(s))) {
    return {
      blocked: true,
      category: 'supplement_dose',
      refusalMessage:
        'Supplement dosage recommendations require personalised medical assessment. ' +
        'I can provide general information about nutrients from food, but not supplement doses.',
      redirectNote: 'Consult a registered dietitian for supplement advice.',
    };
  }

  return { blocked: false };
}
