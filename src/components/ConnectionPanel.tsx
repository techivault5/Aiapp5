'use client';

import { useState } from 'react';
import { useAppStore } from '@/lib/store';

export default function ConnectionPanel() {
  const {
    isConnected,
    isConnecting,
    connectionError,
    setConnectionConfig,
    setConnected,
    setConnecting,
    setConnectionError,
    setDatabases,
  } = useAppStore();

  const [account, setAccount] = useState('');
  const [username, setUsername] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [warehouse, setWarehouse] = useState('');
  const [database, setDatabase] = useState('');
  const [role, setRole] = useState('');
  const [showKeyGen, setShowKeyGen] = useState(false);
  const [keyGenResult, setKeyGenResult] = useState<{
    privateKeyPem: string;
    publicKeyPem: string;
    publicKeyFingerprint: string;
    snowflakeAlterStatement: string;
  } | null>(null);
  const [keyValidation, setKeyValidation] = useState<{ valid: boolean; error?: string } | null>(null);

  async function handleGenerateKeys() {
    if (!username) {
      setConnectionError('Enter a username first to generate keys');
      return;
    }
    try {
      const res = await fetch('/api/keygen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate', username }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeyGenResult(data);
      setPrivateKey(data.privateKeyPem);
      setConnectionError(null);
    } catch (err) {
      setConnectionError((err as Error).message);
    }
  }

  async function handleValidateKey() {
    if (!privateKey) return;
    try {
      const res = await fetch('/api/keygen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'validate', privateKey }),
      });
      const data = await res.json();
      setKeyValidation(data);
    } catch (err) {
      setKeyValidation({ valid: false, error: (err as Error).message });
    }
  }

  async function handleConnect() {
    if (!account || !username || !privateKey) {
      setConnectionError('Account, username, and private key are required');
      return;
    }

    setConnecting(true);
    setConnectionError(null);

    try {
      const config = { account, username, privateKey, warehouse, database, role };

      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setConnectionConfig(config);
      setConnected(true);

      // Fetch available databases
      const dbRes = await fetch('/api/schemas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, action: 'databases' }),
      });
      const dbData = await dbRes.json();
      if (dbRes.ok) {
        setDatabases(dbData.databases);
      }
    } catch (err) {
      setConnectionError((err as Error).message);
    } finally {
      setConnecting(false);
    }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setPrivateKey(event.target?.result as string);
      setKeyValidation(null);
    };
    reader.readAsText(file);
  }

  if (isConnected) {
    return (
      <div className="card">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          <span className="text-green-400 font-medium">Connected to Snowflake</span>
        </div>
        <p className="text-sm text-gray-400 mt-2">
          {username}@{account} {warehouse && `| ${warehouse}`}
        </p>
      </div>
    );
  }

  return (
    <div className="card space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Connect to Snowflake</h2>
        <p className="text-sm text-gray-400">Use RSA key-pair authentication to connect securely.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Account Identifier *</label>
          <input
            type="text"
            className="input-field"
            placeholder="xy12345.us-east-1"
            value={account}
            onChange={(e) => setAccount(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Username *</label>
          <input
            type="text"
            className="input-field"
            placeholder="MY_USER"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Warehouse</label>
          <input
            type="text"
            className="input-field"
            placeholder="COMPUTE_WH"
            value={warehouse}
            onChange={(e) => setWarehouse(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Database</label>
          <input
            type="text"
            className="input-field"
            placeholder="MY_DATABASE"
            value={database}
            onChange={(e) => setDatabase(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">Role</label>
          <input
            type="text"
            className="input-field"
            placeholder="SYSADMIN"
            value={role}
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
      </div>

      {/* Private Key Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-gray-300">Private Key (PEM) *</label>
          <div className="flex gap-2">
            <button
              type="button"
              className="text-xs text-snow-400 hover:text-snow-300 underline"
              onClick={() => setShowKeyGen(!showKeyGen)}
            >
              {showKeyGen ? 'Hide' : 'Generate New Key Pair'}
            </button>
            <label className="text-xs text-snow-400 hover:text-snow-300 underline cursor-pointer">
              Upload .pem
              <input type="file" accept=".pem,.key" className="hidden" onChange={handleFileUpload} />
            </label>
          </div>
        </div>

        <textarea
          className="input-field font-mono text-xs h-32 resize-y"
          placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
          value={privateKey}
          onChange={(e) => {
            setPrivateKey(e.target.value);
            setKeyValidation(null);
          }}
          onBlur={handleValidateKey}
        />

        {keyValidation && (
          <div className={`text-xs ${keyValidation.valid ? 'text-green-400' : 'text-red-400'}`}>
            {keyValidation.valid ? 'Key is valid' : keyValidation.error}
          </div>
        )}
      </div>

      {/* Key Generation Panel */}
      {showKeyGen && (
        <div className="bg-gray-800 rounded-lg p-4 space-y-3 border border-gray-700">
          <h3 className="text-sm font-medium text-gray-200">RSA Key Pair Generator</h3>
          <p className="text-xs text-gray-400">
            Generate a 2048-bit RSA key pair for Snowflake authentication.
            Run the ALTER USER statement in Snowflake to register the public key.
          </p>
          <button type="button" className="btn-primary text-sm" onClick={handleGenerateKeys}>
            Generate Key Pair
          </button>

          {keyGenResult && (
            <div className="space-y-3 mt-3">
              <div>
                <label className="text-xs font-medium text-gray-400">Fingerprint</label>
                <p className="text-xs font-mono text-gray-300 mt-1 break-all">
                  {keyGenResult.publicKeyFingerprint}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">
                  Run this in Snowflake to register the public key:
                </label>
                <pre className="text-xs font-mono bg-gray-900 text-snow-300 p-2 rounded mt-1 overflow-x-auto">
                  {keyGenResult.snowflakeAlterStatement}
                </pre>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-400">Public Key (save this)</label>
                <textarea
                  readOnly
                  className="input-field font-mono text-xs h-20 mt-1"
                  value={keyGenResult.publicKeyPem}
                />
              </div>
              <p className="text-xs text-yellow-400">
                Save your private key securely. It will not be stored on the server.
              </p>
            </div>
          )}
        </div>
      )}

      {connectionError && (
        <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-lg p-3">
          {connectionError}
        </div>
      )}

      <button
        type="button"
        className="btn-primary w-full"
        onClick={handleConnect}
        disabled={isConnecting || !account || !username || !privateKey}
      >
        {isConnecting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Connecting...
          </span>
        ) : (
          'Connect to Snowflake'
        )}
      </button>
    </div>
  );
}
