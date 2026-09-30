# HL7 FHIR R4 Interoperability Specification

The **Simulated EHR** platform includes a native, read-only **HL7 Fast Healthcare Interoperability Resources (FHIR) Release 4 (R4)** facade. This API enables seamless interoperability with third-party healthcare applications, health information exchanges (HIEs), patient portals, and analytics engines.

* **FHIR Version:** HL7 FHIR R4 (v4.0.1)
* **Base URL:** `http://localhost:5000/fhir/r4`
* **Supported MIME Types:** `application/fhir+json`, `application/json`

---

## 1. Supported FHIR R4 Resources

| FHIR R4 Resource | HTTP Method | Endpoint | Supported Search Parameters | Internal EHR Domain |
| :--- | :---: | :--- | :--- | :--- |
| **`Patient`** | `GET` | `/fhir/r4/Patient` | `_id`, `identifier`, `name`, `gender`, `birthdate` | Patient Master Index |
| **`Encounter`** | `GET` | `/fhir/r4/Encounter` | `_id`, `patient`, `status`, `class`, `date` | Encounters & Visits |
| **`Observation`** | `GET` | `/fhir/r4/Observation` | `_id`, `patient`, `category` (`vital-signs` \| `laboratory`), `code`, `date` | Vitals & Lab Results |
| **`Condition`** | `GET` | `/fhir/r4/Condition` | `_id`, `patient`, `clinical-status`, `category`, `code` | Problem List (ICD-10) |
| **`MedicationRequest`** | `GET` | `/fhir/r4/MedicationRequest` | `_id`, `patient`, `status`, `intent` | RxNorm Prescriptions |

---

## 2. FHIR Bundle Search Response Format

All search queries return an HL7 FHIR standard `Bundle` resource of type `searchset`:

```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "link": [
    {
      "relation": "self",
      "url": "http://localhost:5000/fhir/r4/Patient?_id=6740a1b2c3d4e5f6a7b8c9d0"
    }
  ],
  "entry": [
    {
      "fullUrl": "http://localhost:5000/fhir/r4/Patient/6740a1b2c3d4e5f6a7b8c9d0",
      "resource": {
        "resourceType": "Patient",
        "id": "6740a1b2c3d4e5f6a7b8c9d0",
        "identifier": [
          {
            "system": "urn:oid:2.16.840.1.113883.4.1",
            "value": "MRN-MAIN-202609-00042"
          }
        ],
        "active": true,
        "name": [
          {
            "use": "official",
            "family": "Doe",
            "given": ["John"]
          }
        ],
        "gender": "male",
        "birthDate": "1980-05-14"
      }
    }
  ]
}
```

---

## 3. Resource Mapping Details

### 3.1 `Patient` Resource Mapping
Maps encrypted internal demographics (decrypted on the fly for authorized FHIR clients) to standard FHIR patient schemas.

```json
{
  "resourceType": "Patient",
  "id": "6740a1b2c3d4e5f6a7b8c9d0",
  "identifier": [
    {
      "type": {
        "coding": [
          {
            "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
            "code": "MR",
            "display": "Medical Record Number"
          }
        ]
      },
      "system": "https://ehr.example.com/mrn",
      "value": "MRN-MAIN-202609-00042"
    }
  ],
  "active": true,
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John"]
    }
  ],
  "telecom": [
    { "system": "phone", "value": "+1-555-0199", "use": "mobile" },
    { "system": "email", "value": "john.doe@example.com", "use": "home" }
  ],
  "gender": "male",
  "birthDate": "1980-05-14",
  "address": [
    {
      "use": "home",
      "line": ["123 Medical Way"],
      "city": "Boston",
      "state": "MA",
      "postalCode": "02115",
      "country": "USA"
    }
  ]
}
```

---

### 3.2 `Observation` Resource Mapping (Vital Signs & Labs)
Maps vitals records and lab findings to standard **LOINC** and **SNOMED-CT** codeable concepts.

```json
{
  "resourceType": "Observation",
  "id": "6742c3d4e5f6a7b8c9d0e1f2",
  "status": "final",
  "category": [
    {
      "coding": [
        {
          "system": "http://terminology.hl7.org/CodeSystem/observation-category",
          "code": "vital-signs",
          "display": "Vital Signs"
        }
      ]
    }
  ],
  "code": {
    "coding": [
      {
        "system": "http://loinc.org",
        "code": "85354-9",
        "display": "Blood pressure panel with all children optional"
      }
    ]
  },
  "subject": {
    "reference": "Patient/6740a1b2c3d4e5f6a7b8c9d0"
  },
  "effectiveDateTime": "2026-09-30T09:41:00.000Z",
  "component": [
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8480-6",
            "display": "Systolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 142,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    },
    {
      "code": {
        "coding": [
          {
            "system": "http://loinc.org",
            "code": "8462-4",
            "display": "Diastolic blood pressure"
          }
        ]
      },
      "valueQuantity": {
        "value": 88,
        "unit": "mmHg",
        "system": "http://unitsofmeasure.org",
        "code": "mm[Hg]"
      }
    }
  ]
}
```

---

### 3.3 `Condition` Resource Mapping (ICD-10 Problems)
Maps patient active problems to **ICD-10-CM** coding systems.

```json
{
  "resourceType": "Condition",
  "id": "6743d4e5f6a7b8c9d0e1f2a3",
  "clinicalStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-clinical",
        "code": "active"
      }
    ]
  },
  "verificationStatus": {
    "coding": [
      {
        "system": "http://terminology.hl7.org/CodeSystem/condition-ver-status",
        "code": "confirmed"
      }
    ]
  },
  "code": {
    "coding": [
      {
        "system": "http://hl7.org/fhir/sid/icd-10-cm",
        "code": "I10",
        "display": "Essential (primary) hypertension"
      }
    ],
    "text": "Essential hypertension"
  },
  "subject": {
    "reference": "Patient/6740a1b2c3d4e5f6a7b8c9d0"
  },
  "recordedDate": "2026-09-30T09:40:00.000Z"
}
```

---

### 3.4 `MedicationRequest` Resource Mapping (RxNorm Prescriptions)
Maps electronic prescriptions to **RxNorm** semantic clinical drugs.

```json
{
  "resourceType": "MedicationRequest",
  "id": "6744e5f6a7b8c9d0e1f2a3b4",
  "status": "active",
  "intent": "order",
  "medicationCodeableConcept": {
    "coding": [
      {
        "system": "http://www.nlm.nih.gov/research/umls/rxnorm",
        "code": "314076",
        "display": "Lisinopril 10 MG Oral Tablet"
      }
    ],
    "text": "Lisinopril 10mg"
  },
  "subject": {
    "reference": "Patient/6740a1b2c3d4e5f6a7b8c9d0"
  },
  "authoredOn": "2026-09-30T09:42:00.000Z",
  "dosageInstruction": [
    {
      "text": "Take 1 tablet by mouth daily",
      "timing": {
        "code": {
          "text": "ONCE_DAILY"
        }
      },
      "route": {
        "coding": [
          {
            "system": "http://snomed.info/sct",
            "code": "260548002",
            "display": "Oral"
          }
        ]
      },
      "doseAndRate": [
        {
          "doseQuantity": {
            "value": 10,
            "unit": "mg",
            "system": "http://unitsofmeasure.org",
            "code": "mg"
          }
        }
      ]
    }
  ]
}
```
