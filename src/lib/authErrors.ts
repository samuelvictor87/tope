export const LOGIN_TIMEOUT_ERROR = 'LOGIN_TIMEOUT';

type AuthErrorLike = {
  name?: string;
  status?: number;
  code?: string;
  message?: string;
};

function asAuthError(error: unknown): AuthErrorLike {
  return error as AuthErrorLike;
}

export function isNetworkAuthError(error: unknown): boolean {
  if (error instanceof Error) {
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      error.message === LOGIN_TIMEOUT_ERROR
    ) {
      return true;
    }
  }

  const authError = asAuthError(error);
  return (
    authError?.name === 'AuthRetryableFetchError' ||
    authError?.code === 'request_timeout' ||
    authError?.status === 408 ||
    authError?.status === 502 ||
    authError?.status === 503 ||
    authError?.status === 504 ||
    authError?.status === 0
  );
}

export function isInvalidCredentialsError(error: unknown): boolean {
  const authError = asAuthError(error);
  return (
    authError?.status === 400 ||
    authError?.status === 401 ||
    authError?.code === 'invalid_credentials'
  );
}

export function getLoginErrorMessage(error: unknown): { title: string; message: string } {
  if (isNetworkAuthError(error)) {
    return {
      title: 'Tempo esgotado',
      message: 'O servidor demorou para responder. Tente novamente.',
    };
  }

  if (isInvalidCredentialsError(error)) {
    return {
      title: 'Erro de autenticação',
      message: 'E-mail ou senha incorretos.',
    };
  }

  return {
    title: 'Erro de autenticação',
    message: 'Ocorreu um erro ao tentar fazer login.',
  };
}
