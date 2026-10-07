// backend/src/certificates/certificate-code.ts
//
// Código de verificação do certificado (impresso no PDF, conferido em /validar/:code).
// Base32 Crockford: sem I, L, O e U, então não há letra que se confunda com número ao
// digitar o código lido do papel. 12 caracteres = 60 bits aleatórios — inviável de
// adivinhar, o que importa porque a página de validação é pública e mostra o nome do aluno.

import { randomInt } from 'crypto';

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const CODE_LENGTH = 12;

export function generateCertificateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += ALPHABET[randomInt(ALPHABET.length)];
    }
    return code;
}

/** Aceita o que a pessoa digitou (minúsculas, hífens, espaços, O no lugar de 0...) e devolve a forma guardada no banco. */
export function normalizeCertificateCode(input: string): string {
    return input
        .toUpperCase()
        .replace(/[\s-]/g, '')
        .replace(/O/g, '0')
        .replace(/[IL]/g, '1');
}

/** XXXX-XXXX-XXXX, para exibir e imprimir. */
export function formatCertificateCode(code: string): string {
    return code.match(/.{1,4}/g)?.join('-') ?? code;
}
