import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { WalletStrategy } from './strategies/wallet.strategy';
import { ZkLoginStrategy } from './strategies/zklogin.strategy';
import { SessionGuard } from './guards/session.guard';
import { RbacGuard } from './guards/rbac.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'wallet' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): any => ({
        secret: configService.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '15m'),
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    WalletStrategy,
    ZkLoginStrategy,
    SessionGuard,
    RbacGuard,
  ],
  exports: [AuthService, SessionGuard, RbacGuard],
})
export class AuthModule {}
