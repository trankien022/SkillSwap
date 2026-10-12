import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { classes } from '@/infrastructure/mock/hung-classes';
import { authClient } from '@/infrastructure/auth/native-client';
import { useSession } from '@/ui/hung/session';
import { s } from '@/ui/hung/styles';

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase();
export default function Explore() {
  const { user, ready, signOut } = useSession();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Tất cả');
  const [budget, setBudget] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  async function refresh() {
    if (!user) return;
    setRefreshing(true);
    setError('');
    try {
      setBalance((await authClient.balance()).availableCredits);
    } catch (e) {
      setError((e as Error).message);
      setBalance(null);
    } finally {
      setRefreshing(false);
    }
  }
  useEffect(() => {
    setBalance(null);
    void refresh();
  }, [user?.id]);
  const visible = classes.filter(
    (item) =>
      (category === 'Tất cả' || item.category === category) &&
      (!budget || item.price <= 70) &&
      normalize(`${item.title} ${item.teacher} ${item.school}`).includes(normalize(search)),
  );
  return (
    <SafeAreaView style={s.page}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={s.row}>
          <Text style={s.brand}>SkillSwap</Text>
          {!ready ? (
            <ActivityIndicator />
          ) : user ? (
            <Pressable
              style={s.chip}
              onPress={() =>
                void signOut().catch((e) =>
                  Alert.alert('Đã đăng xuất trên máy', (e as Error).message),
                )
              }
            >
              <Text>Đăng xuất</Text>
            </Pressable>
          ) : (
            <Pressable style={s.chip} onPress={() => router.push('/auth')}>
              <Text style={s.link}>Đăng nhập / Đăng ký</Text>
            </Pressable>
          )}
        </View>
        {user && (
          <View style={s.card}>
            <Text style={s.heading}>Chào {user.displayName}</Text>
            <Text style={s.text}>
              Số dư: {balance === null ? 'Chưa tải được' : `${balance} credit`}
            </Text>
            <Text style={s.muted}>Kéo xuống để cập nhật số dư.</Text>
            {error !== '' && (
              <Text accessibilityRole="alert" style={s.error}>
                {error}
              </Text>
            )}
          </View>
        )}
        <View>
          <Text style={s.title}>Học điều mới.{'\n'}Kết nối bạn giỏi.</Text>
          <Text style={s.text}>Khám phá kỹ năng từ cộng đồng sinh viên.</Text>
        </View>
        <TextInput
          accessibilityLabel="Tìm lớp học"
          style={s.input}
          placeholder="Tìm kỹ năng, người dạy, trường…"
          value={search}
          onChangeText={setSearch}
        />
        <View style={s.wrap}>
          {['Tất cả', 'Lập trình', 'Thiết kế', 'Ngoại ngữ', 'Âm nhạc'].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              accessibilityState={{ selected: category === value }}
              style={[s.chip, category === value && s.selected]}
              onPress={() => setCategory(value)}
            >
              <Text>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.wrap}>
          <View style={s.chip}>
            <Text>Hình thức: Trực tuyến</Text>
          </View>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityState={{ checked: budget }}
            style={[s.chip, budget && s.selected]}
            onPress={() => setBudget(!budget)}
          >
            <Text>{budget ? '✓ ' : ''}Giá ≤ 70 credit</Text>
          </Pressable>
        </View>
        <Text style={s.muted}>
          Dữ liệu mẫu • {visible.length} lớp học. Chưa nối API danh sách lớp.
        </Text>
        {visible.length === 0 && (
          <View style={s.card}>
            <Text style={s.heading}>Không tìm thấy lớp</Text>
            <Pressable
              onPress={() => {
                setSearch('');
                setCategory('Tất cả');
                setBudget(false);
              }}
              style={s.chip}
            >
              <Text>Xóa bộ lọc</Text>
            </Pressable>
          </View>
        )}
        {visible.map((item) => (
          <View key={item.id} style={s.card}>
            <Text style={s.badge}>{item.category} · Trực tuyến</Text>
            <Text style={s.heading}>{item.title}</Text>
            <View style={s.row}>
              <View style={s.avatar}>
                <Text style={s.heading}>{item.teacher.charAt(0)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.text}>{item.teacher}</Text>
                <Text style={s.muted}>{item.school}</Text>
              </View>
            </View>
            <Text style={s.muted}>{item.minutes} phút · Thông tin minh họa</Text>
            <View style={s.row}>
              <Text style={s.heading}>{item.price} credit</Text>
              <Pressable
                style={s.button}
                onPress={() =>
                  user
                    ? Alert.alert(
                        'Lớp minh họa',
                        'Chưa đặt lớp thật. Cần danh sách lớp có ID từ backend để nối API đặt lớp.',
                      )
                    : router.push('/auth')
                }
              >
                <Text style={s.buttonText}>Đặt lớp</Text>
              </Pressable>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}
