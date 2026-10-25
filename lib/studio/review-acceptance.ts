import type {QualityReport} from './quality-types';

/** A provider failure with no completed review is not an inspected draft. */
export function canApplyReviewDraft(report?:QualityReport,motionSupported=false):boolean{
  if(!report?.rounds.some(round=>!round.rejected&&!['not-requested','local-geometry'].includes(round.model)))return false;
  return !(motionSupported||report.motionMechanismId)||report.status==='reviewed';
}
