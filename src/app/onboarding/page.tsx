'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { upsertUserProfile } from '@/db/userProfileService';
import { saveProgram } from '@/db/programService';
import { setGeminiKey, generateProgram } from '@/lib/gemini-client';
import type { UserProfile } from '@/db/database';

type Step = 'apikey' | 'identity' | 'status' | 'goal' | 'planning' | 'injuries' | 'generating';

const EQUIPMENT_OPTIONS = [
  { label: 'Haltères', icon: '🏋️' },
  { label: 'Barre + disques', icon: '⚖️' },
  { label: 'Rack à squat', icon: '🔩' },
  { label: 'Banc', icon: '🛋️' },
  { label: 'Câbles / Poulie', icon: '🔄' },
  { label: 'Barre de traction', icon: '🔝' },
  { label: 'Anneaux', icon: '⭕' },
  { label: 'Kettlebells', icon: '🔔' },
  { label: 'Machine guidée', icon: '⚙️' },
  { label: 'Poids du corps uniquement', icon: '🤸' },
];

const GOALS = [
  { value: 'hypertrophie', icon: '💪', label: 'Prise de masse', desc: 'Développer le volume musculaire' },
  { value: 'force', icon: '🏆', label: 'Force pure', desc: 'Soulever plus lourd, performances max' },
  { value: 'perte_poids', icon: '🔥', label: 'Perte de poids', desc: 'Brûler les graisses, garder le muscle' },
  { value: 'endurance', icon: '🏃', label: 'Endurance', desc: 'Résistance et cardio-musculaire' },
  { value: 'athletisme', icon: '⚡', label: 'Performance sportive', desc: 'Explosivité, agilité, puissance' },
];

const CURRENT_STATUS = [
  {
    value: 'just_starting',
    icon: '🌱',
    label: 'Je commence',
    desc: 'Peu ou pas d\'expérience en musculation',
  },
  {
    value: 'returning',
    icon: '🔄',
    label: 'Je reprends',
    desc: 'Pause de plusieurs semaines ou mois',
  },
  {
    value: 'already_training',
    icon: '🔥',
    label: 'Je m\'entraîne',
    desc: 'Actif régulièrement en ce moment',
  },
];

const EXPERIENCE = [
  { value: 'debutant', label: 'Débutant', desc: '< 1 an de pratique' },
  { value: 'intermediaire', label: 'Intermédiaire', desc: '1 à 3 ans' },
  { value: 'avance', label: 'Avancé', desc: '3+ ans de pratique sérieuse' },
];

const ENVIRONMENTS = [
  { value: 'gym', icon: '🏢', label: 'Salle de sport' },
  { value: 'home', icon: '🏠', label: 'Domicile' },
  { value: 'outdoor', icon: '🌳', label: 'Extérieur' },
];

const SESSION_DURATIONS = [
  { value: 30, label: '30 min', desc: 'Express' },
  { value: 45, label: '45 min', desc: 'Court' },
  { value: 60, label: '1h', desc: 'Standard' },
  { value: 75, label: '1h15', desc: 'Complet' },
  { value: 90, label: '1h30+', desc: 'Intensif' },
];

const STEPS: Step[] = ['apikey', 'identity', 'status', 'goal', 'planning', 'injuries', 'generating'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('apikey');
  const [error, setError] = useState('');
  const [apiKey, setApiKey] = useState('');

  const [form, setForm] = useState({
    name: '', age: '', weight: '', height: '',
    currentStatus: '' as UserProfile['currentStatus'] | '',
    experience: '' as UserProfile['experience'] | '',
    goal: '' as UserProfile['goal'] | '',
    daysPerWeek: '4',
    sessionDuration: 60,
    trainingEnvironment: '' as UserProfile['trainingEnvironment'] | '',
    availableEquipment: [] as string[],
    sportBackground: '',
    injuries: '',
  });

  function set<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(f => ({ ...f, [key]: value }));
    setError('');
  }

  function toggleEquipment(item: string) {
    const current = form.availableEquipment;
    set('availableEquipment', current.includes(item)
      ? current.filter(e => e !== item)
      : [...current, item]);
  }

  const stepIndex = STEPS.indexOf(step);
  const progress = Math.round((stepIndex / (STEPS.length - 1)) * 100);

  function next(nextStep: Step) {
    setError('');
    setStep(nextStep);
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
        sessionDuration: form.sessionDuration,
        trainingEnvironment: form.trainingEnvironment as UserProfile['trainingEnvironment'],
        currentStatus: form.currentStatus as UserProfile['currentStatus'],
        availableEquipment: form.availableEquipment,
        sportBackground: form.sportBackground,
        injuries: form.injuries,
      };
      await upsertUserProfile(profile);
      const programData = await generateProgram(profile as UserProfile);
      await saveProgram({ ...(programData as object), generatedAt: new Date(), weekNumber: 0, isActive: true } as Parameters<typeof saveProgram>[0]);
      router.replace('/dashboard');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      setError(msg || 'Erreur lors de la génération. Vérifie ta clé API.');
      setStep('injuries');
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="px-5 pt-safe pt-12 pb-4 flex-shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-lg font-black text-white">A</span>
          </div>
          <span className="font-black text-lg tracking-tight">ApexCoach</span>
        </div>
        {step !== 'generating' && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-orange-500 rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: 'easeOut' }}
              />
            </div>
            <span className="text-[10px] font-bold text-zinc-600 tabular-nums">{stepIndex}/{STEPS.length - 2}</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 px-5 pb-10 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {/* API KEY */}
            {step === 'apikey' && (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Clé Gemini ✦</h1>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    ApexCoach utilise Google Gemini pour générer des programmes sur mesure et analyser tes performances en temps réel.
                  </p>
                </div>

                <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-2.5 text-sm text-zinc-400">
                  <Step3Item n="1" text={<>Va sur <span className="text-orange-400 font-semibold">aistudio.google.com</span></>} />
                  <Step3Item n="2" text="Crée une clé API — c'est gratuit" />
                  <Step3Item n="3" text="Colle-la ci-dessous" />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Clé API</label>
                  <input
                    type="password"
                    value={apiKey}
                    onChange={e => { setApiKey(e.target.value); setError(''); }}
                    placeholder="AIza…"
                    className="bg-white/[0.04] border border-white/[0.08] rounded-2xl px-4 py-3.5 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-orange-500/50 transition-colors font-mono text-sm"
                  />
                  <p className="text-[10px] text-zinc-700">Stockée uniquement dans ton navigateur — jamais transmise.</p>
                </div>

                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}

                <button
                  onClick={() => {
                    if (!apiKey.trim()) { setError('Entre ta clé API pour continuer.'); return; }
                    setGeminiKey(apiKey);
                    next('identity');
                  }}
                  className="w-full py-4 bg-orange-500 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform"
                >
                  Continuer →
                </button>
              </div>
            )}

            {/* IDENTITY */}
            {step === 'identity' && (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Qui es-tu ?</h1>
                  <p className="text-zinc-500 text-sm">Tes données de base pour calibrer chaque séance.</p>
                </div>

                <OField label="Prénom" value={form.name} onChange={v => set('name', v)} placeholder="Alex" />

                <div className="grid grid-cols-3 gap-3">
                  <OField label="Âge" value={form.age} onChange={v => set('age', v)} type="number" placeholder="25" unit="ans" />
                  <OField label="Poids" value={form.weight} onChange={v => set('weight', v)} type="number" placeholder="80" unit="kg" />
                  <OField label="Taille" value={form.height} onChange={v => set('height', v)} type="number" placeholder="180" unit="cm" />
                </div>

                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <NavButtons
                  onNext={() => {
                    if (!form.name || !form.age || !form.weight || !form.height) { setError('Remplis tous les champs.'); return; }
                    next('status');
                  }}
                />
              </div>
            )}

            {/* STATUS — the key question a real coach asks first */}
            {step === 'status' && (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Où en es-tu ?</h1>
                  <p className="text-zinc-500 text-sm">C'est la question la plus importante — elle détermine tout le programme.</p>
                </div>

                <div className="flex flex-col gap-3">
                  {CURRENT_STATUS.map(s => (
                    <button
                      key={s.value}
                      onClick={() => set('currentStatus', s.value as UserProfile['currentStatus'])}
                      className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                        form.currentStatus === s.value
                          ? 'border-orange-500/50 bg-orange-500/8'
                          : 'border-white/[0.07] bg-white/[0.02]'
                      }`}
                    >
                      <span className="text-3xl">{s.icon}</span>
                      <div className="flex-1">
                        <p className={`font-black text-base ${form.currentStatus === s.value ? 'text-orange-400' : ''}`}>{s.label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{s.desc}</p>
                      </div>
                      {form.currentStatus === s.value && (
                        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {/* Experience level — contextually shown here */}
                {form.currentStatus && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                      Expérience en musculation
                    </label>
                    <div className="flex gap-2">
                      {EXPERIENCE.map(e => (
                        <button key={e.value} onClick={() => set('experience', e.value as UserProfile['experience'])}
                          className={`flex-1 py-3 px-2 rounded-xl border text-center transition-all ${
                            form.experience === e.value
                              ? 'border-orange-500/50 bg-orange-500/8 text-orange-400'
                              : 'border-white/[0.07] bg-white/[0.02] text-zinc-400'
                          }`}>
                          <div className="font-bold text-sm">{e.label}</div>
                          <div className="text-[10px] text-zinc-600 mt-0.5">{e.desc}</div>
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}

                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <NavButtons
                  onBack={() => setStep('identity')}
                  onNext={() => {
                    if (!form.currentStatus || !form.experience) { setError('Réponds aux deux questions.'); return; }
                    next('goal');
                  }}
                />
              </div>
            )}

            {/* GOAL */}
            {step === 'goal' && (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Ton objectif</h1>
                  <p className="text-zinc-500 text-sm">L'IA calibre chaque paramètre (volume, intensité, fréquence) en fonction de ça.</p>
                </div>

                <div className="flex flex-col gap-2.5">
                  {GOALS.map(g => (
                    <button key={g.value} onClick={() => set('goal', g.value as UserProfile['goal'])}
                      className={`flex items-center gap-4 p-4 rounded-2xl border text-left transition-all ${
                        form.goal === g.value
                          ? 'border-orange-500/50 bg-orange-500/8'
                          : 'border-white/[0.07] bg-white/[0.02]'
                      }`}>
                      <span className="text-2xl">{g.icon}</span>
                      <div className="flex-1">
                        <p className={`font-black ${form.goal === g.value ? 'text-orange-400' : ''}`}>{g.label}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">{g.desc}</p>
                      </div>
                      {form.goal === g.value && (
                        <div className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center flex-shrink-0">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>

                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <NavButtons
                  onBack={() => setStep('status')}
                  onNext={() => {
                    if (!form.goal) { setError('Choisis un objectif.'); return; }
                    next('planning');
                  }}
                />
              </div>
            )}

            {/* PLANNING — days, duration, environment, equipment */}
            {step === 'planning' && (
              <div className="flex flex-col gap-6 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Planning & lieu</h1>
                  <p className="text-zinc-500 text-sm">Un vrai coach adapte le programme à tes contraintes réelles.</p>
                </div>

                {/* Days per week */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">
                    Jours par semaine
                  </label>
                  <div className="flex gap-2">
                    {[2, 3, 4, 5, 6].map(d => (
                      <button key={d} onClick={() => set('daysPerWeek', String(d))}
                        className={`flex-1 py-3.5 rounded-xl border font-black text-xl transition-all ${
                          form.daysPerWeek === String(d)
                            ? 'border-orange-500/50 bg-orange-500/8 text-orange-400'
                            : 'border-white/[0.07] bg-white/[0.02] text-zinc-400'
                        }`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Session duration */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">
                    Durée par séance
                  </label>
                  <div className="flex gap-2">
                    {SESSION_DURATIONS.map(d => (
                      <button key={d.value} onClick={() => set('sessionDuration', d.value)}
                        className={`flex-1 flex flex-col items-center py-3 rounded-xl border transition-all ${
                          form.sessionDuration === d.value
                            ? 'border-orange-500/50 bg-orange-500/8 text-orange-400'
                            : 'border-white/[0.07] bg-white/[0.02] text-zinc-400'
                        }`}>
                        <span className="font-black text-sm">{d.label}</span>
                        <span className="text-[9px] text-zinc-600 mt-0.5">{d.desc}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Environment */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">
                    Où t'entraînes-tu ?
                  </label>
                  <div className="flex gap-2">
                    {ENVIRONMENTS.map(e => (
                      <button key={e.value} onClick={() => set('trainingEnvironment', e.value as UserProfile['trainingEnvironment'])}
                        className={`flex-1 flex flex-col items-center py-3.5 rounded-xl border transition-all ${
                          form.trainingEnvironment === e.value
                            ? 'border-orange-500/50 bg-orange-500/8'
                            : 'border-white/[0.07] bg-white/[0.02]'
                        }`}>
                        <span className="text-2xl">{e.icon}</span>
                        <span className={`text-xs font-bold mt-1 ${form.trainingEnvironment === e.value ? 'text-orange-400' : 'text-zinc-500'}`}>{e.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Equipment */}
                <div>
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest block mb-3">
                    Équipement disponible
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {EQUIPMENT_OPTIONS.map(item => (
                      <button key={item.label} onClick={() => toggleEquipment(item.label)}
                        className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm font-semibold transition-all ${
                          form.availableEquipment.includes(item.label)
                            ? 'border-orange-500/50 bg-orange-500/8 text-orange-400'
                            : 'border-white/[0.07] bg-white/[0.02] text-zinc-500'
                        }`}>
                        <span>{item.icon}</span> {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                {error && <p className="text-red-400 text-sm font-medium">{error}</p>}
                <NavButtons
                  onBack={() => setStep('goal')}
                  onNext={() => {
                    if (!form.trainingEnvironment) { setError('Indique où tu t\'entraînes.'); return; }
                    if (!form.availableEquipment.length) { setError('Sélectionne au moins un équipement.'); return; }
                    next('injuries');
                  }}
                />
              </div>
            )}

            {/* INJURIES + SPORT BACKGROUND */}
            {step === 'injuries' && (
              <div className="flex flex-col gap-5 pt-4">
                <div>
                  <h1 className="text-[28px] font-black tracking-tight mb-1">Derniers détails</h1>
                  <p className="text-zinc-500 text-sm">Ces infos évitent les blessures et personnalisent encore plus le programme.</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    Pratique sportive (hors muscu)
                  </label>
                  <input
                    value={form.sportBackground}
                    onChange={e => set('sportBackground', e.target.value)}
                    placeholder="Ex: foot amateur, tennis 2x/sem, natation..."
                    className="bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                  <p className="text-[10px] text-zinc-700">Optionnel — mais ça change tout pour le programme</p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">
                    Blessures & restrictions médicales
                  </label>
                  <textarea
                    value={form.injuries}
                    onChange={e => set('injuries', e.target.value)}
                    placeholder="Ex: douleur épaule droite, opération genou 2023, lombalgie chronique..."
                    rows={3}
                    className="w-full bg-white/[0.03] border border-white/[0.07] rounded-2xl px-4 py-3 text-sm text-zinc-200 placeholder-zinc-700 resize-none focus:outline-none focus:border-orange-500/40 transition-colors"
                  />
                </div>

                {error && (
                  <div className="p-3 bg-red-500/8 border border-red-500/20 rounded-xl">
                    <p className="text-red-400 text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="flex gap-3 mt-1">
                  <button onClick={() => setStep('planning')}
                    className="w-12 h-12 flex items-center justify-center rounded-xl border border-white/[0.07] text-zinc-400 flex-shrink-0">
                    ←
                  </button>
                  <button onClick={generateAndSave}
                    className="flex-1 py-4 bg-orange-500 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
                    🚀 Générer mon programme
                  </button>
                </div>
              </div>
            )}

            {/* GENERATING */}
            {step === 'generating' && (
              <div className="flex flex-col items-center justify-center gap-8 pt-20 text-center">
                <div className="relative">
                  <div className="w-24 h-24 rounded-3xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
                    <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-orange-500 rounded-full animate-ping opacity-60" />
                </div>
                <div>
                  <h2 className="text-2xl font-black tracking-tight mb-2">Coach Elite analyse…</h2>
                  <p className="text-zinc-500 text-sm leading-relaxed max-w-[260px]">
                    Création d'un programme 100% personnalisé selon ton profil complet
                  </p>
                </div>
                <div className="flex gap-2">
                  {['Profil', 'Objectifs', 'Équipement', 'Programme'].map((label, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.4 }}
                      className="px-3 py-1.5 bg-white/[0.04] border border-white/[0.07] rounded-lg text-[10px] font-bold text-zinc-600"
                    >
                      {label}
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

function Step3Item({ n, text }: { n: string; text: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 text-[10px] font-black flex items-center justify-center flex-shrink-0 mt-0.5">{n}</span>
      <span>{text}</span>
    </div>
  );
}

function OField({ label, value, onChange, type = 'text', placeholder, unit }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; placeholder?: string; unit?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          inputMode={type === 'number' ? 'numeric' : undefined}
          className={`w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3 py-3 text-zinc-100 placeholder-zinc-700 focus:outline-none focus:border-orange-500/40 transition-colors text-sm font-medium ${unit ? 'pr-10' : ''}`}
        />
        {unit && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600 font-bold">{unit}</span>}
      </div>
    </div>
  );
}

function NavButtons({ onBack, onNext }: { onBack?: () => void; onNext: () => void }) {
  return (
    <div className="flex gap-3 mt-2">
      {onBack && (
        <button onClick={onBack}
          className="w-12 h-12 flex items-center justify-center rounded-xl border border-white/[0.07] text-zinc-400 flex-shrink-0">
          ←
        </button>
      )}
      <button onClick={onNext}
        className="flex-1 py-4 bg-orange-500 text-white font-black text-base rounded-2xl shadow-lg shadow-orange-500/20 active:scale-[0.98] transition-transform">
        Continuer →
      </button>
    </div>
  );
}
