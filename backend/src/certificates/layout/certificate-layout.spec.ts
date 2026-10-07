import { renderCertificateText, joinNames, dateInFull, formatWorkload } from './certificate-layout-variables';
import { parseCertificateLayout, LayoutValidationError } from './certificate-layout.validation';
import { buildClassicLayout } from './classic-layout';
import { buildCertificateVariables, buildRenderInput, CertificateRenderSource } from './certificate-render-input';
import { CertificatePdfService } from '../certificate-pdf.service';
import { getLayoutPresets } from './layout-presets';

describe('renderCertificateText', () => {
    const vars = { 'aluno.nome': 'Ana', 'curso.local': '', 'curso.cargaHoraria': '20 horas' };

    it('substitui variáveis e apaga as desconhecidas', () => {
        expect(renderCertificateText('Olá {{aluno.nome}}{{nao.existe}}!', vars)).toBe('Olá Ana!');
        expect(renderCertificateText('{{ aluno.nome }}', vars)).toBe('Ana');
    });

    it('condicional com e sem else', () => {
        expect(renderCertificateText('x{{#if curso.local}}, em {{curso.local}}{{/if}}.', vars)).toBe('x.');
        expect(renderCertificateText('{{#if curso.cargaHoraria}}{{curso.cargaHoraria}}{{else}}—{{/if}}', vars)).toBe('20 horas');
        expect(renderCertificateText('{{#if curso.local}}a{{else}}b{{/if}}', vars)).toBe('b');
    });
});

describe('formatadores', () => {
    it('junta nomes em português', () => {
        expect(joinNames([])).toBe('');
        expect(joinNames(['A'])).toBe('A');
        expect(joinNames(['A', 'B'])).toBe('A e B');
        expect(joinNames(['A', 'B', 'C'])).toBe('A, B e C');
    });

    it('data por extenso e carga horária', () => {
        expect(dateInFull('05/03/2026')).toBe('5 de março de 2026');
        expect(formatWorkload(1)).toBe('1 hora');
        expect(formatWorkload(20)).toBe('20 horas');
        expect(formatWorkload(null)).toBe('');
    });
});

describe('modelos prontos', () => {
    it.each(getLayoutPresets().map((preset) => [preset.name, preset] as const))('%s passa na validação e gera PDF de 1 página', async (_, preset) => {
        expect(() => parseCertificateLayout(JSON.parse(JSON.stringify(preset.layout)))).not.toThrow();
        const pdf = await new CertificatePdfService().generate(buildRenderInput(source, preset.layout, {}, 'https://app.exemplo.com'));
        expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBe(1);
    });
});

describe('parseCertificateLayout', () => {
    it('o Clássico passa na validação sem mudar', () => {
        const classic = buildClassicLayout();
        const parsed = parseCertificateLayout(JSON.parse(JSON.stringify(classic)));
        expect(parsed.elements).toHaveLength(classic.elements.length);
        expect(parsed.elements.map((e) => e.type)).toEqual(classic.elements.map((e) => e.type));
        expect(parsed.theme).toEqual(classic.theme);
    });

    it('recusa cor, tipo, URL e tamanho inválidos, com mensagem em português', () => {
        const layout = buildClassicLayout() as any;
        layout.theme.primary = 'azul';
        layout.background.imageUrl = 'javascript:alert(1)';
        layout.elements.push({ id: 'x', type: 'video', x: 0, y: 0, w: 1, h: 1 });
        layout.elements.push({ id: 'y', type: 'text', x: 0, y: 0, w: 10, h: 10, content: 'a', size: 9999, color: '#000000' });
        try {
            parseCertificateLayout(layout);
            fail('deveria ter recusado');
        } catch (error) {
            expect(error).toBeInstanceOf(LayoutValidationError);
            const problems = (error as LayoutValidationError).problems.join('\n');
            expect(problems).toMatch(/cor "primary"/);
            expect(problems).toMatch(/imageUrl/);
            expect(problems).toMatch(/tipo desconhecido/);
            expect(problems).toMatch(/size/);
        }
    });

    it('descarta propriedades desconhecidas e corrige ids repetidos', () => {
        const layout = buildClassicLayout() as any;
        layout.hacked = true;
        layout.elements[0].onclick = 'x';
        layout.elements[1].id = layout.elements[0].id;
        const parsed = parseCertificateLayout(layout) as any;
        expect(parsed.hacked).toBeUndefined();
        expect(parsed.elements[0].onclick).toBeUndefined();
        expect(parsed.elements[0].id).not.toBe(parsed.elements[1].id);
    });
});

const source: CertificateRenderSource = {
    studentName: 'Maria da Silva Santos',
    organizationName: 'JB Treinamentos',
    course: {
        title: 'Brigadistas 11/10',
        certificateTitle: 'Formação de Brigada de Incêndio',
        category: 'Brigada',
        workloadHours: 20,
        location: null,
        startDate: new Date('2026-10-06T12:00:00Z'),
        endDate: new Date('2026-10-10T12:00:00Z'),
        syllabus: null,
        instructorNames: ['Carlos', 'Ana'],
    },
    issuedAt: new Date('2026-10-10T15:00:00Z'),
    expiresAt: null,
    code: 'AB3K9X2MQ7TD',
};

describe('buildCertificateVariables', () => {
    it('usa o nome no certificado e cai no título da turma quando vazio', () => {
        const vars = buildCertificateVariables(source, 'app/validar');
        expect(vars['curso.nome']).toBe('Formação de Brigada de Incêndio');
        expect(vars['turma.nome']).toBe('Brigadistas 11/10');
        expect(vars['curso.periodo']).toBe('de 06/10/2026 a 10/10/2026');
        expect(vars['curso.instrutores']).toBe('Carlos e Ana');
        expect(vars['certificado.codigo']).toBe('AB3K-9X2M-Q7TD');
        expect(vars['certificado.validade']).toBe('');
        expect(buildCertificateVariables({ ...source, course: { ...source.course, certificateTitle: '  ' } }, '')['curso.nome']).toBe('Brigadistas 11/10');
    });
});

describe('CertificatePdfService', () => {
    const service = new CertificatePdfService();
    const pageCount = (pdf: Buffer) => (pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length;

    it('gera o Clássico em 1 página sem conteúdo programático', async () => {
        const pdf = await service.generate(buildRenderInput(source, buildClassicLayout(), {}, 'https://app.exemplo.com'));
        expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
        expect(pageCount(pdf)).toBe(1);
    });

    it('conteúdo programático longo flui por várias páginas e termina', async () => {
        const syllabus = Array.from({ length: 150 }, (_, i) => `Tópico ${i + 1} — descrição do conteúdo abordado`).join('\n');
        const pdf = await service.generate(
            buildRenderInput({ ...source, course: { ...source.course, syllabus } }, buildClassicLayout(), {}, 'https://app.exemplo.com'),
        );
        const pages = pageCount(pdf);
        expect(pages).toBeGreaterThanOrEqual(4);
        expect(pages).toBeLessThan(10);
    });

    it('texto enorme num elemento pequeno não cria página nova', async () => {
        const layout = buildClassicLayout();
        layout.elements.push({
            id: 'huge', type: 'text', x: 700, y: 560, w: 100, h: 20, content: 'texto '.repeat(500),
            font: 'Times', size: 30, bold: true, italic: true, color: '$accent', align: 'justify', valign: 'bottom', autoShrink: false,
        });
        const pdf = await service.generate(buildRenderInput(source, layout, {}, 'https://app.exemplo.com'));
        expect(pageCount(pdf)).toBe(1);
    });
});
