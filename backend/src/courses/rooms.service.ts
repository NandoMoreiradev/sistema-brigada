import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { UpdateRoomDto } from './dto/update-room.dto';

@Injectable()
export class RoomsService {
    constructor(private readonly prisma: PrismaService) {}

    create(dto: CreateRoomDto, organizationId: string) {
        return this.prisma.room.create({ data: { ...dto, organizationId } });
    }

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
        return this.prisma.room.update({ where: { id }, data: dto });
    }
}
