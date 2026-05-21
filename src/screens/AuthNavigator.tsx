import React, { useState } from 'react';
import RoleSelectScreen    from './auth/RoleSelectScreen';
import RegisterScreen      from './auth/RegisterScreen';
import LoginScreen         from './auth/LoginScreen';
import EmailVerifyScreen   from './auth/EmailVerifyScreen';
import ForgotPasswordScreen from './auth/ForgotPasswordScreen';

// Chaque entrée du stack porte son écran + ses données
type StackItem =
  | { id: 'role' }
  | { id: 'register';     role: 'client' | 'merchant' }
  | { id: 'login' }
  | { id: 'emailVerify';  email: string }
  | { id: 'forgotPassword' };

interface Props {
  onComplete: () => void;
}

export default function AuthNavigator({ onComplete }: Props) {
  const [stack, setStack] = useState<StackItem[]>([{ id: 'role' }]);

  const push = (item: StackItem) => setStack(prev => [...prev, item]);
  const pop  = ()                 => setStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev);

  const current = stack[stack.length - 1];

  switch (current.id) {

    case 'role':
      return (
        <RoleSelectScreen
          onSelectClient={()   => push({ id: 'register', role: 'client' })}
          onSelectMerchant={()  => push({ id: 'register', role: 'merchant' })}
        />
      );

    case 'register':
      return (
        <RegisterScreen
          role={current.role}
          onBack={pop}
          onSuccess={(email) => {
            // Si email fourni → vérification ; sinon → on va directement dans l'app
            if (email) push({ id: 'emailVerify', email });
            else onComplete();
          }}
          onLogin={() => push({ id: 'login' })}
        />
      );

    case 'login':
      return (
        <LoginScreen
          onBack={pop}
          onSuccess={onComplete}
          onForgotPassword={() => push({ id: 'forgotPassword' })}
          onRegister={pop}
        />
      );

    case 'emailVerify':
      return (
        <EmailVerifyScreen
          email={current.email}
          onBack={pop}
          onComplete={onComplete}
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
