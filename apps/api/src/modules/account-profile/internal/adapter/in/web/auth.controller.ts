import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  loginSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  registerSchema,
  type LoginInput,
  type LogoutRequestInput,
  type MeResponse,
  type RefreshRequestInput,
  type RegisterInput,
  type TokenResponse,
} from '@skillswap/contracts';
import { REGISTER_ACCOUNT, type RegisterAccountPort } from '../../../application/port/in/register-account';
import { LOGIN, type LoginPort } from '../../../application/port/in/login';
import { REFRESH_SESSION, type RefreshSessionPort } from '../../../application/port/in/refresh-session';
import { LOGOUT, type LogoutPort } from '../../../application/port/in/logout';
import { GET_ME, type GetMePort } from '../../../application/port/in/get-me';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import { ZodValidationPipe } from '../../../../../../shared/http/zod-validation.pipe';

@Controller('auth')
@ApiTags('auth')
export class AuthController {
  constructor(
    @Inject(REGISTER_ACCOUNT) private readonly register: RegisterAccountPort,
    @Inject(LOGIN) private readonly login: LoginPort,
    @Inject(REFRESH_SESSION) private readonly refresh: RefreshSessionPort,
    @Inject(LOGOUT) private readonly logout: LogoutPort,
    @Inject(GET_ME) private readonly getMe: GetMePort,
  ) {}

  @Post('register')
  @ApiOperation({ summary: 'Create a local account (FR-001)' })
  @ApiOkResponse({ description: 'First access and refresh tokens' })
  registerAccount(
    @Body(new ZodValidationPipe(registerSchema)) body: RegisterInput,
  ): Promise<TokenResponse> {
    return this.register.execute(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password (FR-001)' })
  @ApiOkResponse({ description: 'Access and refresh tokens' })
  signIn(@Body(new ZodValidationPipe(loginSchema)) body: LoginInput): Promise<TokenResponse> {
    return this.login.execute(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new session (FR-001)' })
  @ApiOkResponse({ description: 'Fresh access and refresh tokens' })
  rotate(@Body(new ZodValidationPipe(refreshRequestSchema)) body: RefreshRequestInput): Promise<TokenResponse> {
    return this.refresh.execute(body);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh session (FR-001)' })
  async signOut(@Body(new ZodValidationPipe(logoutRequestSchema)) body: LogoutRequestInput): Promise<void> {
    await this.logout.execute(body);
  }

  @Get('me')
  @ApiOperation({ summary: 'Read the signed-in account and verification status (FR-001/FR-017)' })
  @ApiOkResponse({ description: 'The current account with its projected student verification status' })
  me(@Req() request: RequestWithIdentity): Promise<MeResponse> {
    return this.getMe.execute(currentUserId(request));
  }
}
