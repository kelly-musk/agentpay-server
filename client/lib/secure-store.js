import keytar from "keytar";

const SERVICE_NAME = "agentpay";
const ACCOUNT_NAME = "default-wallet";

export async function saveStoredSecret(publicKey, secretKey) {
  const payload = JSON.stringify({
    publicKey,
    secretKey,
  });

  await keytar.setPassword(SERVICE_NAME, ACCOUNT_NAME, payload);
}

export async function getStoredSecret(expectedPublicKey) {
  const raw = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

  if (!raw) {
    return null;
  }

  const parsed = JSON.parse(raw);

  if (expectedPublicKey && parsed.publicKey !== expectedPublicKey) {
    return null;
  }

  return parsed.secretKey;
}

export async function deleteStoredSecret(expectedPublicKey) {
  const raw = await keytar.getPassword(SERVICE_NAME, ACCOUNT_NAME);

  if (!raw) {
    return false;
  }

  const parsed = JSON.parse(raw);

  if (expectedPublicKey && parsed.publicKey !== expectedPublicKey) {
    return false;
  }

  return keytar.deletePassword(SERVICE_NAME, ACCOUNT_NAME);
}
