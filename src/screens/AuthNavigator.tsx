import React, { useState }        from 'react';
import { Modal }                   from 'react-native';
import RoleSelectScreen            from './auth/RoleSelectScreen';
import RegisterScreen, { RegisterData } from './auth/RegisterScreen';
import LoginScreen                 from './auth/LoginScreen';
import EmailVerifyScreen           from './auth/EmailVerifyScreen';
import ForgotPasswordScreen        from './auth/ForgotPasswordScreen';
import MerchantShopSetupScreen     from './auth/MerchantShopSetupScreen';
import CGUScreen                   from './common/CGUScreen';
import ConfidentialiteScreen       from './common/ConfidentialiteScreen';
import useAuthStore                from '../store/authStore';
import * as authService            from '../services/auth';

type Role = 'client' | 'merchant';

type StackItem =
  | { id: 'role' }
  | { id: 'register';      role: Role }
  | { id: 'shopSetup';     userData: RegisterData }
  | { id: 'login' }
  | { id: 'emailVerify';   email: string }
  | { id: 'forgotPassword' };

interface Props {
  onComplete: (role: Role) => void;
}

export default function AuthNavigator({ onComplete }: Props) {
  const [stack, setStack] = useState<StackItem[]>([{ id: 'role' }]);
  // CGU et Confidentialité s'ouvrent en modal pour ne pas démonter l'écran
  // d'inscription (ce qui remettrait tous les champs à zéro).
  const [legalModal, setLegalModal] = useState<null | 'cgu' | 'confidentialite'>(null);

  const push = (item: StackItem) => setStack(prev => [...prev, item]);
  const pop  = ()                 => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);
  const openCGU             = () => setLegalModal('cgu');
  const openConfidentialite = () => setLegalModal('confidentialite');
  const closeLegal          = () => setLegalModal(null);

  const current = stack[stack.length - 1];

  let screen: React.ReactNode;

  switch (current.id) {

    // ── Choix du rôle ─────────────────────────────────────────────────────────
    case 'role':
      screen = (
        <RoleSelectScreen
          onSelectClient={()   => push({ id: 'register', role: 'client'   })}
          onSelectMerchant={() => push({ id: 'register', role: 'merchant' })}
          onLogin={()          => push({ id: 'login' })}
        />
      );
      break;

    // ── Inscription ───────────────────────────────────────────────────────────
    case 'register':
      screen = (
        <RegisterScreen
          role={current.role}
          onBack={pop}
          onCGU={openCGU}
          onConfidentialite={openConfidentialite}
          onSuccess={async (userData) => {
            if (current.role === 'merchant') {
              // Marchand → étape 2 (configuration boutique) avant création Supabase
              push({ id: 'shopSetup', userData });
              return;
            }

            // Client → inscription Supabase immédiate
            const user = await authService.register({
              name:     userData.name,
              phone:    userData.phone,
              email:    userData.email,
              password: userData.password,
              role:     'client',
            });
            useAuthStore.getState().setUser(user);

            if (userData.email.trim()) {
              push({ id: 'emailVerify', email: userData.email.trim() });
            } else {
              onComplete('client');
            }
          }}
          onLogin={() => push({ id: 'login' })}
        />
      );
      break;

    // ── Configuration boutique (marchand uniquement) ───────────────────────
    case 'shopSetup':
      screen = (
        <MerchantShopSetupScreen
          userData={current.userData}
          onBack={pop}
          onComplete={onComplete}
          onCGU={openCGU}
          onConfidentialite={openConfidentialite}
        />
      );
      break;

    // ── Connexion ─────────────────────────────────────────────────────────────
    case 'login':
      screen = (
        <LoginScreen
          onBack={pop}
          onSuccess={async (phone, password) => {
            // Appel Supabase — peut rejeter (capturé par LoginScreen)
            const user = await authService.login({ phone, password });
            // Synchroniser le store local
            useAuthStore.getState().setUser(user);
            onComplete(user.role);
          }}
          onForgotPassword={() => push({ id: 'forgotPassword' })}
          onRegister={pop}
        />
      );
      break;

    // ── Vérification email ────────────────────────────────────────────────────
    case 'emailVerify': {
      const role = useAuthStore.getState().user?.role ?? 'client';
      screen = (
        <EmailVerifyScreen
          email={current.email}
          onBack={pop}
          onComplete={() => onComplete(role)}
        />
      );
      break;
    }

    // ── Mot de passe oublié ───────────────────────────────────────────────────
    case 'forgotPassword':
      screen = (
        <ForgotPasswordScreen
          onBack={pop}
          onLogin={pop}
        />
      );
      break;

    default: {
      const _exhaustive: never = current;
      screen = null;
    }
  }

  return (
    <>
      {screen}

      {/* CGU / Confidentialité en modal — l'écran en dessous reste monté */}
      <Modal
        visible={legalModal !== null}
        animationType="slide"
        onRequestClose={closeLegal}
      >
        {legalModal === 'cgu'
          ? <CGUScreen onBack={closeLegal} />
          : <ConfidentialiteScreen onBack={closeLegal} />
        }
      </Modal>
    </>
  );
}
