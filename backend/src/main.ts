// backend/src/main.ts

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
    const logger = new Logger('Bootstrap');

    const app = await NestFactory.create(AppModule);

    // Prefixo global da API
    app.setGlobalPrefix('api/v1');

    app.use(cookieParser());

    const allowedOrigins = process.env.FRONTEND_URL?.split(',').map((o) => o.trim());
    logger.log(`CORS origin permitida: ${allowedOrigins?.join(', ') ?? '(qualquer uma — FRONTEND_URL ausente)'}`);

    app.enableCors({
        origin: allowedOrigins ?? true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true,
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Active-Organization-Id',
            'x-active-organization-id',
            'Accept',
            'Origin',
        ],
        exposedHeaders: ['Authorization', 'X-Active-Organization-Id'],
        maxAge: 86400,
    });

    // Documentação Swagger — só fora de produção, a menos que explicitamente habilitada.
    if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
        const config = new DocumentBuilder()
            .setTitle('Brigada API')
            .setDescription('API da plataforma de treinamento de brigada de incêndio')
            .setVersion('1.0')
            .addBearerAuth()
            .build();

        const document = SwaggerModule.createDocument(app, config);
        SwaggerModule.setup('docs', app, document);
        logger.log('Swagger docs disponível em /docs');
    }

    // Pipes globais de validação de DTOs
    app.useGlobalPipes(
        new ValidationPipe({
            whitelist: true,
            transform: true,
            forbidNonWhitelisted: true,
        }),
    );

    app.enableShutdownHooks();

    const port = process.env.PORT || 3000;
    await app.listen(port, '0.0.0.0');

    logger.log(`Backend rodando na porta: ${port}`);
    logger.log(`URL Base: ${await app.getUrl()}/api/v1`);
}

bootstrap();
