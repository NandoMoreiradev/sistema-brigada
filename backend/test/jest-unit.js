// Testes unitários (`npm test`): ts-jest sobre src/**/*.spec.ts, sem banco — os serviços
// recebem um PrismaService falso.
module.exports = {
    rootDir: '..',
    roots: ['<rootDir>/src'],
    testRegex: '.*\\.spec\\.ts$',
    moduleFileExtensions: ['js', 'json', 'ts'],
    transform: { '^.+\\.ts$': ['ts-jest', { diagnostics: { ignoreCodes: [151001] } }] },
    testEnvironment: 'node',
};
