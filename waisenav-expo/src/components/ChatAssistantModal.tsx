import React, { useRef, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { sendChatMessage } from '../services/api';
import { MovementMode } from '../hooks/useMovementMode';
import { AssistantAction } from '../services/voiceAssistant';

type ChatMessage = { id: string; role: 'user' | 'assistant'; text: string };

type Props = {
  visible: boolean;
  onClose: () => void;
  location: { lat: number; lng: number };
  mode: MovementMode;
  onActions: (actions: AssistantAction[]) => void;
};

export default function ChatAssistantModal({ visible, onClose, location, mode, onActions }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const history = useRef<unknown[]>([]);

  async function handleSend() {
    const text = input.trim();
    if (!text || sending) return;

    setInput('');
    setMessages((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text }]);
    setSending(true);

    try {
      const result = await sendChatMessage(
        text,
        location,
        history.current,
        mode === 'driving' ? 'driving' : 'walking',
        false
      );

      history.current.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply_text });
      setMessages((prev) => [...prev, { id: `a-${Date.now()}`, role: 'assistant', text: result.reply_text }]);
      onActions(result.actions as AssistantAction[]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `e-${Date.now()}`, role: 'assistant', text: 'No he podido procesar eso, inténtalo de nuevo.' },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <BlurView tint="systemUltraThinMaterialDark" intensity={80} style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Asistente WaiseNav</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={22} color="#9aa4af" />
            </Pressable>
          </View>

          <FlatList
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.list}
            contentContainerStyle={{ paddingVertical: 8 }}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.assistantBubble]}>
                <Text style={styles.bubbleText}>{item.text}</Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>Pregúntame algo, ej: "busca un parking cerca"</Text>
            }
          />

          {sending && <ActivityIndicator color="#3b82f6" style={{ marginBottom: 8 }} />}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Escribe un mensaje..."
              placeholderTextColor="#6b7280"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={handleSend}
              returnKeyType="send"
            />
            <Pressable style={styles.sendButton} onPress={handleSend} disabled={sending}>
              <Ionicons name="send" size={18} color="#fff" />
            </Pressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: {
    backgroundColor: 'rgba(11,15,20,0.55)',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.25)',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    maxHeight: '75%',
    minHeight: '45%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  close: { color: '#9aa4af', fontSize: 20, paddingHorizontal: 8 },
  list: { flexGrow: 0 },
  empty: { color: '#6b7280', textAlign: 'center', marginTop: 24 },
  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, marginVertical: 4, maxWidth: '85%' },
  userBubble: { backgroundColor: '#3b82f6', alignSelf: 'flex-end' },
  assistantBubble: { backgroundColor: '#151b23', alignSelf: 'flex-start' },
  bubbleText: { color: '#fff', fontSize: 14 },
  inputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  input: {
    flex: 1,
    backgroundColor: '#151b23',
    color: '#fff',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginRight: 8,
  },
  sendButton: {
    backgroundColor: '#3b82f6',
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { color: '#fff', fontSize: 18 },
});
