// backend/src/staff/staff.service.ts
//
// Brigadista/bombeiro é um papel adicional sobre o `User` (decisão 8 do
// docs/decisoes.md), promovido manualmente pelo admin (decisão 9) — pode ser
// aluno formado da própria escola ou profissional externo (decisão 6),
// mas mesmo o externo ainda precisa de um `User` (criado via `users/`) antes
// de virar `StaffMember`. Certificação/qualificação prévia (decisão 10)
// mora em `users/` desde a decisão 32 — é um fato sobre a pessoa, não sobre
// este papel — por isso só aparece aqui de leitura, via `user.externalCertifications`.
//
// Categoria (decisão 78): rótulo opcional do membro dentro da equipe, tirado de um
// catálogo por academia (`StaffCategory`). Só classifica — nenhuma regra de escala depende dela.

import { Injectable, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { Prisma, StaffStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const staffInclude = {
    user: { select: { id: true, name: true, email: true, phone: true, externalCertifications: true } },
    category: { select: { id: true, name: true } },
    _count: { select: { designations: true } },
} as const;

const categoryInclude = { _count: { select: { members: true } } } as const;

export interface BulkPromoteResult {
    /** Viraram membros agora (inclui quem estava desativado e foi reativado). */
    promoted: number;
    /** Já eram membros ativos: ignorados, sem erro. */
    skipped: number;
}

@Injectable()
export class StaffService {
    constructor(private readonly prisma: PrismaService) {}

    async promote(userId: string, organizationId: string, approvedByUserId: string, categoryId?: string) {
        const user = await this.prisma.user.findFirst({ where: { id: userId, organizationId } });
        if (!user) {
            throw new NotFoundException('Usuário informado não pertence a esta organização.');
        }
        if (categoryId) await this.requireCategory(categoryId, organizationId);

        const existing = await this.prisma.staffMember.findUnique({ where: { userId } });
        if (existing) {
            if (existing.status === StaffStatus.ACTIVE) {
                throw new ConflictException('Este usuário já faz parte da equipe de atuação.');
            }
            // Promover de novo quem foi desativado é uma reativação (o registro é único por usuário).
            await this.prisma.staffMember.update({
                where: { id: existing.id },
                data: { status: StaffStatus.ACTIVE, approvedByUserId, approvedAt: new Date(), ...(categoryId ? { categoryId } : {}) },
            });
            return this.findOne(existing.id, organizationId);
        }

        const staffMember = await this.prisma.staffMember.create({
            data: { userId, organizationId, approvedByUserId, categoryId },
        });

        return this.findOne(staffMember.id, organizationId);
    }

    /**
     * Promove várias pessoas de uma vez (ex.: uma turma inteira). Tudo ou nada: se algum id não
     * pertence à academia, nada é promovido. Quem já é membro ativo é ignorado, sem erro.
     */
    async promoteMany(userIds: string[], organizationId: string, approvedByUserId: string, categoryId?: string): Promise<BulkPromoteResult> {
        const uniqueIds = [...new Set(userIds)];
        if (categoryId) await this.requireCategory(categoryId, organizationId);

        const users = await this.prisma.user.findMany({ where: { id: { in: uniqueIds }, organizationId }, select: { id: true } });
        if (users.length !== uniqueIds.length) {
            throw new NotFoundException('Uma ou mais pessoas informadas não pertencem a esta organização.');
        }

        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.staffMember.findMany({ where: { userId: { in: uniqueIds } } });
            const byUserId = new Map(existing.map((member) => [member.userId, member]));
            let promoted = 0;
            let skipped = 0;

            for (const userId of uniqueIds) {
                const member = byUserId.get(userId);
                if (!member) {
                    await tx.staffMember.create({ data: { userId, organizationId, approvedByUserId, categoryId } });
                    promoted += 1;
                } else if (member.status === StaffStatus.ACTIVE) {
                    skipped += 1;
                } else {
                    await tx.staffMember.update({
                        where: { id: member.id },
                        data: { status: StaffStatus.ACTIVE, approvedByUserId, approvedAt: new Date(), ...(categoryId ? { categoryId } : {}) },
                    });
                    promoted += 1;
                }
            }
            return { promoted, skipped };
        });
    }

    findAll(organizationId: string) {
        return this.prisma.staffMember.findMany({
            where: { organizationId },
            include: staffInclude,
            orderBy: { approvedAt: 'desc' },
        });
    }

    async findOne(id: string, organizationId: string) {
        const staffMember = await this.prisma.staffMember.findFirst({
            where: { id, organizationId },
            include: staffInclude,
        });
        if (!staffMember) {
            throw new NotFoundException(`Membro de equipe com ID ${id} não encontrado nesta organização.`);
        }
        return staffMember;
    }

    async updateStatus(id: string, organizationId: string, status: 'ACTIVE' | 'INACTIVE') {
        await this.findOne(id, organizationId);
        await this.prisma.staffMember.update({ where: { id }, data: { status } });
        return this.findOne(id, organizationId);
    }

    /** Define (ou, com `null`, limpa) a categoria de um membro. */
    async setCategory(id: string, organizationId: string, categoryId: string | null) {
        await this.findOne(id, organizationId);
        if (categoryId) await this.requireCategory(categoryId, organizationId);
        await this.prisma.staffMember.update({ where: { id }, data: { categoryId } });
        return this.findOne(id, organizationId);
    }

    /* ----------------------------------------- catálogo de categorias ----------------------------------------- */

    listCategories(organizationId: string) {
        return this.prisma.staffCategory.findMany({ where: { organizationId }, orderBy: { name: 'asc' }, include: categoryInclude });
    }

    async createCategory(organizationId: string, name: string) {
        const trimmed = this.cleanName(name);
        await this.assertNameAvailable(organizationId, trimmed);
        return this.saveCategory(() => this.prisma.staffCategory.create({ data: { organizationId, name: trimmed }, include: categoryInclude }));
    }

    async updateCategory(id: string, organizationId: string, name: string) {
        await this.requireCategory(id, organizationId);
        const trimmed = this.cleanName(name);
        await this.assertNameAvailable(organizationId, trimmed, id);
        return this.saveCategory(() => this.prisma.staffCategory.update({ where: { id }, data: { name: trimmed }, include: categoryInclude }));
    }

    /** Só exclui categoria sem ninguém: sumir com a categoria de quem já está classificado seria perda silenciosa. */
    async removeCategory(id: string, organizationId: string) {
        await this.requireCategory(id, organizationId);
        const members = await this.prisma.staffMember.count({ where: { categoryId: id } });
        if (members > 0) {
            throw new ConflictException(`Esta categoria tem ${members} pessoa(s). Mude a categoria delas antes de excluir.`);
        }
        await this.prisma.staffCategory.delete({ where: { id } });
        return { id };
    }

    private async requireCategory(id: string, organizationId: string) {
        const category = await this.prisma.staffCategory.findFirst({ where: { id, organizationId } });
        if (!category) {
            throw new NotFoundException('Categoria não encontrada nesta organização.');
        }
        return category;
    }

    /** O validador do DTO aceita "   " (não é string vazia): o `trim` é que revela o nome em branco. */
    private cleanName(name: string): string {
        const trimmed = name.trim();
        if (!trimmed) {
            throw new BadRequestException('Informe o nome da categoria.');
        }
        return trimmed;
    }

    /** Nome único por academia, sem diferenciar maiúsculas ("brigadista" = "Brigadista"). */
    private async assertNameAvailable(organizationId: string, name: string, exceptId?: string) {
        const clash = await this.prisma.staffCategory.findFirst({
            where: { organizationId, name: { equals: name, mode: 'insensitive' }, ...(exceptId ? { id: { not: exceptId } } : {}) },
            select: { id: true },
        });
        if (clash) {
            throw new ConflictException('Já existe uma categoria com esse nome.');
        }
    }

    /** Corrida entre duas requisições: o índice único pega o que a checagem acima não viu. */
    private async saveCategory<T>(run: () => Promise<T>): Promise<T> {
        try {
            return await run();
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                throw new ConflictException('Já existe uma categoria com esse nome.');
            }
            throw error;
        }
    }
}
