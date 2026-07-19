import { installGlobalErrorCapture } from './src/utils/globalErrorCapture';
installGlobalErrorCapture();

import 'react-native-gesture-handler';
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, Text, ScrollView } from 'react-native';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import NavigationScreen from './src/screens/NavigationScreen';
import ErrorBoundary from './src/components/ErrorBoundary';
import { setGlobalErrorListener, getBufferedError } from './src/utils/globalErrorCapture';

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

function GlobalErrorScreen({ message }: { message: string }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#0b0f14' }} contentContainerStyle={{ padding: 24, paddingTop: 64 }}>
      <Text style={{ color: '#ff453a', fontSize: 20, fontWeight: '800', marginBottom: 16 }}>
        Error global capturado
      </Text>
      <Text style={{ color: '#fff', fontSize: 14, fontFamily: 'Courier' }}>{message}</Text>
    </ScrollView>
  );
}

export default function App() {
  const [globalError, setGlobalError] = useState<string | null>(() => getBufferedError());

  useEffect(() => {
    setGlobalErrorListener((message) => setGlobalError(message));
    return () => setGlobalErrorListener(null);
  }, []);

  if (globalError) {
    return <GlobalErrorScreen message={globalError} />;
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
