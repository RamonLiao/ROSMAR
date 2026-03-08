import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty' }
            : undefined,
        redact: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.body.encryptedData',
          'req.body.privateKey',
          'req.body.secret',
          'req.body.password',
          'req.body.seedPhrase',
          'req.body.mnemonic',
        ],
      },
    }),
  ],
})
export class LoggingModule {}
