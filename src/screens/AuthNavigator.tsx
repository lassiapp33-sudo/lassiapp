import React, { useState }        from 'react';
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
  | { id: 'forgotPassword' }
  | { id: 'cgu' }
  | { id: 'confidentialite' };

interface Props {
  onComplete: (role: Role) => void;
}

export default function AuthNavigator({ onComplete }: Props) {
  const [stack, setStack] = useState<StackItem[]>([{ id: 'role' }]);

  const push = (item: StackItem) => setStack(prev => [...prev, item]);
  const pop  = ()                 => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const current = stack[stack.length - 1];

  switch (current.id) {

    // ── Choix du rôle ─────────────────────────────────────────────────────────
    case 'role':
      return (
        <RoleSelectScreen
          onSelectClient={()   => push({ id: 'register', role: 'client'   })}
          onSelectMerchant={() => push({ id: 'register', role: 'merchant' })}
          onLogin={()          => push({ id: 'login' })}
        />
      );

    // ── Inscription ───────────────────────────────────────────────────────────
    case 'register':
      return (
        <RegisterScreen
          role={current.role}
          onBack={pop}
          onCGU={() => push({ id: 'cgu' })}
          onConfidentialite={() => push({ id: 'confidentialite' })}
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

    // ── Configuration boutique (marchand uniquement) ───────────────────────
    case 'shopSetup':
      return (
        <MerchantShopSetupScreen
          userData={current.userData}
          onBack={pop}
          onComplete={onComplete}
          onCGU={() => push({ id: 'cgu' })}
          onConfidentialite={() => push({ id: 'confidentialite' })}
        />
      );

    // ── Connexion ─────────────────────────────────────────────────────────────
    case 'login':
      return (
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

    // ── Vérification email ────────────────────────────────────────────────────
    case 'emailVerify': {
      const role = useAuthStore.getState().user?.role ?? 'client';
      return (
        <EmailVerifyScreen
          email={current.email}
          onBack={pop}
          onComplete={() => onComplete(role)}
        />
      );
    }

    // ── Mot de passe oublié ───────────────────────────────────────────────────
    case 'forgotPassword':
      return (
        <ForgotPasswordScreen
          onBack={pop}
          onLogin={pop}
        />
      );

    // ── CGU ───────────────────────────────────────────────────────────────────
    case 'cgu':
      return <CGUScreen onBack={pop} />;

    // ── Politique de confidentialité ──────────────────────────────────────────
    case 'confidentialite':
      return <ConfidentialiteScreen onBack={pop} />;

    default: {
      const _exhaustive: never = current;
      return null;
    }
  }
}
