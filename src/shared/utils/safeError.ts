export function safeErrorMessage(err: any): string {
  if (typeof err === 'string') {
    return err;
  }
  if (err?.message) {
    return err.message;
  }
  if (err?.error) {
    return err.error;
  }
  return 'Something went wrong';
}

export function safeStatus(err: any): number | null {
  const status = err?.status;
  return typeof status === 'number' ? status : null;
}
