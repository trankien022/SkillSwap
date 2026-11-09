import React, { useState } from 'react';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/design/tokens';

export function DateTimeField({ value, minDate, locale, dateLabel, timeLabel, helper, invalidMessage, onChange }:{
  value: Date; minDate: Date; locale: string; dateLabel: string; timeLabel: string; helper: string; invalidMessage: string; onChange: (value: Date) => void;
}) {
  const [mode, setMode] = useState<'date' | 'time' | null>(null);
  const update = (_event: DateTimePickerEvent, picked?: Date) => {
    if (!picked) { setMode(null); return; }
    const next = new Date(value);
    if (mode === 'date') next.setFullYear(picked.getFullYear(), picked.getMonth(), picked.getDate());
    else next.setHours(picked.getHours(), picked.getMinutes(), 0, 0);
    setMode(null);
    if (next >= minDate) onChange(next);
    else Alert.alert(invalidMessage);
  };
  return <View style={styles.field}>
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={dateLabel} style={styles.button} onPress={() => setMode('date')}><Text style={styles.text}>{value.toLocaleDateString(locale)}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={timeLabel} style={styles.button} onPress={() => setMode('time')}><Text style={styles.text}>{value.toLocaleTimeString(locale, { hour:'2-digit', minute:'2-digit' })}</Text></Pressable>
    </View>
    <Text style={styles.helper}>{helper}</Text>
    {mode && <DateTimePicker value={value} mode={mode} display={Platform.OS === 'ios' ? 'compact' : 'default'} minimumDate={minDate} onChange={update} />}
  </View>;
}
const styles=StyleSheet.create({field:{gap:spacing.xs},row:{flexDirection:'row',gap:spacing.sm},button:{flex:1,minHeight:48,justifyContent:'center',paddingHorizontal:spacing.md,borderWidth:1,borderColor:colors.border,borderRadius:radius.control,backgroundColor:colors.surface},text:{color:colors.ink,fontSize:typography.body.fontSize},helper:{color:colors.inkMuted,fontSize:typography.caption.fontSize}});
