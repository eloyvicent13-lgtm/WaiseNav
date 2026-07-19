import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Text } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

const DIAGNOSTIC_MODE = false;

// BISECTION step 2: SecureStore was ruled out (identical crash persisted
// with it fully removed from the launch path). Same crash signature, same
// binary offsets both times — something else running unconditionally at
// launch. NavigationContainer/react-native-screens native stack is the
// next suspect (it inits native view controllers eagerly on mount).
// Bypassing react-navigation entirely here — direct conditional render,
// no Stack.Navigator, no NavigationContainer.
function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0b0f14' }}>
        <ActivityIndicator color="#3b82f6" size="large" />
        <Text style={{ color: '#fff', marginTop: 16, fontSize: 15 }}>Cargando WaiseNav...</Text>
      </View>
    );
  }

  return user ? <NavigationScreen /> : <LoginScreen />;
}

function DiagnosticScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#b91c1c', padding: 24 }}>
      <Text style={{ color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center' }}>
        DIAGNOSTIC BUILD OK
      </Text>
      <Text style={{ color: '#fff', fontSize: 14, textAlign: 'center', marginTop: 12 }}>
        JS bundle loaded and rendered successfully with zero app code
        involved. If you see this, the black screen bug is inside
        AuthProvider, NavigationContainer, or a native module — not the
        bundle/Hermes/build pipeline itself.
      </Text>
    </View>
  );
}

export default function App() {
  if (DIAGNOSTIC_MODE) {
    return <DiagnosticScreen />;
  }

  return (
    <ErrorBoundary>
      <AuthProvider>
        <StatusBar style="light" />
        <RootNavigator />
      </AuthProvider>
    </ErrorBoundary>
  );
}
