// backend/src/communications/providers/email-sender.factory.ts
//
// Adaptado de maskotCrmEdu/backend/src/communications/providers/email-sender.factory.ts
// (schoolId -> organizationId), sem a distinção `useSchoolAccount` do original — lá ela
// existe para não quebrar o envio quando a escola tem conta Resend própria mas nenhum
// domínio verificado NELA (ver DomainsService, fora de escopo aqui: a academia entra
// com a chave da própria conta Resend já pronta, configurada por fora deste app). Aqui a
// regra é direta: tem `resendApiKey`? usa a conta da academia. Senão, usa a da plataforma.

import { Injectable, Logger } from '@nestjs/common';
import { Resend } from 'resend';
import { PrismaService } from '../../prisma/prisma.service';
import { IMailSender } from './imail-sender.interface';
import { ResendSender } from './resend-sender';

export interface ResolvedSender {
    sender: IMailSender;
    /** true = conta Resend própria da academia | false = conta compartilhada da plataforma */
    isOrganizationOwned: boolean;
}

@Injectable()
export class EmailSenderFactory {
    private readonly logger = new Logger(EmailSenderFactory.name);

    constructor(private readonly prisma: PrismaService) {}

    /**
     * @param organizationId `null` força a conta global da plataforma (usado pelos
     *   gatilhos "da plataforma para a academia" — ver TransactionalEmailService.PLATFORM_TRIGGERS).
     */
    async forOrganization(organizationId: string | null): Promise<ResolvedSender> {
        if (organizationId) {
            const organization = await this.prisma.organization.findUnique({
                where: { id: organizationId },
                select: { resendApiKey: true },
            });

            if (organization?.resendApiKey) {
                this.logger.debug(`[EmailSenderFactory] Academia ${organizationId} → conta Resend própria`);
                return {
                    sender: new ResendSender(new Resend(organization.resendApiKey)),
                    isOrganizationOwned: true,
                };
            }
        }

        this.logger.debug(`[EmailSenderFactory] Academia ${organizationId ?? '(nenhuma)'} → conta Resend da plataforma`);
        return {
            sender: new ResendSender(new Resend(process.env.RESEND_API_KEY)),
            isOrganizationOwned: false,
        };
    }
}
