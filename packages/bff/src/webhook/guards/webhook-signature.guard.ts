import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhookSignatureGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const signature = req.headers['x-webhook-signature'];
    const secret = this.configService.getOrThrow<string>('WEBHOOK_SECRET');

    if (!signature || typeof signature !== 'string') {
      throw new UnauthorizedException('Missing webhook signature');
    }

    const [algo, hash] = signature.split('=');
    if (algo !== 'sha256' || !hash) {
      throw new UnauthorizedException('Invalid signature format');
    }

    const body = JSON.stringify(req.body);
    const expected = createHmac('sha256', secret).update(body).digest('hex');

    if (hash.length !== expected.length) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    if (!timingSafeEqual(Buffer.from(hash), Buffer.from(expected))) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    return true;
  }
}
