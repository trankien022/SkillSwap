import React, { useState } from 'react';
import { View, Text, Modal, StyleSheet, Pressable, TextInput, TouchableOpacity, Image } from 'react-native';
import { colors, spacing } from '@/design/tokens';
// Optional: expo-image-picker provides a nicer UX for picking images on device. If not installed, the "Use link" flow still works.
// To enable image picking, install: expo install expo-image-picker

type Props = {
  visible: boolean;
  onClose: () => void;
  onAdd: (payload: { title: string; issuer: string; imageUrl?: string; linkUrl?: string }) => void;
};

export function UploadCertificateModal({ visible, onClose, onAdd }: Props) {
  const [title, setTitle] = useState('');
  const [issuer, setIssuer] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);

  async function pickImage() {
    try {
      const mod = await import('expo-image-picker');
            const ImagePicker = mod as typeof import('expo-image-picker');
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync?.();
      if (permission?.granted === false) return;
      const result = await ImagePicker.launchImageLibraryAsync?.({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: false });
      if (result && !result.cancelled) {
        setImageUri(result.uri);
      }
    } catch (err: unknown) {
      // expo-image-picker not installed or permission denied — fall back silently to link input
      console.warn('Image picker error', err);
    }
  }

  function submit() {
    if (!title.trim()) return; // require a title
    const payload: { title: string; issuer: string; imageUrl?: string; linkUrl?: string } = { title: title.trim(), issuer: issuer.trim() || 'Unknown' };
    if (imageUri) payload.imageUrl = imageUri;
    if (linkUrl.trim()) payload.linkUrl = linkUrl.trim();
    onAdd(payload);
    // reset
    setTitle('');
    setIssuer('');
    setLinkUrl('');
    setImageUri(null);
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.wrap}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Thêm chứng chỉ chuyên môn</Text>

          <Text style={styles.label}>Tên bằng / chứng chỉ</Text>
          <TextInput value={title} onChangeText={setTitle} placeholder="Ví dụ: IELTS Speaking C1" style={styles.input} />

          <Text style={styles.label}>Tổ chức cấp</Text>
          <TextInput value={issuer} onChangeText={setIssuer} placeholder="Ví dụ: IDP, British Council" style={styles.input} />

          <Text style={[styles.label, { marginTop: 8 }]}>Ảnh bằng / Link (tùy chọn)</Text>

          {imageUri ? (
            <View style={styles.previewRow}>
              <Image source={{ uri: imageUri }} style={styles.previewImage} resizeMode="cover" />
              <TouchableOpacity style={styles.removeBtn} onPress={() => setImageUri(null)}>
                <Text style={styles.removeText}>Xóa</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.buttonsRow}>
              <Pressable style={styles.secondaryBtn} onPress={pickImage}>
                <Text style={styles.secondaryText}>Chọn ảnh</Text>
              </Pressable>
              <Text style={styles.orText}>Hoặc</Text>
              <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://..." style={[styles.input, { flex: 1 }]} />
            </View>
          )}

          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose}>
              <Text style={styles.cancelText}>Hủy</Text>
            </Pressable>
            <Pressable style={styles.confirmBtn} onPress={submit}>
              <Text style={styles.confirmText}>Thêm</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  sheet: { backgroundColor: '#fff', padding: spacing.md, borderTopLeftRadius: 16, borderTopRightRadius: 16 },
  title: { fontSize: 16, fontWeight: '700', marginBottom: spacing.sm },
  label: { fontSize: 12, color: colors.inkSoft, marginTop: 6 },
  input: { borderWidth: 1, borderColor: '#ECECEC', padding: 10, borderRadius: 10, marginTop: 6 },
  buttonsRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  secondaryBtn: { backgroundColor: '#F3F7F6', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  secondaryText: { color: colors.ink, fontWeight: '600' },
  orText: { marginHorizontal: 8, color: colors.inkSoft },
  previewRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  previewImage: { width: 88, height: 60, borderRadius: 8, marginRight: 12 },
  removeBtn: { padding: 8, backgroundColor: '#FFF1F2', borderRadius: 8 },
  removeText: { color: '#B91C1C', fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.md },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelText: { color: colors.inkSoft },
  confirmBtn: { backgroundColor: colors.campusEmerald, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 10 },
  confirmText: { color: '#fff', fontWeight: '700' },
});
