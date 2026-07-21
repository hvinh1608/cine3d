let sessionEpoch = 0;

export function getSessionEpoch(): number {
  return sessionEpoch;
}

export function bumpSessionEpoch(): number {
  sessionEpoch += 1;
  return sessionEpoch;
}
