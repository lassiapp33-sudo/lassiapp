import React, { useState } from 'react';
import RoleSelectScreen     from './auth/RoleSelectScreen';
import RegisterScreen       from './auth/RegisterScreen';
import LoginScreen          from './auth/LoginScreen';
import EmailVerifyScreen    from './auth/EmailVerifyScreen';
import ForgotPasswordScreen from './auth/ForgotPasswordScreen';
import useAuthStore         from '../store/authStore';

type Role = 'client' | 'merchant';

type StackItem =
  | { id: 'role' }
  | { id: 'register';      role: Role }
  | { id: 'login' }
  | { id: 'emailVerify';   email: string }
  | { id: 'forgotPassword' };

interface Props {
  onComplete: (role: Role) => void;
}

export default function AuthNavigator({ onComplete }: Props) {
  const [stack, setStack]               = useState<StackItem[]>([{ id: 'role' }]);
  const [selectedRole, setSelectedRole] = useState<Role>('client');

  const push = (item: StackItem) => setStack(prev => [...prev, item]);
  const pop  = ()                 => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const current = stack[stack.length - 1];

  switch (current.id) {

    case 'role':
      return (
        <RoleSelectScreen
          onSelectClient={() => {
            setSelectedRole('client');
            push({ id: 'register', role: 'client' });
          }}
          onSelectMerchant={() => {
            setSelectedRole('merchant');
            push({ id: 'register', role: 'merchant' });
          }}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          role={current.role}
          onBack={pop}
          onSuccess={(userData) => {
            // Enregistrer les données dans authStore
            useAuthStore.getState().login({
              name:  userData.name,
              phone: userData.phone,
              email: userData.email,
              role:  current.role,
            });
            if (userData.email) {
              push({ id: 'emailVerify', email: userData.email });
            } else {
              onComplete(current.role);
            }
          }}
          onLogin={() => push({ id: 'login' })}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onBack={pop}
          onSuccess={(phone) => {
            // TODO Phase 3 (backend): vérifier les identifiants + récupérer le profil serveur
            // En local : si un utilisateur existe déjà dans le store on le garde,
            // sinon on crée un profil minimal avec le numéro de téléphone
            const existing = useAuthStore.getState().user;
            if (!existing) {
              useAuthStore.getState().login({
                name:  phone,
                phone: phone,
                email: '',
                role:  selectedRole,
              });
            } else {
              // Ré-authentifier l'utilisateur existant
              useAuthStore.getState().login({ ...existing });
            }
            onComplete(selectedRole);
          }}
          onForgotPassword={() => push({ id: 'forgotPassword' })}
          onRegister={pop}
        />
      );

    case 'emailVerify':
      return (
        <EmailVerifyScreen
          email={current.email}
          onBack={pop}
          onComplete={() => onComplete(selectedRole)}
        />
      );

    case 'forgotPassword':
      return (
        <ForgotPasswordScreen
          onBack={pop}
          onLogin={pop}
        />
      );

    default: {
      const _exhaustive: never = current;
      return null;
    }
  }
}
