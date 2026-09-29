let signedIn = false;

export function setSignedIn(value: boolean): void {
  signedIn = value;
}

export function isSignedIn(): boolean {
  return signedIn;
}

let remoteDepth = 0;

export function applyRemote(fn: () => void): void {
  remoteDepth += 1;
  try {
    fn();
  } finally {
    remoteDepth -= 1;
  }
}

export function isRemoteApply(): boolean {
  return remoteDepth > 0;
}
