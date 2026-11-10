'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand-mark';
import { authClient } from '@/lib/auth/client';

export default function RedefinirSenha() {
  const [token, setToken] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    setToken(query.get('token'));
    setInvalid(Boolean(query.get('error')));
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    if (!token || invalid) {
      setError('Link inválido ou expirado. Solicite uma nova recuperação.');
      return;
    }
    if (password.length < 12) {
      setError('Escolha uma senha de pelo menos 12 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setBusy(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token });
      if (result.error) throw new Error('Não foi possível redefinir a senha. Solicite um novo link.');
      setSuccess(true);
      setPassword('');
      setConfirm('');
      window.history.replaceState(null, '', '/redefinir-senha');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir senha.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={47} />
          <div style={{ fontWeight: 800, letterSpacing: '-.5px' }}>SindPetshop-SP
            <small style={{ display: 'block', fontWeight: 500, opacity: .7, fontSize: 11 }}>Campo &amp; Território</small>
          </div>
        </div>
        <div>
          <span className="tiny-label">ACESSO SEGURO</span>
          <h1>Sua conta, <span>protegida.</span></h1>
          <p>Defina uma nova senha para continuar seu trabalho na plataforma sindical.</p>
        </div>
        <div style={{ fontSize: 11, color: '#9fc1ad' }}>Plataforma de uso interno · SindPetshop-SP</div>
        <div className="login-illustration" aria-hidden="true">✳</div>
      </section>
      <section className="login-content">
        <div className="login-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cc6d32', fontSize: 11, fontWeight: 800, marginBottom: 23 }}>
            <LockKeyhole size={16} /> REDEFINIÇÃO DE SENHA
          </div>
          <h2>{success ? 'Senha atualizada.' : 'Crie sua nova senha.'}</h2>
          {success ? (
            <>
              <p>Agora você pode acessar a plataforma com a nova senha.</p>
              <button className="button" type="button" onClick={() => router.push('/login')}>Ir para login <ArrowRight size={16} /></button>
            </>
          ) : !token || invalid ? (
            <>
              <p>Este link não contém um token válido ou expirou. Solicite outro link pelo formulário de acesso.</p>
              <Link href="/login" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: '#b85b23', fontWeight: 700 }}><ArrowLeft size={16}/> Voltar ao login</Link>
            </>
          ) : (
            <>
              <p>Use uma senha exclusiva com pelo menos 12 caracteres.</p>
              <form onSubmit={submit}>
                <label>Nova senha
                  <input className="field" type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)} />
                </label>
                <label>Confirme a nova senha
                  <input className="field" type="password" autoComplete="new-password" minLength={12} required value={confirm} onChange={e => setConfirm(e.target.value)} />
                </label>
                {error && <p className="error" role="alert">{error}</p>}
                <button className="button" type="submit" disabled={busy}>{busy ? 'Atualizando...' : 'Salvar nova senha'} <ArrowRight size={16}/></button>
              </form>
            </>
          )}
          <p className="login-foot"><ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }}/> Não compartilhe o link de recuperação com outras pessoas.</p>
        </div>
      </section>
    </main>
  );
}
