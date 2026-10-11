import { BadRequestException, ConflictException } from '@nestjs/common';
import { CertificatesService } from './certificates.service';

const ORG = 'org-1';

function build() {
    const prisma = {
        certificate: { findFirst: jest.fn(), update: jest.fn() },
    };
    const mediaService = { deleteObject: jest.fn(), publicUrl: undefined };
    const service = new CertificatesService(
        prisma as never,
        mediaService as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
        {} as never,
    );
    return { service, prisma, mediaService };
}

describe('CertificatesService — emissão manual', () => {
    describe('issueIfEligible', () => {
        it('não emite quando a turma desligou a emissão automática', async () => {
            const { service } = build();
            jest.spyOn(service, 'checkEligibility').mockResolvedValue({
                eligible: true,
                enrollment: { course: { autoIssueCertificates: false } },
            } as never);
            const issue = jest.spyOn(service as never, 'issue');

            await expect(service.issueIfEligible('enr-1')).resolves.toBeNull();
            expect(issue).not.toHaveBeenCalled();
        });

        it('emite automaticamente quando a flag está ligada', async () => {
            const { service } = build();
            jest.spyOn(service, 'checkEligibility').mockResolvedValue({
                eligible: true,
                enrollment: { course: { autoIssueCertificates: true } },
            } as never);
            const issue = jest.spyOn(service as never, 'issue').mockResolvedValue({ id: 'cert-1' } as never);

            await expect(service.issueIfEligible('enr-1')).resolves.toEqual({ id: 'cert-1' });
            expect(issue).toHaveBeenCalledWith('enr-1', true);
        });
    });

    describe('uploadPdf', () => {
        it('rejeita chave de outra academia', async () => {
            const { service, prisma } = build();
            prisma.certificate.findFirst.mockResolvedValue({ id: 'c1', pdfKey: null, studentNotifiedAt: null });

            await expect(service.uploadPdf('c1', ORG, 'certificates/outra-org/a.pdf')).rejects.toBeInstanceOf(BadRequestException);
            expect(prisma.certificate.update).not.toHaveBeenCalled();
        });

        it('rejeita arquivo que não é PDF', async () => {
            const { service, prisma } = build();
            prisma.certificate.findFirst.mockResolvedValue({ id: 'c1', pdfKey: null, studentNotifiedAt: null });

            await expect(service.uploadPdf('c1', ORG, `certificates/${ORG}/a.png`)).rejects.toBeInstanceOf(BadRequestException);
        });

        it('grava o PDF, apaga o anterior e avisa o aluno se ainda não foi avisado', async () => {
            const { service, prisma, mediaService } = build();
            prisma.certificate.findFirst.mockResolvedValue({ id: 'c1', pdfKey: 'certificates/velho.pdf', studentNotifiedAt: null, status: 'VALID' });
            const notify = jest.spyOn(service, 'notifyStudent').mockResolvedValue({ id: 'c1' } as never);

            await service.uploadPdf('c1', ORG, `certificates/${ORG}/novo.pdf`);

            expect(prisma.certificate.update).toHaveBeenCalledWith({
                where: { id: 'c1' },
                data: { pdfKey: `certificates/${ORG}/novo.pdf`, pdfUploadedManually: true },
            });
            expect(mediaService.deleteObject).toHaveBeenCalledWith('certificates/velho.pdf');
            expect(notify).toHaveBeenCalledWith('c1', ORG);
        });

        it('não reavisa o aluno que já foi avisado', async () => {
            const { service, prisma } = build();
            prisma.certificate.findFirst
                .mockResolvedValueOnce({ id: 'c1', pdfKey: null, studentNotifiedAt: new Date(), status: 'VALID' })
                .mockResolvedValue({ id: 'c1', status: 'VALID', expiresAt: null, enrollment: {} });
            const notify = jest.spyOn(service, 'notifyStudent');

            await service.uploadPdf('c1', ORG, `certificates/${ORG}/novo.pdf`);

            expect(notify).not.toHaveBeenCalled();
        });
    });

    describe('regeneratePdf', () => {
        it('não sobrescreve o PDF enviado pela academia', async () => {
            const { service, prisma } = build();
            prisma.certificate.findFirst.mockResolvedValue({ id: 'c1', pdfUploadedManually: true });

            await expect(service.regeneratePdf('c1', ORG)).rejects.toBeInstanceOf(ConflictException);
        });
    });
});
