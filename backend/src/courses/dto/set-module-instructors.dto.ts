import { IsArray, IsString } from 'class-validator';

export class SetModuleInstructorsDto {
    /** Professores responsáveis pelo módulo (todos precisam ser instrutores da turma). Lista vazia libera o módulo para qualquer instrutor. */
    @IsArray()
    @IsString({ each: true })
    userIds: string[];
}
