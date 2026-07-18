import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import Glass from '../components/Glass';
import { useAuth } from '../context/AuthContext';

export default function LoginScreen() {
  const { login, register } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setBusy(true);
    try {
      if (isRegister) {
        await register(email.trim(), password);
      } else {
        await login(email.trim(), password);
      }
    } catch (err: any) {
      const message = err?.response?.data?.error || 'No se pudo completar la operación';
      Alert.alert('Error', message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>WaiseNav</Text>
      <Text style={styles.subtitle}>{isRegister ? 'Crea tu cuenta' : 'Inicia sesión'}</Text>

      <Glass style={styles.card} radius={24} intensity={45}>
      <TextInput
        style={styles.input}
        placeholder="Email"
        placeholderTextColor="#6b7280"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Contraseña"
        placeholderTextColor="#6b7280"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <Pressable style={styles.button} onPress={handleSubmit} disabled={busy}>
        <Text style={styles.buttonText}>{busy ? '...' : isRegister ? 'Registrarme' : 'Entrar'}</Text>
      </Pressable>

      <Pressable onPress={() => setIsRegister((v) => !v)}>
        <Text style={styles.switchText}>
          {isRegister ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
        </Text>
      </Pressable>
      </Glass>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#0b0f14' },
  title: { fontSize: 34, fontWeight: '800', color: '#fff', textAlign: 'center', letterSpacing: -0.5 },
  subtitle: { fontSize: 16, color: '#9aa4af', textAlign: 'center', marginBottom: 24 },
  card: { padding: 18 },
  input: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
  },
  button: { backgroundColor: '#0a84ff', borderRadius: 12, paddingVertical: 14, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '600', fontSize: 16 },
  switchText: { color: '#60a5fa', textAlign: 'center', marginTop: 16 },
});
