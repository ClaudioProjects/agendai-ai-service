export type VerifiedAppIdentity = {
  appId: string | null;
  expiresAt: Date | null;
};
export interface AppAttestationVerifier {
  verify(token: string): Promise<VerifiedAppIdentity>;
}
