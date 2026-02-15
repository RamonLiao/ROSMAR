import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UserPayload } from '../auth.service';

export const CurrentUser = createParamDecorator(
  (data: keyof UserPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    return data ? user?.[data] : user;
  },
);
