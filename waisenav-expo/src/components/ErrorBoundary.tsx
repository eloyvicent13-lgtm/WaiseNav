import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';

type Props = { children: React.ReactNode };
type State = { error: Error | null };

/**
 * Production (Hermes/release) builds don't show React Native's red-box for
 * uncaught render errors — the screen just goes blank/black with nothing
 * logged anywhere visible. This boundary turns that into an actual visible
 * message so a crash is diagnosable from a screenshot instead of guesswork.
 */
export default class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          <Text style={styles.title}>WaiseNav se ha bloqueado</Text>
          <Text style={styles.message}>{this.state.error.message}</Text>
          {this.state.error.stack ? <Text style={styles.stack}>{this.state.error.stack}</Text> : null}
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b0f14' },
  content: { padding: 24, paddingTop: 64 },
  title: { color: '#ff453a', fontSize: 20, fontWeight: '800', marginBottom: 12 },
  message: { color: '#fff', fontSize: 15, marginBottom: 16 },
  stack: { color: '#9aa4af', fontSize: 11, fontFamily: 'Courier' },
});
