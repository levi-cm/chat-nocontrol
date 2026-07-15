export type RuntimeSupport =
  | { supported: true }
  | {
      supported: false;
      reason: "insecure-context" | "missing-webcrypto";
    };

export interface RuntimeEnvironment {
  readonly isSecureContext?: boolean;
  readonly crypto?: { readonly subtle?: SubtleCrypto };
}

export function checkRuntimeSupport(
  environment: RuntimeEnvironment = globalThis,
): RuntimeSupport {
  if (environment.isSecureContext !== true) {
    return { supported: false, reason: "insecure-context" };
  }
  if (!environment.crypto?.subtle) {
    return { supported: false, reason: "missing-webcrypto" };
  }
  return { supported: true };
}

export function runtimeSupportForBuild(
  production: boolean,
  detected: RuntimeSupport = checkRuntimeSupport(),
): RuntimeSupport {
  return production ? detected : { supported: true };
}
