'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, upsertUserProfile } from '@/db/userProfileService';
import { getGeminiKey, setGeminiKey, testGeminiKey } from '@/lib/gemini-client';
import type { UserProfile } from '@/db/database';

const GOALS = ['force', 'hypertrophie', 'endurance', 'perte_poids', 'athletisme'] as const;
const EXPERIENCE = ['debutant', 'intermediaire', 'avance'] as const;
const GOAL_LABELS: Record<string, { label: string; icon: string }> = {
  force: { label: 'Force', icon: '💪' },
  hypertrophie: { label: 'Hypertrophie', icon: '🏗️' },
  endurance: { label: 'Endurance', icon: '🏃' },
  perte_poids: { label: 'Perte de poids', icon: '🔥' },
  athletisme: { label: 'Athlétisme', icon: '⚡' },
};
const EXP_LABELS: Record<string, string> = {
  debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé',
};

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Partial<UserProfile>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [apiKey, setApiKeyState] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [keyTest, setKeyTest] = useState<'idle'|'testing'|'ok'|'error'>('idle');
  const [keyTestMsg, setKeyTestMsg] = useState('');

  useEffect(() => {
    getUserProfile().then(p => {
      if (p) setProfile(p);
      setApiKeyState(getGeminiKey());
      setLoading(false);
    });
  }, []);

  function set(key: keyof UserProfile, value: unknown) {
    setProfile(prev => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!profile.name) return;
    setSaving(true);
    await upsertUserProfile(profile as Omit<UserProfile, 'id'|'createdAt'|'updatedAt'>);
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  const goalInfo = GOAL_LABELS[profile.goal ?? ''];
  const expLabel = EXP_LABELS[profile.experience ?? ''];

  return (
    <div className="flex flex-col gap-5 pt-14 pb-4">
      {/* Header */}
      <div className="flex items-center justify-between px-5">
        <h1 className="text-[28px] font-black tracking-tight">Profil</h1>
        <button onClick={handleSave} disabled={saving}
          className={`px-4 py-2.5 rounded-2xl font-bold text-sm transition-all ${
            saved ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
            : saving ? 'bg-white/5 text-zinc-500 border border-white/[0.07]'
            : 'btn-primary'
          }`}>
          {saving ? '…' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* Avatar card */}
      <div className="mx-5 card p-5">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-orange-500/30 to-orange-600/10 border border-orange-500/25 flex items-center justify-center text-3xl font-black text-orange-400 shadow-lg shadow-orange-500/10">
            {profile.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <p className="font-black text-xl">{profile.name || 'Athlète'}</p>
            <p className="text-zinc-500 text-sm mt-0.5">
              {expLabel && <span>{expLabel}</span>}
              {expLabel && goalInfo && <span className="text-zinc-700"> · </span>}
              {goalInfo && <span>{goalInfo.icon} {goalInfo.label}</span>}
            </p>
          </div>
        </div>
      </div>

      {/* Identity */}
      <div className="mx-5 card p-5 flex flex-col gap-4">
        <SectionTitle>Informations</SectionTitle>
        <Field label="Prénom" value={profile.name ?? ''} onChange={v => set('name', v)} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Âge" value={String(profile.age ?? '')} onChange={v => set('age', Number(v))} type="number" />
          <Field label="Poids kg" value={String(profile.weight ?? '')} onChange={v => set('weight', Number(v))} type="number" />
          <Field label="Taille cm" value={String(profile.height ?? '')} onChange={v => set('height', Number(v))} type="number" />
        </div>
      </div>

      {/* Training */}
      <div className="mx-5 card p-5 flex flex-col gap-4">
        <SectionTitle>Entraînement</SectionTitle>

        <div>
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-2.5">Niveau</label>
          <div className="flex gap-2">
            {EXPERIENCE.map(e => (
              <button key={e} onClick={() => set('experience', e)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-all ${
                  profile.experience === e ? 'border-orange-500/50 bg-orange-500/10 text-orange-400' : 'border-white/[0.07] bg-white/[0.03] text-zinc-400'
                }`}>
                {EXP_LABELS[e]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-2.5">Objectif</label>
          <div className="flex flex-col gap-2">
            {GOALS.map(g => {
              const info = GOAL_LABELS[g];
              return (
                <button key={g} onClick={() => set('goal', g)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm transition-all ${
                    profile.goal === g ? 'border-orange-500/50 bg-orange-500/10' : 'border-white/[0.07] bg-white/[0.03]'
                  }`}>
                  <span className="text-base">{info.icon}</span>
                  <span className={`font-semibold flex-1 text-left ${profile.goal === g ? 'text-orange-400' : 'text-zinc-300'}`}>{info.label}</span>
                  {profile.goal === g && (
                    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">
            Jours par semaine : <span className="text-orange-400 font-black text-base">{profile.daysPerWeek ?? 4}</span>
          </label>
          <input type="range" min={2} max={6} step={1} value={profile.daysPerWeek ?? 4}
            onChange={e => set('daysPerWeek', Number(e.target.value))}
            className="w-full h-2"
          />
          <div className="flex justify-between text-[10px] text-zinc-700 font-bold mt-2">
            {[2,3,4,5,6].map(d => <span key={d}>{d}j</span>)}
          </div>
        </div>
      </div>

      {/* Injuries */}
      <div className="mx-5 card p-5 flex flex-col gap-3">
        <SectionTitle>Blessures & restrictions</SectionTitle>
        <textarea value={profile.injuries ?? ''} onChange={e => set('injuries', e.target.value)}
          placeholder="Ex: douleur genou gauche, tendinite épaule…"
          rows={3}
          className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
        />
      </div>

      {/* Gemini API Key */}
      <div className="mx-5 card p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <SectionTitle>Clé API Gemini</SectionTitle>
        </div>
        <p className="text-xs text-zinc-600">Obtiens ta clé gratuite sur <span className="text-zinc-400">aistudio.google.com</span></p>
        <input type="password" value={apiKey} onChange={e => { setApiKeyState(e.target.value); setKeySaved(false); setKeyTest('idle'); }}
          placeholder="AIzaSy…"
          className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-4 py-3 text-zinc-100 font-mono text-sm focus:outline-none focus:border-orange-500/40 transition-colors"
        />
        <div className="flex gap-2">
          <button
            onClick={() => { setGeminiKey(apiKey); setKeySaved(true); setKeyTest('idle'); setKeyTestMsg(''); setTimeout(() => setKeySaved(false), 2500); }}
            className={`flex-1 py-3 rounded-xl font-semibold text-sm transition-all ${
              keySaved ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400' : 'bg-white/[0.05] border border-white/[0.08] text-zinc-300 hover:bg-white/[0.08]'
            }`}>
            {keySaved ? '✓ Sauvegardée' : 'Sauvegarder'}
          </button>
          <button disabled={keyTest === 'testing'}
            onClick={async () => {
              const k = apiKey.trim();
              if (!k) { setKeyTest('error'); setKeyTestMsg('Entre une clé.'); return; }
              setKeyTest('testing'); setKeyTestMsg('');
              try {
                setGeminiKey(k);
                await testGeminiKey(k);
                setKeyTest('ok'); setKeyTestMsg('Clé valide');
                setKeySaved(true); setTimeout(() => setKeySaved(false), 2500);
              } catch (e: unknown) {
                setKeyTest('error');
                setKeyTestMsg(e instanceof Error ? e.message : 'Erreur');
              }
            }}
            className={`px-5 py-3 rounded-xl font-semibold text-sm transition-all border ${
              keyTest === 'testing' ? 'border-white/[0.07] text-zinc-600'
              : keyTest === 'ok' ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/8'
              : keyTest === 'error' ? 'border-red-500/40 text-red-400 bg-red-500/8'
              : 'border-white/[0.08] text-zinc-400 hover:border-white/20'
            }`}>
            {keyTest === 'testing' ? (
              <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />Test</span>
            ) : keyTest === 'ok' ? '✓ OK' : keyTest === 'error' ? '✗ Erreur' : 'Tester'}
          </button>
        </div>
        {keyTestMsg && (
          <p className={`text-xs font-medium ${keyTest === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{keyTestMsg}</p>
        )}
        <p className="text-[10px] text-zinc-700">Stockée uniquement dans ce navigateur — jamais transmise.</p>
      </div>

      {/* Danger zone */}
      <div className="mx-5 mt-2">
        <button
          onClick={() => {
            if (confirm('Réinitialiser toute l\'application ? Cette action est irréversible.')) {
              indexedDB.deleteDatabase('ApexCoach');
              router.replace('/onboarding');
            }
          }}
          className="w-full py-3.5 bg-red-500/5 border border-red-500/15 rounded-2xl text-red-500 text-sm font-semibold hover:bg-red-500/8 transition-all">
          Réinitialiser l'application
        </button>
      </div>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{children}</p>;
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-3 text-zinc-100 text-sm font-medium focus:outline-none focus:border-orange-500/40 transition-colors"
      />
    </div>
  );
}
