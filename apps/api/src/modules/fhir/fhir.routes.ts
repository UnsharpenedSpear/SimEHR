import { Router } from 'express';
import { FhirController } from './fhir.controller.js';
import { authenticate } from '../../middleware/authn.middleware.js';

const router = Router();

router.use(authenticate);

// FHIR R4 standard read endpoints
router.get('/Patient', FhirController.searchPatients);
router.get('/Patient/:id', FhirController.getPatient);
router.get('/Encounter/:id', FhirController.getEncounter);
router.get('/Observation/:id', FhirController.getObservation);
router.get('/Condition/:id', FhirController.getCondition);
router.get('/AllergyIntolerance/:id', FhirController.getAllergyIntolerance);
router.get('/MedicationRequest/:id', FhirController.getMedicationRequest);
router.get('/Procedure/:id', FhirController.getProcedure);

export const fhirRoutes = router;
