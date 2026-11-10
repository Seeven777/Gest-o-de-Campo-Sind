'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, LockKeyhole, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { authClient } from '@/lib/auth/client';
import { BrandMark } from '@/components/brand-mark';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'recover'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) throw new Error(result.error.message);
      router.replace('/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  async function recover(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    try {
      const redirectTo = `${window.location.origin}/redefinir-senha`;
      const result = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo,
      });
      if (result.error) throw new Error('Não foi possível solicitar a recuperação. Verifique a configuração de e-mail do Neon Auth.');
      setNotice('Se a conta existir e o envio de e-mails estiver habilitado, você receberá instruções para definir uma nova senha. Verifique também o spam.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao solicitar recuperação.');
    } finally {
      setBusy(false);
    }
  }

  function switchMode(next: 'login' | 'recover') {
    setMode(next);
    setError('');
    setNotice('');
  }

  return (
    <main className="login-page">
      <section className="login-story">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BrandMark size={47} />
          <div style={{ fontWeight: 800, letterSpacing: '-.5px' }}>
            SindPetshop-SP
            <small style={{ display: 'block', fontWeight: 500, opacity: .7, fontSize: 11 }}>Campo &amp; Território</small>
          </div>
        </div>
        <div>
          <span className="tiny-label">A PRESENÇA FAZ A DIFERENÇA</span>
          <h1>Mais perto de quem <span>cuida.</span></h1>
          <p>Informação, planejamento e trabalho de campo para fortalecer a representação dos profissionais do setor pet.</p>
        </div>
        <div style={{ fontSize: 11, color: '#9fc1ad' }}>Plataforma de uso interno · SindPetshop-SP</div>
        <div className="login-illustration" aria-hidden="true">✳</div>
      </section>
      <section className="login-content">
        <div className="login-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cc6d32', fontSize: 11, fontWeight: 800, marginBottom: 23 }}>
            {mode === 'login' ? <LockKeyhole size={16} /> : <Mail size={16} />}
            {mode === 'login' ? 'ACESSO RESTRITO' : 'RECUPERAÇÃO DE ACESSO'}
          </div>
          <h2>{mode === 'login' ? 'Bem-vindo de volta.' : 'Recupere seu acesso.'}</h2>
          <p>{mode === 'login' ? 'Entre com suas credenciais autorizadas para continuar.' : 'Informe o e-mail cadastrado. Enviaremos as instruções caso a recuperação esteja disponível.'}</p>
          <form onSubmit={mode === 'login' ? login : recover}>
            <label>E-mail
              <input className="field" autoComplete="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seuemail@exemplo.com" />
            </label>
            {mode === 'login' && (
              <>
                <label>Senha
                  <input className="field" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Sua senha" />
                </label>
                <div style={{ textAlign: 'right', marginTop: 8, marginBottom: 14 }}>
                  <button type="button" onClick={() => switchMode('recover')} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#b85b23', fontWeight: 700, fontSize: 13 }}>Esqueci minha senha</button>
                </div>
              </>
            )}
            {error && <p className="error" role="alert">{error}</p>}
            {notice && <p role="status" style={{ color: '#17624c', fontSize: 13, lineHeight: 1.5 }}>{notice}</p>}
            <button className="button" type="submit" disabled={busy}>
              {busy ? 'Processando...' : mode === 'login' ? 'Entrar no sistema' : 'Enviar instruções'}
              <ArrowRight size={16} />
            </button>
          </form>
          {mode === 'recover' && (
            <button type="button" onClick={() => switchMode('login')} style={{ display: 'flex', gap: 7, alignItems: 'center', border: 0, background: 'none', marginTop: 20, cursor: 'pointer', color: '#24483b', fontWeight: 700 }}>
              <ArrowLeft size={15} /> Voltar para o login
            </button>
          )}
          <p className="login-foot">
            <ShieldCheck size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 5 }} />
            Acesso restrito a usuários autorizados. Não há cadastro público de agentes.
          </p>
          {mode === 'recover' && <p style={{ fontSize: 12, marginTop: 10 }}>Se não receber um e-mail, solicite à administração a verificação do provedor de e-mails do Neon Auth. <Link href="/login">Acesso interno</Link>.</p>}
        </div>
      </section>
    </main>
  );
}
