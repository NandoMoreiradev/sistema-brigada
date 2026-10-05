import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
    constructor(private readonly prisma: PrismaService) {}

    async create(dto: CreateRoomDto, organizationId: string) {
        try {
            return await this.prisma.room.create({ data: { ...dto, name: dto.name.trim(), organizationId } });
        } catch (error) {
            throw this.translateUniqueError(error, dto.name);
        }
    }

    /** Traz também as desativadas: a tela de salas precisa delas para reativar; os selects filtram. */
    findAll(organizationId: string) {
        return this.prisma.room.findMany({ where: { organizationId }, orderBy: { name: 'asc' } });
    }

    async findOne(id: string, organizationId: string) {
        const room = await this.prisma.room.findFirst({ where: { id, organizationId } });
        if (!room) {
            throw new NotFoundException(`Sala com ID ${id} não encontrada nesta organização.`);
        }
        return room;
    }

    async update(id: string, organizationId: string, dto: UpdateRoomDto) {
        await this.findOne(id, organizationId);
        try {
            return await this.prisma.room.update({ where: { id }, data: { ...dto, name: dto.name?.trim() } });
        } catch (error) {
            throw this.translateUniqueError(error, dto.name);
        }
    }

    /**
     * Garante que a sala escolhida para uma turma/aula é desta organização e está ativa. Sala
     * desativada só passa se já era a escolhida antes (`currentRoomId`): editar outra coisa numa
     * aula antiga não pode falhar por causa da sala dela.
     */
    async assertUsable(roomId: string | null | undefined, organizationId: string, currentRoomId?: string | null) {
        if (!roomId) return;
        const room = await this.prisma.room.findFirst({ where: { id: roomId, organizationId } });
        if (!room) {
            throw new BadRequestException('Sala informada não pertence a esta organização.');
        }
        if (!room.active && roomId !== currentRoomId) {
            throw new BadRequestException(`A sala "${room.name}" está desativada.`);
        }
    }

    private translateUniqueError(error: unknown, name?: string) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            return new ConflictException(`Já existe uma sala chamada "${name?.trim()}".`);
        }
        return error;
    }
}
