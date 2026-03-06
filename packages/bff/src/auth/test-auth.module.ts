import { Module } from '@nestjs/common';
import { TestAuthController } from './test-auth.controller';
import { AuthModule } from './auth.module';

@Module({
  imports: [AuthModule],
  controllers: [TestAuthController],
})
export class TestAuthModule {}
