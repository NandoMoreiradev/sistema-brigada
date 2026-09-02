import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertCertificateTemplateDto } from './dto/upsert-certificate-template.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CertificateTemplatesService {
    constructor(private readonly prisma: PrismaService) {}

    findOne(organizationId: string) {
        return this.prisma.certificateTemplate.findUnique({ where: { organizationId } });
    }

    upsert(organizationId: string, dto: UpsertCertificateTemplateDto) {
        return this.prisma.certificateTemplate.upsert({
            where: { organizationId },
            create: { organizationId, ...dto, layoutConfig: dto.layoutConfig as Prisma.InputJsonValue | undefined },
            update: { ...dto, layoutConfig: dto.layoutConfig as Prisma.InputJsonValue | undefined },
        });
    }
}
