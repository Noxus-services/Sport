'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getUserProfile, upsertUserProfile } from '@/db/userProfileService';
import { getGeminiKey, setGeminiKey } from '@/lib/gemini-client';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { UserProfile } from '@/db/database';

const GOALS = ['force', 'hypertrophie', 'endurance', 'perte_poids', 'athletisme'] as const;
const EXPERIENCE = ['debutant', 'intermediaire', 'avance'] as const;
const GOAL_LABELS: Record<string, string> = {
  force: '💪 Force', hypertrophie: '🏗️ Hypertrophie', endurance: '🏃 Endurance',
  perte_poids: '🔥 Perte de poids', athletisme: '⚡ Athlétisme',
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
  const [apiKey, setApiKey] = useState('');
  const [keySaved, setKeySaved] = useState(false);
  const [keyTest, setKeyTest] = useState<'idle' | 'testing' | 'ok' | 'error'>('idle');
  const [keyTestMsg, setKeyTestMsg] = useState('');

  useEffect(() => {
    getUserProfile().then((p) => {
      if (p) setProfile(p);
      setApiKey(getGeminiKey());
      setLoading(false);
    });
  }, []);

  function set(key: keyof UserProfile, value: unknown) {
    setProfile((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSave() {
    if (!profile.name) return;
    setSaving(true);
    await upsertUserProfile(profile as Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'>);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pt-12 pb-4 flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Profil</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${
            saved ? 'bg-green-500 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'
          }`}
        >
          {saving ? '…' : saved ? '✓ Sauvegardé' : 'Sauvegarder'}
        </button>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4 bg-zinc-900 rounded-2xl p-4 border border-zinc-800">
        <div className="w-16 h-16 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center text-2xl font-bold text-orange-400">
          {profile.name?.[0]?.toUpperCase() ?? '?'}
        </div>
        <div>
          <p className="font-bold text-lg">{profile.name || 'Athlète'}</p>
          <p className="text-zinc-500 text-sm">{EXP_LABELS[profile.experience ?? ''] || ''} · {GOAL_LABELS[profile.goal ?? ''] || ''}</p>
        </div>
      </div>

      {/* Fields */}
      <Section title="Informations">
        <Field label="Prénom" value={profile.name ?? ''} onChange={(v) => set('name', v)} />
        <div className="grid grid-cols-3 gap-3">
          <Field label="Âge" value={String(profile.age ?? '')} onChange={(v) => set('age', Number(v))} type="number" />
          <Field label="Poids (kg)" value={String(profile.weight ?? '')} onChange={(v) => set('weight', Number(v))} type="number" />
          <Field label="Taille (cm)" value={String(profile.height ?? '')} onChange={(v) => set('height', Number(v))} type="number" />
        </div>
      </Section>

      <Section title="Entraînement">
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-2">Expérience</label>
          <div className="flex gap-2">
            {EXPERIENCE.map((e) => (
              <button
                key={e}
                onClick={() => set('experience', e)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                  profile.experience === e ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-zinc-700 text-zinc-400'
                }`}
              >
                {EXP_LABELS[e]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-2">Objectif</label>
          <div className="flex flex-col gap-2">
            {GOALS.map((g) => (
              <button
                key={g}
                onClick={() => set('goal', g)}
                className={`flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm transition-all ${
                  profile.goal === g ? 'border-orange-500 bg-orange-500/10 text-orange-400' : 'border-zinc-800 text-zinc-400'
                }`}
              >
                {GOAL_LABELS[g]}
                {profile.goal === g && <span>✓</span>}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="text-xs text-zinc-500 uppercase tracking-wide block mb-2">
            Jours/semaine : <span className="text-orange-400 font-bold">{profile.daysPerWeek ?? 4}</span>
          </label>
          <input
            type="range" min={2} max={6} step={1}
            value={profile.daysPerWeek ?? 4}
            onChange={(e) => set('daysPerWeek', Number(e.target.value))}
            className="w-full accent-orange-500"
          />
          <div className="flex justify-between text-xs text-zinc-600 mt-1">
            {[2,3,4,5,6].map((d) => <span key={d}>{d}j</span>)}
          </div>
        </div>
      </Section>

      <Section title="Blessures & restrictions">
        <textarea
          value={profile.injuries ?? ''}
          onChange={(e) => set('injuries', e.target.value)}
          placeholder="Blessures actuelles ou passées..."
          rows={3}
          className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500"
        />
      </Section>

      <Section title="Clé API Gemini">
        <div className="flex flex-col gap-2">
          <input
            type="password"
            value={apiKey}
            onChange={(e) => { setApiKey(e.target.value); setKeySaved(false); }}
            placeholder="AIza..."
            className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 font-mono text-sm focus:outline-none focus:border-orange-500"
          />
          <div className="flex gap-2">
            <button
              onClick={() => { setGeminiKey(apiKey); setKeySaved(true); setKeyTest('idle'); setTimeout(() => setKeySaved(false), 2000); }}
              className={`flex-1 py-2.5 rounded-xl font-semibold text-sm transition-all ${keySaved ? 'bg-green-500 text-white' : 'bg-zinc-700 hover:bg-zinc-600 text-zinc-200'}`}
            >
              {keySaved ? '✓ Sauvegardée' : 'Sauvegarder'}
            </button>
            <button
              disabled={keyTest === 'testing'}
              onClick={async () => {
                const key = apiKey.trim();
                if (!key) { setKeyTest('error'); setKeyTestMsg('Entre une clé d\'abord.'); return; }
                setKeyTest('testing');
                setKeyTestMsg('');
                try {
                  const m = new GoogleGenerativeAI(key).getGenerativeModel({ model: 'gemini-1.5-flash' });
                  await m.generateContent('Réponds juste "ok"');
                  setKeyTest('ok');
                  setKeyTestMsg('Clé valide ✓');
                } catch (e: unknown) {
                  setKeyTest('error');
                  const msg = e instanceof Error ? e.message : String(e);
                  if (msg.includes('API_KEY_INVALID') || msg.includes('400')) setKeyTestMsg('Clé invalide');
                  else if (msg.includes('403')) setKeyTestMsg('Permission refusée');
                  else if (msg.includes('429')) setKeyTestMsg('Quota dépassé');
                  else setKeyTestMsg('Erreur réseau');
                }
              }}
              className={`px-4 py-2.5 rounded-xl font-semibold text-sm transition-all border ${
                keyTest === 'testing' ? 'border-zinc-700 text-zinc-500' :
                keyTest === 'ok' ? 'border-green-500 text-green-400' :
                keyTest === 'error' ? 'border-red-500 text-red-400' :
                'border-zinc-700 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {keyTest === 'testing' ? (
                <span className="flex items-center gap-1.5">
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Test
                </span>
              ) : keyTest === 'ok' ? '✓ OK' : keyTest === 'error' ? '✗ Erreur' : 'Tester'}
            </button>
          </div>
          {keyTestMsg && (
            <p className={`text-xs ${keyTest === 'ok' ? 'text-green-400' : 'text-red-400'}`}>{keyTestMsg}</p>
          )}
          <p className="text-xs text-zinc-600">Stockée uniquement dans ce navigateur.</p>
        </div>
      </Section>

      <button
        onClick={() => {
          if (confirm('Réinitialiser l\'app ? Toutes les données seront effacées.')) {
            indexedDB.deleteDatabase('ApexCoach');
            router.replace('/onboarding');
          }
        }}
        className="w-full py-3 border border-red-900 rounded-xl text-red-500 text-sm font-medium mt-2"
      >
        Réinitialiser l'application
      </button>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-zinc-900 rounded-2xl p-4 border border-zinc-800 flex flex-col gap-4">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wide">{title}</p>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs text-zinc-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-800 border border-zinc-700 rounded-xl px-3 py-2.5 text-zinc-100 text-sm focus:outline-none focus:border-orange-500 transition-colors"
      />
    </div>
  );
}
