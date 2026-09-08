import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAppCheck } from "firebase-admin/app-check";
import type {
  AppAttestationVerifier,
  VerifiedAppIdentity,
} from "../../contracts/auth";
import { ApiError } from "../../libs/errors";

export class FirebaseAppCheckVerifier implements AppAttestationVerifier {
  private readonly appCheck;
  constructor(input: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
  }) {
    const app =
      getApps()[0] ??
      initializeApp({
        credential: cert({
          projectId: input.projectId,
          clientEmail: input.clientEmail,
          privateKey: input.privateKey.replace(/\\n/g, "\n"),
        }),
      });
    this.appCheck = getAppCheck(app);
  }
  async verify(token: string): Promise<VerifiedAppIdentity> {
    try {
      const response = await this.appCheck.verifyToken(token);
      return {
        appId: response.appId,
        expiresAt: response.token.exp
          ? new Date(response.token.exp * 1000)
          : null,
      };
    } catch {
      throw new ApiError(
        "APP_CHECK_TOKEN_INVALID",
        401,
        "Firebase App Check token is invalid or expired.",
      );
    }
  }
}
