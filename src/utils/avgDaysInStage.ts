import { differenceInCalendarDays } from 'date-fns';
import type { MortgageCase, PipelineStage } from '../types/mortgage';

export interface AvgDaysByStage {
  lead: number | null;
  recommendation: number | null;
  application: number | null;
  offer: number | null;
}

function average(values: number[]): number | null {
  if (!values.length) {
    return null;
  }
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function daysBetween(start: Date | null, end: Date | null): number | null {
  if (!start || !end) {
    return null;
  }
  const diff = differenceInCalendarDays(end, start);
  return diff >= 0 ? diff : null;
}

export function calcAvgDaysInStage(rows: MortgageCase[]): AvgDaysByStage {
  const leadDays: number[] = [];
  const recommendationDays: number[] = [];
  const applicationDays: number[] = [];
  const offerDays: number[] = [];

  for (const row of rows) {
    const createdToRecommendation = daysBetween(row.createdAt, row.recommendationDate ?? null);
    const recommendationToSubmitted = daysBetween(row.recommendationDate ?? null, row.firstSubmittedDate);
    const createdToSubmitted = daysBetween(row.createdAt, row.firstSubmittedDate);
    const submittedToOffer = daysBetween(row.firstSubmittedDate, row.firstOfferDate);
    const offerToComplete = daysBetween(row.firstOfferDate, row.completionDate);

    if (createdToRecommendation !== null) {
      leadDays.push(createdToRecommendation);
    }

    if (recommendationToSubmitted !== null) {
      recommendationDays.push(recommendationToSubmitted);
    } else if (createdToSubmitted !== null) {
      // Backwards compatible fallback for datasets without recommendation date.
      recommendationDays.push(createdToSubmitted);
    }

    if (submittedToOffer !== null) {
      applicationDays.push(submittedToOffer);
    }
    if (offerToComplete !== null) {
      offerDays.push(offerToComplete);
    }
  }

  return {
    lead: average(leadDays),
    recommendation: average(recommendationDays),
    application: average(applicationDays),
    offer: average(offerDays),
  };
}

export function avgDaysForStatus(status: PipelineStage, avgDays: AvgDaysByStage): number | null {
  if (status === 'LEAD') {
    return avgDays.lead;
  }
  if (status === 'RECOMMENDATION') {
    return avgDays.recommendation;
  }
  if (status === 'APPLICATION') {
    return avgDays.application;
  }
  if (status === 'OFFER') {
    return avgDays.offer;
  }
  return null;
}

