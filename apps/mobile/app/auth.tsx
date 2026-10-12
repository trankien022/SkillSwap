import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { authClient } from '@/infrastructure/auth/native-client';
import { useSession } from '@/ui/hung/session';
import { s } from '@/ui/hung/styles';
const schools = [
  'Đại học FPT',
  'Đại học Khoa học Tự nhiên',
  'Đại học HUTECH',
  'Đại học Bách khoa TP.HCM',
  'Đại học Kinh tế TP.HCM',
  'Đại học Công nghệ Thông tin',
  'Đại học Tôn Đức Thắng',
];
export default function Auth() {
  const { reload } = useSession();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [school, setSchool] = useState('');
  const [picker, setPicker] = useState(false);
  const [remember, setRemember] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit() {
    if (busy) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Nhập địa chỉ email hợp lệ.');
      return;
    }
    if (password.length < 8) {
      setError('Mật khẩu cần ít nhất 8 ký tự.');
      return;
    }
    if (mode === 'register' && !name.trim()) {
      setError('Nhập họ và tên của bạn.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      await authClient.authenticate(
        mode,
        {
          email: email.trim(),
          password,
          ...(mode === 'register' ? { displayName: name.trim(), role: 'user' } : {}),
        },
        mode === 'login' && remember,
      );
      await reload();
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView style={s.page} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <Text style={s.brand}>SkillSwap</Text>
        <Text style={s.title}>
          {mode === 'login' ? 'Chào mừng trở lại' : 'Bắt đầu học cùng nhau'}
        </Text>
        <Text style={s.text}>Trao đổi kỹ năng. Kết nối sinh viên.</Text>
        <View style={s.row}>
          {(['login', 'register'] as const).map((value) => (
            <Pressable
              disabled={busy}
              key={value}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === value }}
              style={[s.chip, { flex: 1, alignItems: 'center' }, mode === value && s.selected]}
              onPress={() => {
                setMode(value);
                setError('');
              }}
            >
              <Text>{value === 'login' ? 'Đăng nhập' : 'Đăng ký'}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.card}>
          {mode === 'register' && (
            <>
              <Text style={s.text}>Họ và tên</Text>
              <TextInput
                editable={!busy}
                style={s.input}
                accessibilityLabel="Họ và tên"
                value={name}
                onChangeText={setName}
                placeholder="Nguyễn Minh Anh"
                autoComplete="name"
              />
            </>
          )}
          <Text style={s.text}>Email</Text>
          <TextInput
            editable={!busy}
            style={s.input}
            accessibilityLabel="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="ban@truong.edu.vn"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />
          <Text style={s.text}>Mật khẩu</Text>
          <View
            style={[
              s.input,
              { flexDirection: 'row', alignItems: 'center', paddingVertical: 0, paddingRight: 0 },
            ]}
          >
            <TextInput
              editable={!busy}
              style={{ flex: 1, minWidth: 0, fontSize: 16, paddingVertical: 12, color: '#0f172a' }}
              accessibilityLabel="Mật khẩu"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              placeholder="Ít nhất 8 ký tự"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
            <Pressable
              disabled={busy}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
              onPress={() => setShowPassword(!showPassword)}
              style={{ width: 52, minHeight: 48, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ color: '#475569', fontSize: 13, fontWeight: '600' }}>
                {showPassword ? 'Ẩn' : 'Hiện'}
              </Text>
            </Pressable>
          </View>
          {mode === 'register' && (
            <>
              <Text style={s.text}>Trường đại học (không bắt buộc)</Text>
              <Pressable disabled={busy} style={s.input} onPress={() => setPicker(true)}>
                <Text style={s.text}>{school || 'Chọn trường đại học'}</Text>
              </Pressable>
              <Text style={s.muted}>
                Lựa chọn này chưa được lưu vào tài khoản; API đăng ký chưa có trường đại học.
              </Text>
            </>
          )}
          {mode === 'login' && (
            <Pressable
              disabled={busy}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: remember }}
              style={s.chip}
              onPress={() => setRemember(!remember)}
            >
              <Text>{remember ? '☑' : '☐'} Ghi nhớ đăng nhập trong 30 ngày</Text>
            </Pressable>
          )}
          {mode === 'login' && Platform.OS === 'web' && (
            <Text style={s.muted}>
              Bản xem trước trên trình duyệt chỉ giữ phiên đến khi tải lại trang. Hãy thử ghi nhớ
              trên điện thoại.
            </Text>
          )}
          {error !== '' && (
            <Text accessibilityRole="alert" style={s.error}>
              {error}
            </Text>
          )}
          <Pressable
            disabled={busy}
            style={[s.button, busy && { opacity: 0.6 }]}
            onPress={() => void submit()}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={s.buttonText}>{mode === 'login' ? 'Đăng nhập' : 'Tạo tài khoản'}</Text>
            )}
          </Pressable>
          <Text style={s.muted}>
            Google / Microsoft học đường: chưa có API đăng nhập, hiện chưa hỗ trợ.
          </Text>
        </View>
        <View style={s.card}>
          <Text style={s.heading}>Học cùng cộng đồng sinh viên</Text>
          <Text style={s.text}>Xác thực danh tính · Ký quỹ an toàn · Học trực tuyến</Text>
          <Text style={s.muted}>
            “Mỗi người đều có một kỹ năng đáng để chia sẻ.” — Lời giới thiệu minh họa
          </Text>
        </View>
        <Modal
          visible={picker}
          transparent
          animationType="slide"
          onRequestClose={() => setPicker(false)}
        >
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#00000055' }}>
            <View style={s.card}>
              <Text style={s.heading}>Chọn trường</Text>
              <ScrollView style={{ maxHeight: 420 }}>
                {schools.map((value) => (
                  <Pressable
                    key={value}
                    style={s.chip}
                    onPress={() => {
                      setSchool(value);
                      setPicker(false);
                    }}
                  >
                    <Text style={s.text}>{value}</Text>
                  </Pressable>
                ))}
              </ScrollView>
              <Pressable style={s.button} onPress={() => setPicker(false)}>
                <Text style={s.buttonText}>Đóng</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
