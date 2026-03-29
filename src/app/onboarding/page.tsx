'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { upsertUserProfile } from '@/db/userProfileService';
import { saveProgram } from '@/db/programService';
import type { UserProfile } from '@/db/database';

type Step = 'identity' | 'level' | 'planning' | 'injuries' | 'generating';

const EQUIPMENT_OPTIONS = [
  'Haltères', 'Barre + disques', 'Rack à squat', 'Banc', 'Câbles/Poulie',
  'Barre de traction', 'Anneaux', 'Kettlebells', 'Machine guidée', 'Poids du corps uniquement',
];

const GOALS = [
  { value: 'force',        label: '💪 Force',          desc: 'Soulever plus lourd' },
  { value: 'hypertrophie', label: '🏗️ Hypertrophie',   desc: 'Prise de masse musculaire' },
  { value: 'endurance',    label: '🏃 Endurance',       desc: 'Résistance musculaire' },
  { value: 'perte_poids',  label: '🔥 Perte de poids', desc: 'Brûler des calories' },
  { value: 'athletisme',   label: '⚡ Athlétisme',      desc: 'Performance sportive' },
];

const EXPERIENCE = [
  { value: 'debutant',      label: 'Débutant',      desc: '< 1 an' },
  { value: 'intermediaire', label: 'Intermédiaire', desc: '1–3 ans' },
  { value: 'avance',        label: 'Avancé',        desc: '3+ ans' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('identity');
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    age: '',
    weight: '',
    height: '',
    experience: '',
    goal: '',
    daysPerWeek: '4',
    availableEquipment: [] as string[],
    injuries: '',
  });

  function set(key: string, value: string | string[]) {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  }

  function toggleEquipment(item: string) {
    set('availableEquipment', form.availableEquipment.includes(item)
      ? form.availableEquipment.filter((e) => e !== item)
      : [...form.availableEquipment, item]);
  }

  async function generateAndSave() {
    setStep('generating');
    try {
      const profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt'> = {
        name: form.name,
        age: Number(form.age),
        weight: Number(form.weight),
        height: Number(form.height),
        experience: form.experience as UserProfile['experience'],
        goal: form.goal as UserProfile['goal'],
        daysPerWeek: Number(form.daysPerWeek),
        availableEquipment: form.availableEquipment,
        injuries: form.injuries,
      };
      await upsertUserProfile(profile);

      const res = await fetch('/api/generate-program', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userProfile: profile }),
      });
      if (!res.ok) throw new Error('Erreur génération');
      const data = await res.json();
      await saveProgram(data.program);
      router.replace('/dashboard');
    } catch (e) {
      setError('Erreur lors de la génération. Vérifie ta clé API Gemini.');
      setStep('injuries');
    }
  }

  const progress = { identity: 25, level: 50, planning: 75, injuries: 90, generating: 100 };

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Header */}
      <div className="px-5 pt-12 pb-4">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center">
            <span className="text-xl font-black text-white">A</span>
          </div>
          <span className="font-bold text-lg">ApexCoach</span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-500"
            style={{ width: `${progress[step]}%` }}
          />
        </div>
      </div>

      <div className="flex-1 px-5 pb-8 overflow-y-auto">
        {/* STEP 1: Identity */}
        {step === 'identity' && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Qui es-tu ?</h1>
              <p className="text-zinc-400 text-sm">Tes infos de base pour personnaliser ton expérience.</p>
            </div>
            <Field label="Prénom" value={form.name} onChange={(v) => set('name', v)} placeholder="Ex: Alexandre" />
            <div className="grid grid-cols-3 gap-3">
              <Field label="Âge" value={form.age} onChange={(v) => set('age', v)} type="number" placeholder="25" />
              <Field label="Poids (kg)" value={form.weight} onChange={(v) => set('weight', v)} type="number" placeholder="80" />
              <Field label="Taille (cm)" value={form.height} onChange={(v) => set('height', v)} type="number" placeholder="180" />
            </div>
            <Btn
              label="Continuer →"
              onClick={() => {
                if (!form.name || !form.age || !form.weight || !form.height) {
                  setError('Remplis tous les champs.');
                  return;
                }
                setStep('level');
              }}
              error={error}
            />
          </div>
        )}

        {/* STEP 2: Level + Goal */}
        {step === 'level' && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Niveau & objectif</h1>
              <p className="text-zinc-400 text-sm">Pour adapter l'intensité et le volume.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 mb-2">Expérience</p>
              <div className="flex gap-2">
                {EXPERIENCE.map((e) => (
                  <button
                    key={e.value}
                    onClick={() => set('experience', e.value)}
                    className={`flex-1 py-3 px-2 rounded-xl border text-center transition-all ${
                      form.experience === e.value
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <div className="font-semibold text-sm">{e.label}</div>
                    <div className="text-[11px] text-zinc-500">{e.desc}</div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 mb-2">Objectif principal</p>
              <div className="flex flex-col gap-2">
                {GOALS.map((g) => (
                  <button
                    key={g.value}
                    onClick={() => set('goal', g.value)}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all ${
                      form.goal === g.value
                        ? 'border-orange-500 bg-orange-500/10'
                        : 'border-zinc-800 bg-zinc-900'
                    }`}
                  >
                    <span className="text-xl">{g.label.split(' ')[0]}</span>
                    <div>
                      <div className="font-semibold text-sm">{g.label.split(' ').slice(1).join(' ')}</div>
                      <div className="text-[11px] text-zinc-500">{g.desc}</div>
                    </div>
                    {form.goal === g.value && (
                      <span className="ml-auto text-orange-500">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('identity')} className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400">←</button>
              <Btn
                label="Continuer →"
                onClick={() => {
                  if (!form.experience || !form.goal) { setError('Fais tes choix.'); return; }
                  setStep('planning');
                }}
                error={error}
                full
              />
            </div>
          </div>
        )}

        {/* STEP 3: Planning + Equipment */}
        {step === 'planning' && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Planning & équipement</h1>
              <p className="text-zinc-400 text-sm">Pour concevoir des séances réalistes.</p>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 mb-3">Jours d'entraînement par semaine</p>
              <div className="flex gap-2">
                {[2, 3, 4, 5, 6].map((d) => (
                  <button
                    key={d}
                    onClick={() => set('daysPerWeek', String(d))}
                    className={`flex-1 py-3 rounded-xl border font-bold text-lg transition-all ${
                      form.daysPerWeek === String(d)
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-zinc-700 text-zinc-400'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400 mb-2">Équipement disponible</p>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT_OPTIONS.map((item) => (
                  <button
                    key={item}
                    onClick={() => toggleEquipment(item)}
                    className={`px-3 py-1.5 rounded-lg border text-sm transition-all ${
                      form.availableEquipment.includes(item)
                        ? 'border-orange-500 bg-orange-500/10 text-orange-400'
                        : 'border-zinc-700 text-zinc-500'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setStep('level')} className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400">←</button>
              <Btn
                label="Continuer →"
                onClick={() => {
                  if (!form.availableEquipment.length) { setError('Sélectionne au moins un équipement.'); return; }
                  setStep('injuries');
                }}
                error={error}
                full
              />
            </div>
          </div>
        )}

        {/* STEP 4: Injuries */}
        {step === 'injuries' && (
          <div className="flex flex-col gap-5 pt-4">
            <div>
              <h1 className="text-2xl font-bold mb-1">Blessures & restrictions</h1>
              <p className="text-zinc-400 text-sm">Pour éviter les exercices contre-indiqués.</p>
            </div>
            <div>
              <label className="text-sm font-medium text-zinc-400 mb-2 block">
                Blessures actuelles ou passées (optionnel)
              </label>
              <textarea
                value={form.injuries}
                onChange={(e) => set('injuries', e.target.value)}
                placeholder="Ex: douleur épaule droite, opération genou en 2023..."
                rows={4}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 resize-none focus:outline-none focus:border-orange-500 transition-colors"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <div className="flex gap-3">
              <button onClick={() => setStep('planning')} className="px-4 py-3 rounded-xl border border-zinc-700 text-zinc-400">←</button>
              <button
                onClick={generateAndSave}
                className="flex-1 py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
              >
                🚀 Générer mon programme
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Generating */}
        {step === 'generating' && (
          <div className="flex flex-col items-center justify-center gap-6 pt-16">
            <div className="w-20 h-20 rounded-2xl bg-orange-500/20 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
            <div className="text-center">
              <h2 className="text-xl font-bold mb-2">Gemini génère ton programme…</h2>
              <p className="text-zinc-400 text-sm">Personnalisation en cours selon ton profil</p>
            </div>
            <div className="flex flex-col gap-2 text-sm text-zinc-500 text-center">
              <p>✓ Analyse de ton profil</p>
              <p>✓ Sélection des exercices</p>
              <p className="text-zinc-400">⟳ Génération du programme…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-zinc-400">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-orange-500 transition-colors"
      />
    </div>
  );
}

function Btn({ label, onClick, error, full }: {
  label: string; onClick: () => void; error?: string; full?: boolean;
}) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? 'flex-1' : ''}`}>
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <button
        onClick={onClick}
        className="w-full py-3.5 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-xl transition-colors"
      >
        {label}
      </button>
    </div>
  );
}
