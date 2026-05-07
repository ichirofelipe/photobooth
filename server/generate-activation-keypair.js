import crypto from 'crypto';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'der' },
});

console.log('VITE_ACTIVATION_PUBLIC_KEY_BASE64=' + publicKey.toString('base64'));
console.log('ACTIVATION_PRIVATE_KEY_BASE64=' + privateKey.toString('base64'));
