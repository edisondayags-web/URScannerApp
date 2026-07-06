import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Modal, Alert, Linking,
  SafeAreaView, StatusBar, ScrollView, ImageBackground, Dimensions,
  Platform, TextInput, ActivityIndicator,
} from 'react-native';
import { Camera, useCameraDevices, useCameraPermission, useCodeScanner, CameraDeviceFormat } from 'react-native-vision-camera';
import { MMKV } from 'react-native-mmkv';
import { FlashList } from '@shopify/flash-list';
import NetInfo from '@react-native-community/netinfo';
import HapticFeedback from 'react-native-haptic-feedback';
import LinearGradient from 'react-native-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import MaterialIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { LineChart } from 'react-native-chart-kit'; // ITEM 1: RE-ENABLED
import Animated, {
  useSharedValue, withTiming, withRepeat, useAnimatedStyle, Easing,
  cancelAnimation, runOnJS, FadeIn, FadeOut,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import DeviceInfo from 'react-native-device-info';
// import JailMonkey from 'jail-monkey'; // STAYS DISABLED (not in "need back" list)

import { Canvas, RRect, RadialGradient, vec, Shadow, Image as SkImage, useImage } from '@shopify/react-native-skia';

// Sentry / AppCheck / Play Integrity stay disabled — hindi kasama sa list mo.
// import * as Sentry from '@sentry/react-native'; // DISABLED

//import firebase from '@react-native-firebase/app';
//import firestore from '@react-native-firebase/firestore';
//import analytics from '@react-native-firebase/analytics';
//import crashlytics from '@react-native-firebase/crashlytics';
// import appCheck from '@react-native-firebase/app-check'; // DISABLED
// import { check, IntegrityErrorCode } from 'react-native-play-integrity'; // DISABLED

import {
  FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
} from '@env';

const { width, height } = Dimensions.get('window');
const storage = new MMKV();

// Safe fallback background image (ITEM 14: ginagamit na sa Settings/QRList/LiveStats screens sa baba)
let bgImage: any;
try {
  bgImage = require('./assets/hoodie-bg.png');
} catch {
  bgImage = { uri: 'https://via.placeholder.com/500' };
}

let scanSuccessAnimation: any;
try {
  scanSuccessAnimation = require('./assets/scan-success.json');
} catch {
  scanSuccessAnimation = null;
}

function triggerHaptic(style: 'light' | 'heavy' = 'light') {
  try {
    HapticFeedback.trigger(style === 'heavy' ? 'impactHeavy' : 'impactLight');
  } catch {}
}

//if (!firebase.apps.length) {
//  firebase.initializeApp({
  //  apiKey: FIREBASE_API_KEY,
//    authDomain: FIREBASE_AUTH_DOMAIN,
    //projectId: FIREBASE_PROJECT_ID,
   // storageBucket: FIREBASE_STORAGE_BUCKET,
   // messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  //  appId: FIREBASE_APP_ID,
  //});
  // App Check (Play Integrity) stays disabled for now
  // if (!__DEV__) {
  //   appCheck().initializeAppCheck({
  //     provider: appCheck.PlayIntegrityAppCheckProvider,
  //     isTokenAutoRefreshEnabled: true,
  //   });
  // }
//}

const db = firestore();
const Crashlytics = {
  log: (msg: string) => {
    if (__DEV__) console.log('[LOG]', msg);
    crashlytics().log(msg);
  },
  recordError: (err: Error) => {
    if (__DEV__) console.error('[ERROR]', err);
    crashlytics().recordError(err);
  },
  setUserId: (id: string) => {
    crashlytics().setUserId(id);
  },
};

const brandPink = '#FF4D8D';
const PINK = '#FF2E88';
const CARD_W = (width - 48) / 3;
const CARD_H = CARD_W + 50;
const RADIUS = 22;

// ============================================================
// ITEM 10: 4 E-WALLETS LANG ANG ACTIVE. Yung 26 banks/wallets
// nasa ibaba, commented out lang — i-uncomment mo na lang pag
// ready ka na i-enable ulit sila. Walang binura, safe lahat.
// ============================================================
const WALLETS = [
  { name: 'GCash', glow: '#3A86FF', deeplink: 'gcash://qrcode/scan', fallback: 'https://www.gcash.com', store: 'com.globe.gcash.android', logo: require('./assets/gcash.png') },
  { name: 'Maya', glow: '#00F5A0', deeplink: 'maya://qr', fallback: 'https://www.maya.ph', store: 'com.paymaya', logo: require('./assets/maya.png') },
  { name: 'ShopeePay', glow: '#FF3D00', deeplink: 'shopee://', fallback: 'https://shopee.ph', store: 'com.shopee.ph', logo: require('./assets/shopee.png') },
  { name: 'GrabPay', glow: '#00F5A0', deeplink: 'grab://', fallback: 'https://www.grab.com/ph/pay/', store: 'com.grabtaxi.passenger', logo: require('./assets/grab.png') },

  // ---------- DISABLED FOR NOW (26) — i-uncomment pag okay na ----------
  // { name: 'Coins.ph', glow: '#FF8C00', deeplink: 'coins://', fallback: 'https://coins.ph', store: 'coins.ph', logo: require('./assets/coins.png') },
  // { name: 'Starpay', glow: '#9D4EDD', deeplink: 'starpay://', fallback: 'https://starpay.com.ph', store: 'ph.starpay.app', logo: require('./assets/starpay.png') },
  // { name: 'BDO', glow: '#3A86FF', deeplink: 'bdo://', fallback: 'https://www.bdo.com.ph/personal/digital-banking/mobile-banking', store: 'com.bdo.unibank', logo: require('./assets/bdo.png') },
  // { name: 'BPI', glow: '#FF3D00', deeplink: 'bpi://', fallback: 'https://www.bpi.com.ph/personal/bank/online', store: 'com.bpi.mobile', logo: require('./assets/bpi.png') },
  // { name: 'Metrobank', glow: '#3A86FF', deeplink: 'metrobank://', fallback: 'https://metrobank.com.ph', store: 'com.metrobank.mobile', logo: require('./assets/metro.png') },
  // { name: 'UnionBank', glow: '#FF8C00', deeplink: 'unionbank://', fallback: 'https://www.unionbankph.com', store: 'com.unionbank.ph', logo: require('./assets/union.png') },
  // { name: 'PNB', glow: '#9D4EDD', deeplink: 'pnb://', fallback: 'https://www.pnb.com.ph', store: 'com.pnb.mobile', logo: require('./assets/pnb.png') },
  // { name: 'RCBC', glow: '#3A86FF', deeplink: 'rcbc://', fallback: 'https://www.rcbc.com', store: 'com.rcbc.mobile', logo: require('./assets/rcbc.png') },
  // { name: 'Security Bank', glow: '#00F5A0', deeplink: 'securitybank://', fallback: 'https://www.securitybank.com', store: 'com.securitybank.mobile', logo: require('./assets/security.png') },
  // { name: 'Chinabank', glow: '#FF3D00', deeplink: 'chinabank://', fallback: 'https://www.chinabank.ph', store: 'com.chinabank.mobile', logo: require('./assets/china.png') },
  // { name: 'Landbank', glow: '#00F5A0', deeplink: 'landbank://', fallback: 'https://www.landbank.com', store: 'com.landbank.mobile', logo: require('./assets/landbank.png') },
  // { name: 'PSBank', glow: '#FF8C00', deeplink: 'psbank://', fallback: 'https://www.psbank.com.ph', store: 'com.psbank.mobile', logo: require('./assets/psbank.png') },
  // { name: 'EastWest Bank', glow: '#9D4EDD', deeplink: 'eastwest://', fallback: 'https://www.eastwestbanker.com', store: 'com.eastwestbank.mobile', logo: require('./assets/eastwest.png') },
  // { name: 'AUB', glow: '#3A86FF', deeplink: 'aub://', fallback: 'https://www.aub.com.ph', store: 'com.aub.mobile', logo: require('./assets/aub.png') },
  // { name: 'DBP', glow: '#00F5A0', deeplink: 'dbp://', fallback: 'https://www.dbp.ph', store: 'com.dbp.mobile', logo: require('./assets/dbp.png') },
  // { name: 'Maybank', glow: '#FF3D00', deeplink: 'maybank://', fallback: 'https://www.maybank2u.com.ph', store: 'com.maybank2u.mobile', logo: require('./assets/maybank.png') },
  // { name: 'UCPB', glow: '#9D4EDD', deeplink: 'ucpb://', fallback: 'https://www.ucpb.com', store: 'com.ucpb.mobile', logo: require('./assets/ucpb.png') },
  // { name: 'CIMB Bank', glow: '#FF3D00', deeplink: 'cimb://', fallback: 'https://www.cimbbank.com.ph', store: 'com.cimb.octo', logo: require('./assets/cimb.png') },
  // { name: 'TONIK', glow: '#00F5A0', deeplink: 'tonik://', fallback: 'https://tonikbank.com', store: 'com.tonik.mobile', logo: require('./assets/tonik.png') },
  // { name: 'ING Bank', glow: '#FF8C00', deeplink: 'ing://', fallback: 'https://ing.com.ph', store: 'com.ing.mobile', logo: require('./assets/ing.png') },
  // { name: 'Robinsons Bank', glow: '#3A86FF', deeplink: 'robinsons://', fallback: 'https://www.robinsonsbank.com.ph', store: 'com.robinsonsbank.mobile'
  // { name: 'Bank of Commerce', glow: '#FF3D00', deeplink: 'bankcom://', fallback: 'https://www.bankcom.com.ph', store: 'com.bankcom.mobile'
  // { name: 'PBCOM', glow: '#9D4EDD', deeplink: 'pbcom://', fallback: 'https://www.pbcom.com.ph', store: 'com.pbcom.mobile'
  // { name: 'BOC', glow: '#FF8C00', deeplink: 'boc://', fallback: 'https://www.boc.com.ph', store: 'com.boc.mobile' 
  // { name: 'Sterling Bank', glow: '#00F5A0', deeplink: 'sterling://', fallback: 'https://www.sterlingbankasia.com', store: 'com.sterling.mobile'
  // { name: 'Malayan Bank', glow: '#3A86FF', deeplink: 'malayan://', fallback: 'https://www.malayanbank.com', store: 'com.malayan.mobile'
];

const WALLET_MAP = new Map(WALLETS.map((w) => [w.name, w]));

const FIREWALL = { MIN_INTERVAL_MS: 5000, MAX_DAILY_CLICKS: 100, DAILY_KEY: 'daily_clicks', DAILY_DATE_KEY: 'daily_clicks_date', LAST_CLICK_KEY: 'lastClickTime' };
const MAX_QR_HISTORY = 100;

async function firewallAllow() {
  const now = Date.now();
  try {
    const lastClick = storage.getString(FIREWALL.LAST_CLICK_KEY);
    const savedDate = storage.getString(FIREWALL.DAILY_DATE_KEY);
    const dailyClicksRaw = storage.getString(FIREWALL.DAILY_KEY);
    if (lastClick && now - parseInt(lastClick, 10) < FIREWALL.MIN_INTERVAL_MS) {
      Alert.alert('Dahan-dahan lang', 'Maghintay ng 5 segundo bago ulit mag-select.');
      return false;
    }
    const today = new Date().toISOString().slice(0, 10);
    let dailyClicks = parseInt(dailyClicksRaw || '0', 10);
    if (savedDate !== today) { dailyClicks = 0; storage.set(FIREWALL.DAILY_DATE_KEY, today); }
    if (dailyClicks >= FIREWALL.MAX_DAILY_CLICKS) { Alert.alert('Daily limit reached', 'Bumalik bukas.'); return false; }
    storage.set(FIREWALL.LAST_CLICK_KEY, now.toString());
    storage.set(FIREWALL.DAILY_KEY, (dailyClicks + 1).toString());
    return true;
  } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); return true; }
}

function getEMVTag(data: string, tag: string): string | null {
  let i = 0;
  const len_ = data.length;
  while (i < len_ - 4) {
    const id = data.substr(i, 2);
    const len = parseInt(data.substr(i + 2, 2), 10);
    if (isNaN(len)) break;
    if (id === tag) return data.substr(i + 4, len);
    i += 4 + len;
  }
  return null;
}

function extractMerchantName(qrData: string): string {
  try {
    const name = getEMVTag(qrData, '59');
    return name && name.trim() ? name.trim() : 'Merchant';
  } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); return 'Merchant'; }
}

const CRC_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n << 8;
    for (let k = 0; k < 8; k++) { c = (c & 0x8000) ? ((c << 1) ^ 0x1021) : (c << 1); }
    table[n] = c & 0xffff;
  }
  return table;
})();

function crc16ccitt(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    const idx = ((crc >> 8) ^ data.charCodeAt(i)) & 0xff;
    crc = ((crc << 8) ^ CRC_TABLE[idx]) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, '0');
}

function isValidQRPH(data: string): boolean {
  if (!data || data.length > 1024 || data.length < 10) return false;
  try {
    if (!data.startsWith('000201')) return false;
    if (getEMVTag(data, '63') === null) return false;
    const payloadWithoutCrc = data.slice(0, -4);
    const declaredCrc = data.slice(-4).toUpperCase();
    const computedCrc = crc16ccitt(payloadWithoutCrc + '6304');
    if (declaredCrc !== computedCrc) return false;
    if (getEMVTag(data, '58') !== 'PH') return false;
    if (getEMVTag(data, '53') !== '608') return false;
    return true;
  } catch { return false; }
}

type TimeFilter = 'Today' | '7 Days' | '30 Days' | 'All Time';
type MerchantUI = { rank: number; name: string; scans: number; color: string; pct: string; };
type QRHistoryItem = { name: string; data: string; date: string; };
type SortType = 'newest' | 'oldest' | 'merchant';

const PinkFadeText: React.FC<{ children: React.ReactNode; style?: any; size?: number; weight?: any; spacing?: number; }> = ({ children, style, size = 16, weight = '500', spacing = 0 }) => (
  <LinearGradient colors={['#FF4D8D', '#000']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={style}>
    <Text style={[styles.gradientText, { fontSize: size, fontWeight: weight, letterSpacing: spacing }]}>{children}</Text>
  </LinearGradient>
);

const PinkFadeIcon: React.FC<{ children: React.ReactNode; bgColor?: string; }> = ({ children, bgColor = '#FF4D8D' }) => (
  <LinearGradient colors={[bgColor, '#000']} style={[styles.iconGradient, { borderRadius: 20 }]}>
    {children}
  </LinearGradient>
);

const MerchantRow: React.FC<{ item: MerchantUI }> = React.memo(({ item }) => (
  <View style={styles.merchantRow}>
    <Text style={styles.rank}>{item.rank}</Text>
    <PinkFadeIcon bgColor={item.color}><Text style={styles.merchantIcon}>{item.name[0]}</Text></PinkFadeIcon>
    <View style={{ flex: 1 }}><Text style={styles.merchantName}>{item.name}</Text><Text style={styles.merchantSub}>{item.scans} scans</Text></View>
    <View style={styles.barBg}><View style={[styles.bar, { width: item.pct as any }]} /></View>
    <Text style={styles.pct}>{item.pct}</Text>
    <Icon name="chevron-forward" size={18} color="#666" />
  </View>
));

const NeonCard = ({ glowColor }: { glowColor: string }) => {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <RRect x={0} y={0} width={CARD_W} height={CARD_H} r={RADIUS} color="#0A0A0A">
        <RRect x={0.75} y={0.75} width={CARD_W - 1.5} height={CARD_H - 1.5} r={RADIUS - 1} color="transparent" style="stroke" strokeWidth={1.5}>
          <RadialGradient c={vec(CARD_W / 2, CARD_H / 2)} r={CARD_W * 0.8} colors={[glowColor + 'FF', glowColor + '30', 'transparent']} />
          <Shadow dx={0} dy={0} blur={30} color={glowColor + 'AA'} />
        </RRect>
      </RRect>
    </Canvas>
  );
};

const WalletItem = ({ item, onPress }: { item: any, onPress: (i: any) => void }) => {
  const scale = useSharedValue(1);
  const logo = useImage(item.logo);

  const onPressIn = () => { scale.value = withTiming(0.95, { duration: 80 }); HapticFeedback.trigger('impactLight'); };
  const onPressOut = () => { scale.value = withTiming(1, { duration: 120, easing: Easing.out(Easing.quad) }); };
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[styles.cardWrap, style]}>
      <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut} onPress={() => onPress(item)}>
        <NeonCard glowColor={item.glow} />
        <View style={styles.cardContent}>
          {logo && <Canvas style={styles.logoCanvas}><SkImage image={logo} fit="contain" x={0} y={0} width={56} height={56} /></Canvas>}
          <Text style={styles.name}>{item.name}</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

const WalletSelectScreen = ({ onSelect, onClose }: { onSelect: (w: any) => void, onClose: () => void }) => {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const data = useMemo(() => WALLETS.filter(w => w.name.toLowerCase().includes(query.toLowerCase())), [query]);

  const glow = useSharedValue(0);
  useEffect(() => { glow.value = withRepeat(withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.sin) }), -1, true); }, []);
  const searchStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.5 + glow.value * 0.3, borderColor: PINK }));

  return (
    <View style={styles.walletSelectContainer}>
      <View style={styles.walletHeader}>
        <Text style={styles.title}>SELECT <Text style={{ color: PINK }}>YOUR</Text> PREFERRED</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeWalletBtn}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.searchBox, searchStyle]}>
        <Icon name="search" size={22} color={PINK} />
        <TextInput style={styles.searchInput} placeholder="Search e-wallet" placeholderTextColor="#666" value={query} onChangeText={setQuery} />
      </Animated.View>

      <FlashList
        data={showAll ? data : data.slice(0, 12)}
        renderItem={({ item }) => <WalletItem item={item} onPress={onSelect} />}
        keyExtractor={(item) => item.name}
        numColumns={3}
        estimatedItemSize={CARD_H}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      />

      {!showAll && data.length > 12 && (
        <TouchableOpacity style={styles.seeAll} onPress={() => setShowAll(true)}>
          <Text style={styles.seeAllText}>SEE ALL</Text>
          <Icon name="chevron-down" size={22} color={PINK} />
        </TouchableOpacity>
      )}
    </View>
  );
};

// ITEM 12/13/2/3: Live Stats screen — gumagamit ng LineChart + live_stats/presence onSnapshot data mula sa App()
const LiveStatsScreen = ({
  onClose, liveStats, onlineUsers, chartData, timeFilter, setTimeFilter, lastUpdated,
}: {
  onClose: () => void; liveStats: Record<string, number>; onlineUsers: number;
  chartData: any; timeFilter: TimeFilter; setTimeFilter: (t: TimeFilter) => void; lastUpdated: string;
}) => {
  const filters: TimeFilter[] = ['Today', '7 Days', '30 Days', 'All Time'];
  const merchants: MerchantUI[] = useMemo(() => {
    const total = liveStats.total_app_select_clicks || 0;
    return WALLETS.map((w, i) => {
      const scans = liveStats['selected_' + w.name.replace(/\s/g, '_')] || liveStats['selected_' + w.name.replace(/\s/g, '')] || 0;
      const pct = total > 0 ? Math.round((scans / total) * 100) : 0;
      return { rank: i + 1, name: w.name, scans, color: w.glow, pct: pct + '%' };
    }).sort((a, b) => b.scans - a.scans);
  }, [liveStats]);

  return (
    <ImageBackground source={bgImage} style={styles.container} imageStyle={styles.bg}>
      <LinearGradient colors={['#000000F5', '#000000ED']} style={StyleSheet.absoluteFill} />
      <ScrollView style={{ flex: 1, padding: 20 }} showsVerticalScrollIndicator={false}>
        <View style={styles.statsHeaderRow}>
          <PinkFadeText style={styles.statsTitle} size={20} weight="700">Live Stats</PinkFadeText>
          <TouchableOpacity onPress={onClose}><Icon name="close" size={26} color="#fff" /></TouchableOpacity>
        </View>
        <Text style={styles.onlineText}>🟢 {onlineUsers} online now</Text>
        <Text style={styles.lastUpdatedText}>Last updated: {lastUpdated}</Text>

        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity key={f} onPress={() => setTimeFilter(f)} style={[styles.filterChip, timeFilter === f && styles.filterChipActive]}>
              <Text style={[styles.filterChipText, timeFilter === f && styles.filterChipTextActive]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ITEM 1 & 7: LineChart restored */}
        <LineChart
          data={chartData}
          width={width - 40}
          height={200}
          chartConfig={{
            backgroundColor: '#0A0A0A',
            backgroundGradientFrom: '#0A0A0A',
            backgroundGradientTo: '#1A1A1A',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(255, 46, 136, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          }}
          bezier
          style={{ borderRadius: 16, marginVertical: 12 }}
        />

        <Text style={styles.sectionLabel}>Top Merchants</Text>
        {merchants.slice(0, 5).map((m) => <MerchantRow key={m.name} item={m} />)}
      </ScrollView>
    </ImageBackground>
  );
};

const QRListScreen = ({ data, onClose, onSelectQR }: { data: QRHistoryItem[], onClose: () => void, onSelectQR: (qr: string) => void }) => {
  return (
    <ImageBackground source={bgImage} style={styles.container} imageStyle={styles.bg}>
      <LinearGradient colors={['#000000F0', '#000000E0']} style={StyleSheet.absoluteFill} />
      <View style={styles.qrListHeader}>
        <PinkFadeText size={20} weight="700">QR History</PinkFadeText>
        <TouchableOpacity onPress={onClose}><Icon name="close" size={26} color="#fff" /></TouchableOpacity>
      </View>
      {data.length === 0 ? (
        <View style={styles.emptyState}>
          <Icon name="qr-code-outline" size={60} color={PINK} />
          <Text style={styles.emptyText}>No QR codes saved yet</Text>
        </View>
      ) : (
        <FlashList
          data={data}
          keyExtractor={(item, idx) => item.data + idx}
          estimatedItemSize={70}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onSelectQR(item.data)} style={styles.qrItem}>
              <Icon name="qr-code" size={22} color={PINK} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.qrMerchant}>{item.name}</Text>
                <Text style={styles.qrDate}>{new Date(item.date).toLocaleDateString()}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>
          )}
        />
      )}
    </ImageBackground>
  );
};

const SettingsScreen = ({ onClose, onShowLiveStats, onShowAbout, onShowPrivacy }: {
  onClose: () => void; onShowLiveStats: () => void; onShowAbout: () => void; onShowPrivacy: () => void;
}) => {
  const items = [
    { icon: 'bar-chart-outline', lib: Icon, title: 'Live Stats', subtitle: 'Real-time scan stats', onPress: onShowLiveStats },
    { icon: 'shield-lock-outline', lib: MaterialIcon, title: 'Privacy Policy', subtitle: 'How we handle your data', onPress: onShowPrivacy },
    { icon: 'information', lib: MaterialIcon, title: 'About UR Scanner', subtitle: 'App info & developer', onPress: onShowAbout },
  ];
  return (
    <ImageBackground source={bgImage} style={styles.container} imageStyle={styles.bg}>
      <LinearGradient colors={['#000000F5', '#000000ED']} style={StyleSheet.absoluteFill} />
      <View style={styles.qrListHeader}>
        <PinkFadeText size={20} weight="700">Settings</PinkFadeText>
        <TouchableOpacity onPress={onClose}><Icon name="close" size={26} color="#fff" /></TouchableOpacity>
      </View>
      <ScrollView style={{ padding: 20 }}>
        {items.map((item, idx) => {
          const IconComp = item.lib;
          return (
            <TouchableOpacity key={idx} onPress={item.onPress} style={styles.settingsCard}>
              <PinkFadeIcon><IconComp name={item.icon} size={22} color="#fff" /></PinkFadeIcon>
              <View style={{ marginLeft: 14, flex: 1 }}>
                <Text style={styles.settingsCardTitle}>{item.title}</Text>
                <Text style={styles.settingsCardSubtitle}>{item.subtitle}</Text>
              </View>
              <Icon name="chevron-forward" size={18} color="#666" />
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </ImageBackground>
  );
};

const AboutScreen = ({ onClose }: { onClose: () => void }) => (
  <ImageBackground source={bgImage} style={styles.container} imageStyle={styles.bg}>
    <LinearGradient colors={['#000000F5', '#000000ED']} style={StyleSheet.absoluteFill} />
    <View style={styles.qrListHeader}>
      <PinkFadeText size={20} weight="700">About</PinkFadeText>
      <TouchableOpacity onPress={onClose}><Icon name="close" size={26} color="#fff" /></TouchableOpacity>
    </View>
    <ScrollView style={{ padding: 20 }}>
      <Text style={styles.aboutText}>
        UR Scanner is a QRPH reader that redirects you to your chosen e-wallet or bank app. It does not process
        payments, store funds, or hold user money — clicks only, not confirmed payment.
      </Text>
      <Text style={[styles.aboutText, { marginTop: 20 }]}>Developer: EDISON SUCLATAN DAYAGUIT</Text>
      <Text style={styles.aboutText}>San Antonio Adtuyon, Pangantucan, Bukidnon</Text>
    </ScrollView>
  </ImageBackground>
);

const PrivacyScreen = ({ onClose }: { onClose: () => void }) => (
  <ImageBackground source={bgImage} style={styles.container} imageStyle={styles.bg}>
    <LinearGradient colors={['#000000F5', '#000000ED']} style={StyleSheet.absoluteFill} />
    <View style={styles.qrListHeader}>
      <PinkFadeText size={20} weight="700">Privacy Policy</PinkFadeText>
      <TouchableOpacity onPress={onClose}><Icon name="close" size={26} color="#fff" /></TouchableOpacity>
    </View>
    <ScrollView style={{ padding: 20 }}>
      <Text style={styles.aboutText}>
        We do not collect personal information such as name, email, or phone number. We only collect anonymous
        analytics data (scan counts, device info) to improve the app. We do not share your data with third parties.
      </Text>
    </ScrollView>
  </ImageBackground>
);

// ITEM 16: Explicit "Allow Camera" permission screen — dati, blangkong black screen lang pag walang permission
const PermissionScreen = ({ onRequest }: { onRequest: () => void }) => (
  <View style={[styles.container, styles.permissionContainer]}>
    <MaterialIcon name="camera-off-outline" size={64} color={PINK} />
    <Text style={styles.permissionTitle}>Camera Access Needed</Text>
    <Text style={styles.permissionText}>UR Scanner needs your camera para ma-scan ang QRPH codes.</Text>
    <TouchableOpacity onPress={onRequest} style={styles.allowCameraBtn}>
      <LinearGradient colors={[PINK, '#000']} style={styles.allowCameraGradient}>
        <Text style={styles.allowCameraText}>Allow Camera</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices();
  const device = devices.find((d) => d.position === 'back');

  // ITEM 9: 4K -> 1080p (mas mababang chance mag-crash sa mas lumang devices)
  const format: CameraDeviceFormat | undefined = useMemo(() => {
    if (!device) return undefined;
    return device.formats
      .filter(f => f.videoWidth >= 1920 && f.videoHeight >= 1080)
      .sort((a, b) => a.videoWidth - b.videoWidth)[0] || device.formats[0];
  }, [device]);

  const fps: number = useMemo(() => {
    if (!format) return 30;
    return format.maxFps >= 30 ? 30 : format.maxFps;
  }, [format]);

  const [showSettings, setShowSettings] = useState(false);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showAbout, setShowAbout] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showQRList, setShowQRList] = useState(false);
  const [showWalletSelect, setShowWalletSelect] = useState(false);
  const [showLoadingWallet, setShowLoadingWallet] = useState(false);
  const [currentQR, setCurrentQR] = useState<string | null>(null);
  const [savedQRs, setSavedQRs] = useState<QRHistoryItem[]>([]);
  const [liveStats, setLiveStats] = useState<Record<string, number>>({});
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('Today');
  const [lastUpdated, setLastUpdated] = useState(new Date().toLocaleString());
  const [torchOn, setTorchOn] = useState(false);
  const [chartData, setChartData] = useState({ labels: ['No Data'], datasets: [{ data: [0] }] });
  const [onlineUsers, setOnlineUsers] = useState(0);

  const scanLockRef = useRef(false);
  const lastScannedDataRef = useRef('');
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const scale = useSharedValue(1);
  const scanSuccessScale = useSharedValue(0);
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    isMountedRef.current = true;

    if (DeviceInfo.isEmulatorSync()) {
      Alert.alert('Emulator Detected', 'Please use a physical device.');
    }

    (async () => {
      if (!hasPermission) await requestPermission();
      loadSavedQRs();
      Crashlytics.setUserId(DeviceInfo.getUniqueIdSync());
      Crashlytics.log('UR Scanner launched');
      await analytics().logEvent('app_open'); // ITEM 5: RE-ENABLED
      retryPendingUploads(); // ITEM 6: RE-ENABLED
    })();

    scale.value = withRepeat(withTiming(1.05, { duration: 5000, easing: Easing.inOut(Easing.sin) }), -1, true);
    const unsubscribeNetInfo = NetInfo.addEventListener(state => { if (state.isConnected) retryPendingUploads(); });

    return () => {
      isMountedRef.current = false;
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      cancelAnimation(scale);
      cancelAnimation(scanSuccessScale);
      unsubscribeNetInfo();
    };
  }, []);

  // ITEM 2, 3, 4, 12, 13: live_stats + presence onSnapshot RE-ENABLED
  useEffect(() => {
    const unsubStats = db.collection('live_stats').doc('summary').onSnapshot(
      (snap) => { if (isMountedRef.current && snap.exists) setLiveStats(snap.data() as Record<string, number>); },
      (err) => Crashlytics.recordError(err)
    );
    const unsubOnline = db.collection('presence').onSnapshot(
      (snap) => { if (isMountedRef.current) setOnlineUsers(snap.size); },
      (err) => Crashlytics.recordError(err)
    );
    const userId = DeviceInfo.getUniqueIdSync();
    db.collection('presence').doc(userId).set({ lastSeen: firestore.FieldValue.serverTimestamp(), platform: Platform.OS });

    return () => { unsubStats(); unsubOnline(); db.collection('presence').doc(userId).delete(); };
  }, []);

  useEffect(() => {
    const loadChartData = async () => {
      try {
        const days = timeFilter === 'Today' ? 1 : timeFilter === '7 Days' ? 7 : timeFilter === '30 Days' ? 30 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const snapshot = await db.collection('scan_logs').where('timestamp', '>=', startDate).orderBy('timestamp', 'asc').get();
        const dataPoints = new Map();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp.toDate();
          const key = timeFilter === 'Today' ? `${date.getHours()}:00` : timeFilter === '7 Days' ? date.toLocaleDateString('en-US', { weekday: 'short' }) : `Wk${Math.ceil(date.getDate() / 7)}`;
          dataPoints.set(key, (dataPoints.get(key) || 0) + 1);
        });
        const labels = Array.from(dataPoints.keys());
        const data = Array.from(dataPoints.values());
        if (isMountedRef.current) setChartData({ labels: labels.length ? labels : ['No Data'], datasets: [{ data: data.length ? data : [0] }] });
      } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); }
    };
    loadChartData();
  }, [timeFilter]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const scanSuccessStyle = useAnimatedStyle(() => ({ transform: [{ scale: scanSuccessScale.value }], opacity: scanSuccessScale.value }));

  const loadSavedQRs = useCallback(async () => {
    try { const raw = storage.getString('qr_list'); if (raw) setSavedQRs(JSON.parse(raw)); } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); }
  }, []);

  const saveQRToList = useCallback(async (qrData: string) => {
    try {
      const raw = storage.getString('qr_list');
      let list: QRHistoryItem[] = raw ? JSON.parse(raw) : [];
      if (list.some((i) => i.data === qrData)) return;
      list.unshift({ name: extractMerchantName(qrData), data: qrData, date: new Date().toISOString() });
      if (list.length > MAX_QR_HISTORY) list = list.slice(0, MAX_QR_HISTORY);
      storage.set('qr_list', JSON.stringify(list));
      setSavedQRs(list);
    } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); }
  }, []);

  const retryPendingUploads = useCallback(async () => {
    try {
      const raw = storage.getString('pending_clicks');
      if (!raw) return;
      const pending = JSON.parse(raw);
      if (!pending.length) return;
      for (const item of pending) {
        try {
          const field = 'selected_' + item.wallet.replace(/\s/g, '_');
          await db.collection('live_stats').doc('summary').update({ total_app_select_clicks: firestore.FieldValue.increment(1), [field]: firestore.FieldValue.increment(1) });
        } catch (err) {
          Crashlytics.recordError(err instanceof Error ? err : new Error(String(err)));
          return;
        }
      }
      storage.delete('pending_clicks');
    } catch (e) { Crashlytics.recordError(e instanceof Error ? e : new Error(String(e))); }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      'worklet';
      if (scanLockRef.current || !codes.length) return;
      const data = codes[0].value;
      if (!data || data === lastScannedDataRef.current) return;
      runOnJS(setCurrentQR)(data);
      runOnJS(saveQRToList)(data);
      runOnJS(setShowWalletSelect)(true);
      runOnJS(setLastUpdated)(new Date().toLocaleString());
      scanSuccessScale.value = withTiming(1.2, { duration: 150 }, () => { scanSuccessScale.value = withTiming(0, { duration: 250 }); });
      runOnJS(triggerHaptic)('heavy');
      if (lottieRef.current) runOnJS(lottieRef.current.play)();
      scanLockRef.current = true;
      lastScannedDataRef.current = data;
      runOnJS(Crashlytics.log)('QR Scanned: ' + extractMerchantName(data));
      runOnJS(analytics().logEvent)('qr_scanned', { merchant: extractMerchantName(data) });
      runOnJS(db.collection('scan_logs').add)({ merchant: extractMerchantName(data), timestamp: firestore.FieldValue.serverTimestamp(), platform: Platform.OS });
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => { scanLockRef.current = false; lastScannedDataRef.current = ''; }, 1500);
    },
  });

  // ITEM: kinumpleto ang truncated handleWalletSelect
  const handleWalletSelect = useCallback(async (wallet: any) => {
    triggerHaptic();
    const allowed = await firewallAllow();
    if (!allowed) return;
    setShowWalletSelect(false);
    setShowLoadingWallet(true);
    try {
      Crashlytics.log('User selected: ' + wallet.name);
      await analytics().logEvent('wallet_select', { wallet: wallet.name });
      const field = 'selected_' + wallet.name.replace(/\s/g, '_');
      try {
        await db.collection('live_stats').doc('summary').update({ total_app_select_clicks: firestore.FieldValue.increment(1), [field]: firestore.FieldValue.increment(1) });
      } catch (err) {
        const raw = storage.getString('pending_clicks');
        const pending = raw ? JSON.parse(raw) : [];
        pending.push({ wallet: wallet.name, timestamp: Date.now() });
        storage.set('pending_clicks', JSON.stringify(pending.slice(-50)));
        Crashlytics.recordError(err instanceof Error ? err : new Error(String(err)));
      }
      await db.collection('click_logs').add({
        action: 'clicked_open_' + wallet.name,
        merchant: extractMerchantName(currentQR || ''),
        qr_hash: currentQR ? currentQR.slice(-6) : '',
        timestamp: firestore.FieldValue.serverTimestamp(),
        platform: Platform.OS,
        disclaimer: 'User clicked button only. No payment confirmed.',
      });
      const url = wallet.deeplink;
      if (!url) throw new Error('No deeplink for ' + wallet.name);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else if (wallet?.fallback) {
        const canOpenFallback = await Linking.canOpenURL(wallet.fallback);
        if (canOpenFallback) {
          await Linking.openURL(wallet.fallback);
        } else {
          throw new Error('Cannot open fallback for ' + wallet.name);
        }
      } else {
        throw new Error('No fallback for ' + wallet.name);
      }
    } catch (err) {
      Crashlytics.recordError(err instanceof Error ? err : new Error(String(err)));
      Alert.alert('Error', 'Hindi mabuksan ang app. Paki-check kung naka-install ito sa device mo.');
    } finally {
      setShowLoadingWallet(false);
      setCurrentQR(null);
    }
  }, [currentQR]);

  // ITEM 16: kung wala pang camera permission, ipakita ang Allow Camera screen sa halip na blangkong black screen
  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <PermissionScreen onRequest={requestPermission} />
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <View style={[styles.container, styles.permissionContainer]}>
        <ActivityIndicator size="large" color={PINK} />
        <Text style={styles.permissionText}>Naghahanap ng camera...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* ITEM 8: audio={false} — iniiwasan ang RECORD_AUDIO permission crash */}
      <Camera
        style={StyleSheet.absoluteFill}
        device={device}
        isActive={!showWalletSelect && !showSettings && !showQRList && !showLiveStats && !showAbout && !showPrivacy}
        codeScanner={codeScanner}
        format={format}
        fps={fps}
        audio={false}
        torch={torchOn ? 'on' : 'off'}
      />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => setShowSettings(true)} style={styles.topBtn}>
          <Icon name="settings-outline" size={24} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setTorchOn(!torchOn)} style={styles.topBtn}>
          <Icon name={torchOn ? 'flash' : 'flash-outline'} size={24} color={torchOn ? PINK : '#fff'} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowQRList(true)} style={styles.topBtn}>
          <Icon name="time-outline" size={24} color="#fff" />
          {savedQRs.length > 0 && (
            <View style={styles.badge}><Text style={styles.badgeText}>{savedQRs.length}</Text></View>
          )}
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.scanFrame, animatedStyle]}>
        <View style={[styles.corner, styles.topLeft]} />
        <View style={[styles.corner, styles.topRight]} />
        <View style={[styles.corner, styles.bottomLeft]} />
        <View style={[styles.corner, styles.bottomRight]} />
      </Animated.View>
      <Text style={styles.scanHint}>Point camera at QRPH code</Text>

      {scanSuccessAnimation && (
        <Animated.View style={[styles.lottieContainer, scanSuccessStyle]} pointerEvents="none">
          <LottieView ref={lottieRef} source={scanSuccessAnimation} loop={false} style={{ width: 160, height: 160 }} />
        </Animated.View>
      )}

      <Modal visible={showWalletSelect} animationType="slide" transparent onRequestClose={() => setShowWalletSelect(false)}>
        <WalletSelectScreen onSelect={handleWalletSelect} onClose={() => setShowWalletSelect(false)} />
      </Modal>

      <Modal visible={showLoadingWallet} transparent animationType="fade">
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={PINK} />
          <Text style={styles.loadingText}>Opening app...</Text>
        </View>
      </Modal>

      <Modal visible={showSettings} animationType="slide" onRequestClose={() => setShowSettings(false)}>
        <SettingsScreen
          onClose={() => setShowSettings(false)}
          onShowLiveStats={() => { setShowSettings(false); setShowLiveStats(true); }}
          onShowAbout={() => { setShowSettings(false); setShowAbout(true); }}
          onShowPrivacy={() => { setShowSettings(false); setShowPrivacy(true); }}
        />
      </Modal>

      <Modal visible={showLiveStats} animationType="slide" onRequestClose={() => setShowLiveStats(false)}>
        <LiveStatsScreen
          onClose={() => setShowLiveStats(false)}
          liveStats={liveStats}
          onlineUsers={onlineUsers}
          chartData={chartData}
          timeFilter={timeFilter}
          setTimeFilter={setTimeFilter}
          lastUpdated={lastUpdated}
        />
      </Modal>

      <Modal visible={showQRList} animationType="slide" onRequestClose={() => setShowQRList(false)}>
        <QRListScreen
          data={savedQRs}
          onClose={() => { setShowQRList(false); loadSavedQRs(); }}
          onSelectQR={(qrValue) => { setShowQRList(false); setCurrentQR(qrValue); setShowWalletSelect(true); }}
        />
      </Modal>

      <Modal visible={showAbout} animationType="slide" onRequestClose={() => setShowAbout(false)}>
        <AboutScreen onClose={() => setShowAbout(false)} />
      </Modal>

      <Modal visible={showPrivacy} animationType="slide" onRequestClose={() => setShowPrivacy(false)}>
        <PrivacyScreen onClose={() => setShowPrivacy(false)} />
      </Modal>
    </View>
  );
}

// ITEM 15: kompleto ang styles — container, bg, torch/topBtn, atbp. para di mag-crash pag naka-reference sa undefined style
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  bg: { opacity: 0.15, resizeMode: 'cover' },
  permissionContainer: { justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  permissionTitle: { color: '#fff', fontSize: 20, fontWeight: '700', marginTop: 20, textAlign: 'center' },
  permissionText: { color: '#999', fontSize: 14, marginTop: 10, textAlign: 'center' },
  allowCameraBtn: { marginTop: 28, borderRadius: 30, overflow: 'hidden' },
  allowCameraGradient: { paddingHorizontal: 36, paddingVertical: 14, borderRadius: 30 },
  allowCameraText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  topBar: { position: 'absolute', top: 50, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, zIndex: 10 },
  topBtn: { padding: 10, backgroundColor: '#00000080', borderRadius: 20 },
  badge: { position: 'absolute', top: 2, right: 2, backgroundColor: PINK, borderRadius: 10, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },

  scanFrame: { position: 'absolute', width: 250, height: 250, alignSelf: 'center', top: '30%' },
  corner: { position: 'absolute', width: 40, height: 40, borderColor: PINK },
  topLeft: { top: 0, left: 0, borderTopWidth: 4, borderLeftWidth: 4, borderTopLeftRadius: 20 },
  topRight: { top: 0, right: 0, borderTopWidth: 4, borderRightWidth: 4, borderTopRightRadius: 20 },
  bottomLeft: { bottom: 0, left: 0, borderBottomWidth: 4, borderLeftWidth: 4, borderBottomLeftRadius: 20 },
  bottomRight: { bottom: 0, right: 0, borderBottomWidth: 4, borderRightWidth: 4, borderBottomRightRadius: 20 },
  scanHint: { position: 'absolute', bottom: '25%', alignSelf: 'center', color: '#fff', fontSize: 15 },
  lottieContainer: { position: 'absolute', alignSelf: 'center', top: '38%' },

  loadingOverlay: { flex: 1, backgroundColor: '#000000CC', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#fff', marginTop: 12, fontSize: 14 },

  gradientText: { backgroundColor: 'transparent', color: '#fff' },
  iconGradient: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  walletSelectContainer: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: 60, paddingHorizontal: 16 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700' },
  closeWalletBtn: { padding: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, height: 46, marginBottom: 16, shadowColor: PINK, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  searchInput: { flex: 1, color: '#fff', marginLeft: 8, fontSize: 14 },
  list: { paddingBottom: 20 },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 14 },
  seeAllText: { color: PINK, fontWeight: '700', marginRight: 6 },

  cardWrap: { width: CARD_W, height: CARD_H, margin: 4 },
  cardContent: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  logoCanvas: { width: 56, height: 56, marginBottom: 8 },
  name: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },

  statsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 },
  statsTitle: { paddingHorizontal: 4 },
  onlineText: { color: '#0F0', marginTop: 10, fontSize: 13 },
  lastUpdatedText: { color: '#666', fontSize: 11, marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 10 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#1A1A1A', marginRight: 8, marginBottom: 8 },
  filterChipActive: { backgroundColor: PINK },
  filterChipText: { color: '#999', fontSize: 12 },
  filterChipTextActive: { color: '#fff', fontWeight: '700' },
  sectionLabel: { color: '#fff', fontSize: 15, fontWeight: '700', marginTop: 10, marginBottom: 10 },

  merchantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  rank: { color: '#666', width: 20, fontSize: 13 },
  merchantIcon: { color: '#fff', fontWeight: '700' },
  merchantName: { color: '#fff', fontSize: 13, fontWeight: '600', marginLeft: 10 },
  merchantSub: { color: '#666', fontSize: 11, marginLeft: 10 },
  barBg: { width: 60, height: 4, backgroundColor: '#1A1A1A', borderRadius: 2, marginHorizontal: 8, overflow: 'hidden' },
  bar: { height: 4, backgroundColor: PINK },
  pct: { color: '#999', fontSize: 11, width: 32, textAlign: 'right' },

  qrListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 50, paddingHorizontal: 20, paddingBottom: 16 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: '#666', marginTop: 12, fontSize: 14 },
  qrItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  qrMerchant: { color: '#fff', fontSize: 14, fontWeight: '600' },
  qrDate: { color: '#666', fontSize: 11, marginTop: 2 },

  settingsCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#111', borderRadius: 14, padding: 14, marginBottom: 12 },
  settingsCardTitle: { color: '#fff', fontSize: 14, fontWeight: '700' },
  settingsCardSubtitle: { color: '#999', fontSize: 11, marginTop: 2 },

  aboutText: { color: '#ccc', fontSize: 13, lineHeight: 20 },
});

export default App;
