import { apiFetch } from '../../../shared/api/http';
import { mapLabelSummaryDto, type LabelSummaryDto } from './labelDashboardDtos';
export { EMPTY_LABEL_SUMMARY, mapLabelSummaryDto, type LabelSummaryDto } from './labelDashboardDtos';

export async function fetchLabelDashboardSummary(): Promise<LabelSummaryDto> {
  const payload = await apiFetch('/labels/dashboard/summary');
  return mapLabelSummaryDto(payload);
}
