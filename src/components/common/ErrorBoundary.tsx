import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts, radius, spacing, TOP_INSET } from '../../theme';
import logger from '../../utils/logger';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Section 10 — Mode dégradé : filet de sécurité global. Si un écran plante
 * (ex : réponse Supabase inattendue pendant un rendu), on affiche un message
 * clair avec un bouton "Réessayer" au lieu d'un écran blanc / crash natif.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    logger.error('[ErrorBoundary]', error, info.componentStack);
  }

  handleRetry = (): void => this.setState({ hasError: false });

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <View style={styles.root}>
          <Text style={styles.title}>Oups, une erreur est survenue</Text>
          <Text style={styles.subtitle}>
            Quelque chose s'est mal passé. Vérifie ta connexion puis réessaie.
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleRetry} activeOpacity={0.85}>
            <Text style={styles.buttonText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.screen,
    paddingTop: TOP_INSET,
  },
  title: {
    color: colors.white,
    fontFamily: fonts.title,
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 10,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 24,
  },
  button: {
    backgroundColor: colors.accent,
    borderRadius: radius.pill,
    paddingHorizontal: 28,
    paddingVertical: 13,
  },
  buttonText: {
    color: colors.bg,
    fontFamily: fonts.title,
    fontSize: 14,
  },
});
