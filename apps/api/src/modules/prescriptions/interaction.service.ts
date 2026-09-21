import mongoose from 'mongoose';
import { AllergyModel } from '../allergies/allergy.model.js';
import { PrescriptionModel } from './prescription.model.js';
import { COMMON_DRUG_INTERACTIONS } from '@ehr/shared';

export interface InteractionWarning {
  type: 'DRUG_DRUG' | 'DRUG_ALLERGY';
  severity: 'MAJOR' | 'MODERATE' | 'MINOR';
  description: string;
}

export class InteractionService {
  /**
   * Evaluate drug-allergy conflicts and drug-drug interactions for a candidate prescription
   */
  static async evaluateInteractions(patientId: string, candidateDrugName: string): Promise<InteractionWarning[]> {
    const warnings: InteractionWarning[] = [];
    const patientObjId = new mongoose.Types.ObjectId(patientId);
    const candidateNorm = candidateDrugName.trim().toLowerCase();

    // 1. Drug-Allergy Conflict Check
    const allergies = await AllergyModel.find({ patientId: patientObjId, status: 'ACTIVE' }).lean();

    for (const allergy of allergies) {
      const substanceNorm = allergy.substance.trim().toLowerCase();

      // Direct substance match or class cross-reactivity (e.g. Penicillin & Amoxicillin/Ampicillin)
      let isAllergic = false;
      if (candidateNorm.includes(substanceNorm) || substanceNorm.includes(candidateNorm)) {
        isAllergic = true;
      } else if (
        substanceNorm.includes('penicillin') &&
        (candidateNorm.includes('cillin') || candidateNorm.includes('amoxicillin') || candidateNorm.includes('ampicillin'))
      ) {
        isAllergic = true;
      } else if (
        substanceNorm.includes('sulfa') &&
        (candidateNorm.includes('sulf') || candidateNorm.includes('bactrim'))
      ) {
        isAllergic = true;
      } else if (
        substanceNorm.includes('aspirin') &&
        (candidateNorm.includes('nsaid') || candidateNorm.includes('ibuprofen') || candidateNorm.includes('naproxen'))
      ) {
        isAllergic = true;
      }

      if (isAllergic) {
        warnings.push({
          type: 'DRUG_ALLERGY',
          severity: allergy.severity === 'LIFE_THREATENING' || allergy.severity === 'SEVERE' ? 'MAJOR' : 'MODERATE',
          description: `ALLERGY CONFLICT: Patient has documented allergy to ${allergy.substance} (${allergy.severity}). Reactions: ${allergy.reactions.join(', ')}.`,
        });
      }
    }

    // 2. Drug-Drug Interactions Check against active medications
    const activePrescriptions = await PrescriptionModel.find({
      patientId: patientObjId,
      status: { $in: ['ACTIVE', 'VERIFIED', 'DISPENSED'] },
    }).lean();

    for (const activeRx of activePrescriptions) {
      const activeDrugNorm = activeRx.drug.name.trim().toLowerCase();

      for (const rule of COMMON_DRUG_INTERACTIONS) {
        const drugANorm = rule.drugA.toLowerCase();
        const drugBNorm = rule.drugB.toLowerCase();

        const matchA = candidateNorm.includes(drugANorm) && activeDrugNorm.includes(drugBNorm);
        const matchB = candidateNorm.includes(drugBNorm) && activeDrugNorm.includes(drugANorm);

        if (matchA || matchB) {
          warnings.push({
            type: 'DRUG_DRUG',
            severity: rule.severity,
            description: `DRUG INTERACTION between ${activeRx.drug.name} and ${candidateDrugName}: ${rule.description}`,
          });
        }
      }
    }

    return warnings;
  }
}
