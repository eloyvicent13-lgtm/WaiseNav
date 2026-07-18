import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';

type GlassProps = ViewProps & {
  intensity?: number;
  radius?: number;
  /** Extra tint layered over the blur, e.g. 'rgba(16,122,87,0.55)' for the nav banner. */
  tintColor?: string;
};

/**
 * Liquid-glass surface: real BlurView underneath (iOS system material),
 * hairline border + faint white top sheen on top. All floating UI in the
 * app composes over this so the whole shell reads as one material.
 */
export default function Glass({
  children,
  style,
  intensity = 55,
  radius = 22,
  tintColor,
  ...rest
}: GlassProps) {
  return (
    <View style={[styles.shell, { borderRadius: radius }, style]} {...rest}>
      <BlurView
        tint="systemUltraThinMaterialDark"
        intensity={intensity}
        style={StyleSheet.absoluteFill}
      />
      {tintColor ? (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} pointerEvents="none" />
      ) : null}
      <View style={styles.sheen} pointerEvents="none" />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(10,14,20,0.25)',
  },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});
