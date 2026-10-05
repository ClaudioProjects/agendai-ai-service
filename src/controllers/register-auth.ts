import type { RegisterAppAuthUseCase } from "../use-cases/register-app-auth";

export class RegisterAuthController {
  constructor(
    private readonly registerAppAuth: Pick<RegisterAppAuthUseCase, "execute">,
    private readonly testAuthToken?: string,
  ) {}

  async execute(token: string): Promise<{ registered: true }> {
    if (!this.testAuthToken || token !== this.testAuthToken)
      await this.registerAppAuth.execute(token);

    return { registered: true };
  }
}
