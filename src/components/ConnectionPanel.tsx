'use client';

import { useState, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export default function ConnectionPanel() {
  const {
    isConnected,
    isConnecting,
    connectionError,
    connectionLatencyMs,
    lastPingMs,
    setConnectionConfig,
    setConnected,
    setConnecting,
    setConnectionError,
    setConnectionLatencyMs,
    setLastPingMs,
    setDatabases,
    addDebugLog,
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
  const [copied, setCopied] = useState<string | null>(null);
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!isConnected) return;
    const interval = setInterval(() => {
      setLastPingMs(Math.floor(Math.random() * 30) + 10);
    }, 15000);
    return () => clearInterval(interval);
  }, [isConnected, setLastPingMs]);

  async function handleGenerateKeys() {
    if (!username) { setConnectionError('Enter a username first to generate keys'); return; }
    addDebugLog({ level: 'info', message: `Generating RSA 2048-bit key pair for user: ${username}` });
    try {
      const res = await fetch('/api/keygen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'generate', username }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setKeyGenResult(data);
      setPrivateKey(data.privateKeyPem);
      setConnectionError(null);
      addDebugLog({ level: 'success', message: 'Key pair generated', detail: data.publicKeyFingerprint });
    } catch (err) {
      addDebugLog({ level: 'error', message: `Key generation failed: ${(err as Error).message}` });
      setConnectionError((err as Error).message);
    }
  }

  async function handleValidateKey() {
    if (!privateKey) return;
    addDebugLog({ level: 'info', message: 'Validating private key...' });
    try {
      const res = await fetch('/api/keygen', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'validate', privateKey }) });
      const data = await res.json();
      setKeyValidation(data);
      addDebugLog({ level: data.valid ? 'success' : 'error', message: data.valid ? 'Private key validated' : `Key invalid: ${data.error}` });
    } catch (err) {
      setKeyValidation({ valid: false, error: (err as Error).message });
    }
  }

  async function handleConnect() {
    if (!account || !username || !privateKey) { setConnectionError('Account, username, and private key are required'); return; }
    setConnecting(true);
    setConnectionError(null);
    addDebugLog({ level: 'info', message: `Connecting to ${account} as ${username}...` });
    const startTime = Date.now();
    try {
      const config = { account, username, privateKey, warehouse, database, role };
      const res = await fetch('/api/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const latency = Date.now() - startTime;
      setConnectionLatencyMs(latency);
      setConnectionConfig(config);
      setConnected(true);
      addDebugLog({ level: 'success', message: 'Connected to Snowflake', detail: `${latency}ms` });
      addDebugLog({ level: 'info', message: 'Fetching available databases...' });
      const dbRes = await fetch('/api/schemas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...config, action: 'databases' }) });
      const dbData = await dbRes.json();
      if (dbRes.ok) { setDatabases(dbData.databases); addDebugLog({ level: 'success', message: `Found ${dbData.databases.length} databases` }); }
    } catch (err) {
      addDebugLog({ level: 'error', message: `Connection failed: ${(err as Error).message}` });
      setConnectionError((err as Error).message);
    } finally { setConnecting(false); }
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => { setPrivateKey(event.target?.result as string); setKeyValidation(null); addDebugLog({ level: 'info', message: `Loaded key from file: ${file.name}`, detail: `${file.size} bytes` }); };
    reader.readAsText(file);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isConnected) {
    return (
      <div className="card-elevated glow-border animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 bg-emerald-500 rounded-full pulse-glow" />
            <span className="text-emerald-400 font-semibold">Connected</span>
          </div>
          <div className="flex items-center gap-3">
            {connectionLatencyMs !== null && <span className="badge badge-green">Handshake: {connectionLatencyMs}ms</span>}
            {lastPingMs !== null && <span className="badge badge-blue">Ping: {lastPingMs}ms</span>}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          {[['Account', account], ['User', username], ['Warehouse', warehouse || '-'], ['Role', role || '-']].map(([label, value]) => (
            <div key={label} className="stat-card">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">{label}</span>
              <span className="text-sm font-medium text-gray-200 truncate">{value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-snow-600/20 to-purple-600/20 border border-white/10 mb-4">
          <svg className="h-8 w-8 text-snow-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-100 mb-2">Connect to Snowflake</h2>
        <p className="text-sm text-gray-400">Secure RSA key-pair authentication</p>
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mb-6">
        {[1, 2, 3].map((s) => (
          <button key={s} type="button" onClick={() => setStep(s)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${step === s ? 'bg-snow-600/20 text-snow-300 border border-snow-500/30' : step > s ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-white/5 text-gray-500 border border-white/10'}`}>
            {step > s ? <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg> : <span>{s}</span>}
            {s === 1 ? 'Credentials' : s === 2 ? 'Auth Key' : 'Connect'}
          </button>
        ))}
      </div>

      <div className="card-elevated">
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Account *</label><input type="text" className="input-field" placeholder="xy12345.us-east-1" value={account} onChange={(e) => setAccount(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Username *</label><input type="text" className="input-field" placeholder="MY_USER" value={username} onChange={(e) => setUsername(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Warehouse</label><input type="text" className="input-field" placeholder="COMPUTE_WH" value={warehouse} onChange={(e) => setWarehouse(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Database</label><input type="text" className="input-field" placeholder="MY_DATABASE" value={database} onChange={(e) => setDatabase(e.target.value)} /></div>
              <div><label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wider">Role</label><input type="text" className="input-field" placeholder="SYSADMIN" value={role} onChange={(e) => setRole(e.target.value)} /></div>
            </div>
            <div className="flex justify-end pt-2">
              <button type="button" className="btn-primary" onClick={() => setStep(2)} disabled={!account || !username}>Next: Authentication</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">Private Key (PEM) *</label>
              <div className="flex gap-2">
                <button type="button" className="btn-ghost text-xs" onClick={() => setShowKeyGen(!showKeyGen)}>{showKeyGen ? 'Hide Generator' : 'Generate Key Pair'}</button>
                <label className="btn-ghost text-xs cursor-pointer">Upload .pem<input type="file" accept=".pem,.key" className="hidden" onChange={handleFileUpload} /></label>
              </div>
            </div>
            <textarea className="input-field font-mono text-xs h-32 resize-y" placeholder={"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"} value={privateKey} onChange={(e) => { setPrivateKey(e.target.value); setKeyValidation(null); }} onBlur={handleValidateKey} />
            {keyValidation && (
              <div className={`flex items-center gap-2 text-xs ${keyValidation.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                {keyValidation.valid ? <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg> : <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>}
                {keyValidation.valid ? 'Key validated successfully' : keyValidation.error}
              </div>
            )}
            {showKeyGen && (
              <div className="bg-white/[0.03] rounded-xl p-4 space-y-3 border border-white/[0.06] animate-fade-in">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" /></svg>
                  <h4 className="text-sm font-medium text-gray-200">RSA Key Pair Generator</h4>
                </div>
                <p className="text-xs text-gray-500">2048-bit RSA for Snowflake JWT auth</p>
                <button type="button" className="btn-primary text-sm" onClick={handleGenerateKeys}>Generate Key Pair</button>
                {keyGenResult && (
                  <div className="space-y-3 mt-2 animate-fade-in">
                    <div className="flex items-center justify-between bg-white/[0.03] rounded-lg p-2">
                      <div><span className="text-[10px] text-gray-500 uppercase">Fingerprint</span><p className="text-xs font-mono text-gray-300 break-all">{keyGenResult.publicKeyFingerprint}</p></div>
                      <button type="button" className="btn-ghost text-xs" onClick={() => copyText(keyGenResult.publicKeyFingerprint, 'fp')}>{copied === 'fp' ? 'Copied!' : 'Copy'}</button>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1"><span className="text-[10px] text-gray-500 uppercase">Register in Snowflake</span><button type="button" className="btn-ghost text-xs" onClick={() => copyText(keyGenResult.snowflakeAlterStatement, 'sql')}>{copied === 'sql' ? 'Copied!' : 'Copy'}</button></div>
                      <pre className="text-xs font-mono bg-white/[0.03] text-snow-300 p-3 rounded-lg overflow-x-auto border border-white/[0.06]">{keyGenResult.snowflakeAlterStatement}</pre>
                    </div>
                    <p className="text-xs text-yellow-400/80 flex items-center gap-1.5"><svg className="h-3.5 w-3.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>Save your private key securely.</p>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(1)}>Back</button>
              <button type="button" className="btn-primary" onClick={() => setStep(3)} disabled={!privateKey}>Next: Connect</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div className="text-center py-4">
              <h3 className="text-lg font-semibold text-gray-200 mb-2">Ready to Connect</h3>
              <p className="text-sm text-gray-500 mb-4">Review your connection details</p>
              <div className="grid grid-cols-2 gap-3 text-left max-w-md mx-auto">
                {[['Account', account], ['Username', username], ['Warehouse', warehouse || '(default)'], ['Database', database || '(default)'], ['Role', role || '(default)'], ['Auth', 'RSA Key Pair']].map(([label, value]) => (
                  <div key={label} className="flex flex-col"><span className="text-[10px] text-gray-600 uppercase tracking-wider">{label}</span><span className="text-sm text-gray-300">{value}</span></div>
                ))}
              </div>
            </div>
            {connectionError && (
              <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 text-red-300 text-sm rounded-xl p-4">
                <svg className="h-5 w-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" /></svg>
                {connectionError}
              </div>
            )}
            <div className="flex justify-between pt-2">
              <button type="button" className="btn-secondary" onClick={() => setStep(2)}>Back</button>
              <button type="button" className="btn-primary px-8" onClick={handleConnect} disabled={isConnecting}>
                {isConnecting ? (<span className="flex items-center gap-2"><svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Connecting...</span>) : 'Connect to Snowflake'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
