import { PartialType } from '@nestjs/mapped-types';
import { CreateOccurrenceReportDto } from './create-occurrence-report.dto';

export class UpdateOccurrenceReportDto extends PartialType(CreateOccurrenceReportDto) {}
