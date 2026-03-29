import { useUserProfile } from './hooks/useUserProfile';

export default function App() {
  const { profile, isLoading, hasProfile } = useUserProfile();

  if (isLoading) return <p>Chargement...</p>;

  if (!hasProfile) return <p>Aucun profil — créez votre profil pour commencer.</p>;

  return (
    <div>
      <h1>Bienvenue, {profile!.name}</h1>
      <p>Objectif : {profile!.goal} · Expérience : {profile!.experience}</p>
    </div>
  );
}
