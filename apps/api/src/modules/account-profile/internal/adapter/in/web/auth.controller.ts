import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type {
  LoginInput,
  LogoutRequestInput,
  MeResponse,
  RefreshRequestInput,
  RegisterInput,
  TokenResponse,
} from '@skillswap/contracts';
import { REGISTER_ACCOUNT, type RegisterAccountPort } from '../../../application/port/in/register-account';
import { LOGIN, type LoginPort } from '../../../application/port/in/login';
import { REFRESH_SESSION, type RefreshSessionPort } from '../../../application/port/in/refresh-session';
import { LOGOUT, type LogoutPort } from '../../../application/port/in/logout';
import { GET_ME, type GetMePort } from '../../../application/port/in/get-me';
import { currentUserId, type RequestWithIdentity } from '../../../../../../shared/http/identity';
import {
  ResponseCode,
  ResponseMessage,
} from '../../../../../../shared/http/response-code.decorator';
import {
  LoginDto,
  LogoutRequestDto,
  MeResponseDto,
  RefreshRequestDto,
  RegisterDto,
  TokenResponseDto,
} from './dto/auth.dto';

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
  @ApiOkResponse({ type: TokenResponseDto, description: 'First access and refresh tokens' })
  registerAccount(@Body() body: RegisterDto): Promise<TokenResponse> {
    return this.register.execute(body as RegisterInput);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Sign in with email and password (FR-001)' })
  @ApiOkResponse({ type: TokenResponseDto, description: 'Access and refresh tokens' })
  signIn(@Body() body: LoginDto): Promise<TokenResponse> {
    return this.login.execute(body as LoginInput);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Rotate a refresh token for a new session (FR-001)' })
  @ApiOkResponse({ type: TokenResponseDto, description: 'Fresh access and refresh tokens' })
  rotate(@Body() body: RefreshRequestDto): Promise<TokenResponse> {
    return this.refresh.execute(body as RefreshRequestInput);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Revoke a refresh session (FR-001)' })
  async signOut(@Body() body: LogoutRequestDto): Promise<void> {
    await this.logout.execute(body as LogoutRequestInput);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ResponseCode('ME_OK')
  @ResponseMessage('Account loaded')
  @ApiOperation({ summary: 'Read the signed-in account and verification status (FR-001/FR-017)' })
  @ApiOkResponse({
    type: MeResponseDto,
    description: 'The current account with its projected student verification status',
  })
  me(@Req() request: RequestWithIdentity): Promise<MeResponse> {
    return this.getMe.execute(currentUserId(request));
  }
}
