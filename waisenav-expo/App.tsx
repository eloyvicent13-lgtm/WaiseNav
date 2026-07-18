import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import ErrorBoundary from './src/components/ErrorBoundary';

// TEMPORARY bisection flag: real device shows a black screen with zero
// crash/hang report of any kind, meaning the failure may be happening
// before our React tree even mounts (native module init, bundle load).
// This bypasses AuthProvider/NavigationContainer/react-native-maps/every
// native module we use entirely. If THIS build also shows black, the bug
// is not in our code at all — it's Metro/Hermes/native linking. If it
// shows red text, the bug is somewhere in the real tree below and we can
// re-enable pieces one at a time. Flip back to false once diagnosed.
const DIAGNOSTIC_MODE = false;

const Stack = createNativeStackNavigator();

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

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {user ? (
        <Stack.Screen name="Navigation" component={NavigationScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
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
        <NavigationContainer>
          <StatusBar style="light" />
          <RootNavigator />
        </NavigationContainer>
      </AuthProvider>
    </ErrorBoundary>
  );
}
