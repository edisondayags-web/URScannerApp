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
import { LineChart } from 'react-native-chart-kit';
import Animated, {
  useSharedValue, withTiming, withRepeat, useAnimatedStyle, Easing,
  cancelAnimation, runOnJS, FadeIn, FadeOut,
} from 'react-native-reanimated';
import LottieView from 'lottie-react-native';
import DeviceInfo from 'react-native-device-info';
import JailMonkey from 'jail-monkey';

// ADDED: Skia imports para sa bagong WalletSelectScreen
import { Canvas, RRect, RadialGradient, vec, Shadow, Image as SkImage, useImage } from '@shopify/react-native-skia';

// ADDED: Sentry
import * as Sentry from '@sentry/react-native';

import firebase from '@react-native-firebase/app';
import firestore from '@react-native-firebase/firestore';
import analytics from '@react-native-firebase/analytics';
import crashlytics from '@react-native-firebase/crashlytics';
import appCheck from '@react-native-firebase/app-check';
import { check, IntegrityErrorCode } from 'react-native-play-integrity';

import {
  FIREBASE_API_KEY, FIREBASE_AUTH_DOMAIN, FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET, FIREBASE_MESSAGING_SENDER_ID, FIREBASE_APP_ID,
} from '@env';

// ADDED: Sentry Init - ilagay mo sa pinaka-taas bago mag-render
Sentry.init({
  dsn: 'YOUR_SENTRY_DSN_HERE', // Palitan mo ng DSN galing sentry.io
  tracesSampleRate: 1.0,
  enableAutoSessionTracking: true,
  enableNativeCrashHandling: true,
});

const { width, height } = Dimensions.get('window');
const storage = new MMKV();

// #3 FIX: Safe fallback para di mag-crash kung wala yung files
let bgImage;
try {
  bgImage = require('./assets/hoodie-bg.png');
} catch {
  bgImage = { uri: 'https://via.placeholder.com/500' };
}

let scanSuccessAnimation;
try {
  scanSuccessAnimation = require('./assets/scan-success.json');
} catch {
  scanSuccessAnimation = null;
}

function triggerHaptic(style: 'light' | 'heavy' = 'light') {
  try {
    HapticFeedback.trigger(style === 'heavy'? 'impactHeavy' : 'impactLight');
  } catch {}
}

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
  });

  // ADDED: Firebase App Check - PROPER PROVIDER (Play Integrity)
  if (!__DEV__) {
    appCheck().initializeAppCheck({
      provider: appCheck.PlayIntegrityAppCheckProvider, // <- TAMA NA TO
      isTokenAutoRefreshEnabled: true,
    });
  }
}

const db = firestore();
const Crashlytics = {
  log: (msg: string) => {
    if (__DEV__) console.log('[LOG]', msg);
    crashlytics().log(msg);
    Sentry.addBreadcrumb({ message: msg, level: 'info' }); // ADDED: Sentry breadcrumb
  },
  recordError: (err: Error) => {
    if (__DEV__) console.error('[ERROR]', err);
    crashlytics().recordError(err);
    Sentry.captureException(err); // ADDED: Sentry capture
  },
  setUserId: (id: string) => {
    crashlytics().setUserId(id);
    crashlytics().setAttributes({ platform: Platform.OS, version: DeviceInfo.getVersion(), build: DeviceInfo.getBuildNumber() });
    Sentry.setUser({ id }); // ADDED: Sentry user
  },
};

const brandPink = '#FF4D8D';

// BAGONG WALLET CONFIG - 30 ITEMS TOTAL
const PINK = '#FF2E88';
const CARD_W = (width - 48) / 3;
const CARD_H = CARD_W + 50;
const RADIUS = 22;

const WALLETS = [
  // E-WALLETS - ROW 1
  { name: 'GCash', glow: '#3A86FF', deeplink: 'gcash://qrcode/scan', fallback: 'https://www.gcash.com', store: 'com.globe.gcash.android', logo: require('./assets/gcash.png') },
  { name: 'Maya', glow: '#00F5A0', deeplink: 'maya://qr', fallback: 'https://www.maya.ph', store: 'com.paymaya', logo: require('./assets/maya.png') },
  { name: 'ShopeePay', glow: '#FF3D00', deeplink: 'shopee://', fallback: 'https://shopee.ph', store: 'com.shopee.ph', logo: require('./assets/shopee.png') },

  // E-WALLETS + TRANSPORT - ROW 2
  { name: 'GrabPay', glow: '#00F5A0', deeplink: 'grab://', fallback: 'https://www.grab.com/ph/pay/', store: 'com.grabtaxi.passenger', logo: require('./assets/grab.png') },
  { name: 'Coins.ph', glow: '#FF8C00', deeplink: 'coins://', fallback: 'https://coins.ph', store: 'coins.ph', logo: require('./assets/coins.png') },
  { name: 'Starpay', glow: '#9D4EDD', deeplink: 'starpay://', fallback: 'https://starpay.com.ph', store: 'ph.starpay.app', logo: require('./assets/starpay.png') },

  // TOP 5 BANKS - ROW 3
  { name: 'BDO', glow: '#3A86FF', deeplink: 'bdo://', fallback: 'https://www.bdo.com.ph/personal/digital-banking/mobile-banking', store: 'com.bdo.unibank', logo: require('./assets/bdo.png') },
  { name: 'BPI', glow: '#FF3D00', deeplink: 'bpi://', fallback: 'https://www.bpi.com.ph/personal/bank/online', store: 'com.bpi.mobile', logo: require('./assets/bpi.png') },
  { name: 'Metrobank', glow: '#3A86FF', deeplink: 'metrobank://', fallback: 'https://metrobank.com.ph', store: 'com.metrobank.mobile', logo: require('./assets/metro.png') },

  // MAJOR BANKS - ROW 4
  { name: 'UnionBank', glow: '#FF8C00', deeplink: 'unionbank://', fallback: 'https://www.unionbankph.com', store: 'com.unionbank.ph', logo: require('./assets/union.png') },
  { name: 'PNB', glow: '#9D4EDD', deeplink: 'pnb://', fallback: 'https://www.pnb.com.ph', store: 'com.pnb.mobile', logo: require('./assets/pnb.png') },
  { name: 'RCBC', glow: '#3A86FF', deeplink: 'rcbc://', fallback: 'https://www.rcbc.com', store: 'com.rcbc.mobile', logo: require('./assets/rcbc.png') },

  // MAJOR BANKS - ROW 5
  { name: 'Security Bank', glow: '#00F5A0', deeplink: 'securitybank://', fallback: 'https://www.securitybank.com', store: 'com.securitybank.mobile', logo: require('./assets/security.png') },
  { name: 'Chinabank', glow: '#FF3D00', deeplink: 'chinabank://', fallback: 'https://www.chinabank.ph', store: 'com.chinabank.mobile', logo: require('./assets/china.png') },
  { name: 'Landbank', glow: '#00F5A0', deeplink: 'landbank://', fallback: 'https://www.landbank.com', store: 'com.landbank.mobile', logo: require('./assets/landbank.png') },

  // MID-TIER BANKS - ROW 6
  { name: 'PSBank', glow: '#FF8C00', deeplink: 'psbank://', fallback: 'https://www.psbank.com.ph', store: 'com.psbank.mobile', logo: require('./assets/psbank.png') },
  { name: 'EastWest Bank', glow: '#9D4EDD', deeplink: 'eastwest://', fallback: 'https://www.eastwestbanker.com', store: 'com.eastwestbank.mobile', logo: require('./assets/eastwest.png') },
  { name: 'AUB', glow: '#3A86FF', deeplink: 'aub://', fallback: 'https://www.aub.com.ph', store: 'com.aub.mobile', logo: require('./assets/aub.png') },

  // GOV'T + RURAL - ROW 7
  { name: 'DBP', glow: '#00F5A0', deeplink: 'dbp://', fallback: 'https://www.dbp.ph', store: 'com.dbp.mobile', logo: require('./assets/dbp.png') },
  { name: 'Maybank', glow: '#FF3D00', deeplink: 'maybank://', fallback: 'https://www.maybank2u.com.ph', store: 'com.maybank2u.mobile', logo: require('./assets/maybank.png') },
  { name: 'UCPB', glow: '#9D4EDD', deeplink: 'ucpb://', fallback: 'https://www.ucpb.com', store: 'com.ucpb.mobile', logo: require('./assets/ucpb.png') },

  // DIGITAL BANKS - ROW 8
  { name: 'CIMB Bank', glow: '#FF3D00', deeplink: 'cimb://', fallback: 'https://www.cimbbank.com.ph', store: 'com.cimb.octo', logo: require('./assets/cimb.png') },
  { name: 'TONIK', glow: '#00F5A0', deeplink: 'tonik://', fallback: 'https://tonikbank.com', store: 'com.tonik.mobile', logo: require('./assets/tonik.png') },
  { name: 'ING Bank', glow: '#FF8C00', deeplink: 'ing://', fallback: 'https://ing.com.ph', store: 'com.ing.mobile', logo: require('./assets/ing.png') },

  // MORE BANKS - ROW 9
  { name: 'Robinsons Bank', glow: '#3A86FF', deeplink: 'robinsons://', fallback: 'https://www.robinsonsbank.com.ph', store: 'com.robinsonsbank.mobile', logo: require('./assets/robinsons.png') },
  { name: 'Bank of Commerce', glow: '#FF3D00', deeplink: 'bankcom://', fallback: 'https://www.bankcom.com.ph', store: 'com.bankcom.mobile', logo: require('./assets/bankcom.png') },
  { name: 'PBCOM', glow: '#9D4EDD', deeplink: 'pbcom://', fallback: 'https://www.pbcom.com.ph', store: 'com.pbcom.mobile', logo: require('./assets/pbcom.png') },

  // LAST 3 - ROW 10
  { name: 'BOC', glow: '#FF8C00', deeplink: 'boc://', fallback: 'https://www.boc.com.ph', store: 'com.boc.mobile', logo: require('./assets/boc.png') },
  { name: 'Sterling Bank', glow: '#00F5A0', deeplink: 'sterling://', fallback: 'https://www.sterlingbankasia.com', store: 'com.sterling.mobile', logo: require('./assets/sterling.png') },
  { name: 'Malayan Bank', glow: '#3A86FF', deeplink: 'malayan://', fallback: 'https://www.malayanbank.com', store: 'com.malayan.mobile', logo: require('./assets/malayan.png') },
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
    if (savedDate!== today) { dailyClicks = 0; storage.set(FIREWALL.DAILY_DATE_KEY, today); }
    if (dailyClicks >= FIREWALL.MAX_DAILY_CLICKS) { Alert.alert('Daily limit reached', 'Bumalik bukas.'); return false; }
    storage.set(FIREWALL.LAST_CLICK_KEY, now.toString());
    storage.set(FIREWALL.DAILY_KEY, (dailyClicks + 1).toString());
    return true;
  } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); return true; }
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
    return name && name.trim()? name.trim() : 'Merchant';
  } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); return 'Merchant'; }
}

const CRC_TABLE = (() => {
  const table = new Uint16Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n << 8;
    for (let k = 0; k < 8; k++) { c = (c & 0x8000)? ((c << 1) ^ 0x1021) : (c << 1); }
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
    if (declaredCrc!== computedCrc) return false;
    if (getEMVTag(data, '58')!== 'PH') return false;
    if (getEMVTag(data, '53')!== '608') return false;
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
  <LinearGradient colors={[bgColor, '#000']} style={[styles.iconGradient, {borderRadius: 20}]}>
    {children}
  </LinearGradient>
);

const MerchantRow: React.FC<{ item: MerchantUI }> = React.memo(({ item }) => (
  <View style={styles.merchantRow}>
    <Text style={styles.rank}>{item.rank}</Text>
    <PinkFadeIcon bgColor={item.color}><Text style={styles.merchantIcon}>{item.name[0]}</Text></PinkFadeIcon>
    <View style={{flex:1}}><Text style={styles.merchantName}>{item.name}</Text><Text style={styles.merchantSub}>{item.scans} scans</Text></View>
    <View style={styles.barBg}><View style={[styles.bar, {width: item.pct}]} /></View>
    <Text style={styles.pct}>{item.pct}</Text>
    <Icon name="chevron-forward" size={18} color="#666" />
  </View>
));

// BAGONG WALLET SELECT COMPONENT - IPINALIT NA DITO
const NeonCard = ({ glowColor }: {glowColor: string}) => {
  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <RRect x={0} y={0} width={CARD_W} height={CARD_H} r={RADIUS} color="#0A0A0A">
        <RRect x={0.75} y={0.75} width={CARD_W-1.5} height={CARD_H-1.5} r={RADIUS-1} color="transparent" style="stroke" strokeWidth={1.5}>
          <RadialGradient c={vec(CARD_W/2, CARD_H/2)} r={CARD_W * 0.8} colors={[glowColor + 'FF', glowColor + '30', 'transparent']} />
          <Shadow dx={0} dy={0} blur={30} color={glowColor + 'AA'} />
        </RRect>
      </RRect>
    </Canvas>
  );
};

const WalletItem = ({ item, onPress }: {item: any, onPress: (i:any)=>void}) => {
  const scale = useSharedValue(1);
  const logo = useImage(item.logo);

  const onPressIn = () => { scale.value = withTiming(0.95, {duration: 80}); HapticFeedback.trigger('impactLight'); }
  const onPressOut = () => { scale.value = withTiming(1, {duration: 120, easing: Easing.out(Easing.quad)}); }
  const style = useAnimatedStyle(() => ({ transform: [{scale: scale.value}] }));

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

const WalletSelectScreen = ({ onSelect, onClose }: {onSelect: (w:any)=>void, onClose: () => void}) => {
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  const data = useMemo(() => WALLETS.filter(w => w.name.toLowerCase().includes(query.toLowerCase())), [query]);

  const glow = useSharedValue(0);
  React.useEffect(() => { glow.value = withRepeat(withTiming(1, {duration: 1500, easing: Easing.inOut(Easing.sin)}), -1, true) }, []);
  const searchStyle = useAnimatedStyle(() => ({ shadowOpacity: 0.5 + glow.value * 0.3, borderColor: PINK }));

  return (
    <View style={styles.walletSelectContainer}>
      <View style={styles.walletHeader}>
        <Text style={styles.title}>SELECT <Text style={{color: PINK}}>YOUR</Text> PREFERRED</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeWalletBtn}>
          <Icon name="close" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <Animated.View style={[styles.searchBox, searchStyle]}>
        <Icon name="search" size={22} color={PINK} />
        <TextInput style={styles.searchInput} placeholder="Search e-wallet or bank" placeholderTextColor="#666" value={query} onChangeText={setQuery}/>
      </Animated.View>

      <FlashList
        data={showAll? data : data.slice(0, 12)}
        renderItem={({item}) => <WalletItem item={item} onPress={onSelect} />}
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

function App() {
  const { hasPermission, requestPermission } = useCameraPermission();
  const devices = useCameraDevices('wide-angle-camera');
  const device = devices.back;

  const format: CameraDeviceFormat | undefined = useMemo(() => {
    if (!device) return undefined;
    return device.formats
.filter(f => f.videoWidth >= 3840 && f.videoHeight >= 2160)
.sort((a, b) => b.videoWidth - a.videoWidth)[0] || device.formats[0];
  }, [device]);

  const fps: number = useMemo(() => {
    if (!format) return 30;
    return format.maxFps >= 60? 60 : format.maxFps;
  }, [format]);

  const [showSettings, setShowSettings] = useState(false);
  const [showLiveStats, setShowLiveStats] = useState(false);
  const [showAllMerchants, setShowAllMerchants] = useState(false);
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortType, setSortType] = useState<SortType>('newest');
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

    // ADDED: Play Integrity proper check
    if (Platform.OS === 'android' &&!__DEV__) {
      check()
  .then(() => {
          Crashlytics.log('Play Integrity pass');
          Sentry.addBreadcrumb({ message: 'Play Integrity pass', level: 'info' });
        })
  .catch((err) => {
          if (err.code!== IntegrityErrorCode.CLIENT_TRANSIENT) {
            Alert.alert('Security Error', 'App integrity check failed. Please install from Play Store.');
            Crashlytics.recordError(new Error('Play Integrity failed: ' + err.code));
            Sentry.captureException(new Error('Play Integrity failed: ' + err.code));
          }
        });
    }

    if (JailMonkey.isJailBroken()) {
      Alert.alert('Security Warning', 'This device appears to be rooted/jailbroken.');
      Crashlytics.log('Jailbroken device');
      Sentry.captureMessage('Jailbroken device detected', 'warning');
    }
    if (DeviceInfo.isEmulatorSync()) {
      Alert.alert('Emulator Detected', 'Please use a physical device.');
      Sentry.captureMessage('Emulator detected', 'warning');
    }

    (async () => {
      if (!hasPermission) await requestPermission();
      loadSavedQRs();
      Crashlytics.setUserId(DeviceInfo.getUniqueIdSync());
      Crashlytics.log('UR Scanner launched');
      await analytics().logEvent('app_open');
      retryPendingUploads();
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
        const days = timeFilter === 'Today'? 1 : timeFilter === '7 Days'? 7 : timeFilter === '30 Days'? 30 : 365;
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const snapshot = await db.collection('scan_logs').where('timestamp', '>=', startDate).orderBy('timestamp', 'asc').get();
        const dataPoints = new Map();
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          const date = data.timestamp.toDate();
          const key = timeFilter === 'Today'? `${date.getHours()}:00` : timeFilter === '7 Days'? date.toLocaleDateString('en-US', { weekday: 'short' }) : `Wk${Math.ceil(date.getDate() / 7)}`;
          dataPoints.set(key, (dataPoints.get(key) || 0) + 1);
        });
        const labels = Array.from(dataPoints.keys());
        const data = Array.from(dataPoints.values());
        if (isMountedRef.current) setChartData({ labels: labels.length? labels : ['No Data'], datasets: [{ data: data.length? data : [0] }] });
      } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); }
    };
    loadChartData();
  }, [timeFilter]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const scanSuccessStyle = useAnimatedStyle(() => ({ transform: [{ scale: scanSuccessScale.value }], opacity: scanSuccessScale.value }));

  const loadSavedQRs = useCallback(async () => {
    try { const raw = storage.getString('qr_list'); if (raw) setSavedQRs(JSON.parse(raw)); } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); }
  }, []);

  const saveQRToList = useCallback(async (qrData: string) => {
    try {
      const raw = storage.getString('qr_list');
      let list: QRHistoryItem[] = raw? JSON.parse(raw) : [];
      if (list.some((i) => i.data === qrData)) return;
      list.unshift({ name: extractMerchantName(qrData), data: qrData, date: new Date().toISOString() });
      if (list.length > MAX_QR_HISTORY) list = list.slice(0, MAX_QR_HISTORY);
      storage.set('qr_list', JSON.stringify(list));
      setSavedQRs(list);
    } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); }
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
          Crashlytics.recordError(err instanceof Error? err : new Error(String(err)));
          return;
        }
      }
      storage.delete('pending_clicks');
    } catch (e) { Crashlytics.recordError(e instanceof Error? e : new Error(String(e))); }
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: (codes) => {
      'worklet';
      if (scanLockRef.current ||!codes.length) return;
      const data = codes[0].value;
      if (!data || data === lastScannedDataRef.current) return;
      runOnJS(setCurrentQR)(data);
      runOnJS(saveQRToList)(data);
      runOnJS(setShowWalletSelect)(true);
      runOnJS(setLastUpdated)(new Date().toLocaleString());
      scanSuccessScale.value = withTiming(1.2, { duration: 150 }, () => { scanSuccessScale.value = withTiming(0, { duration: 250 }); });
      runOnJS(triggerHaptic)('heavy');
      runOnJS(lottieRef.current?.play)();
      scanLockRef.current = true;
      lastScannedDataRef.current = data;
      runOnJS(Crashlytics.log)('QR Scanned: ' + extractMerchantName(data));
      runOnJS(analytics().logEvent)('qr_scanned', { merchant: extractMerchantName(data) });
      runOnJS(db.collection('scan_logs').add)({ merchant: extractMerchantName(data), timestamp: firestore.FieldValue.serverTimestamp(), platform: Platform.OS });
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => { scanLockRef.current = false; lastScannedDataRef.current = ''; }, 1500);
    },
  });

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
        const pending = raw? JSON.parse(raw) : [];
        pending.push({ wallet: wallet.name, timestamp: Date.now() });
        storage.set('pending_clicks', JSON.stringify(pending.slice(-50)));
        Crashlytics.recordError(err instanceof Error? err : new Error(String(err)));
      }
      await db.collection('click_logs').add({ action: 'clicked_open_in_' + wallet.name, merchant: extractMerchantName(currentQR || ''), qr_hash: currentQR? currentQR.slice(-6) : '', timestamp: firestore.FieldValue.serverTimestamp(), platform: Platform.OS, disclaimer: 'User clicked button only. No payment confirmed.' });
      const url = wallet.deeplink;
      if (!url) throw new Error('No deeplink for ' + wallet.name);
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) { await Linking.openURL(url); }
      else if (wallet?.fallback) {
        const canOpenFallback = await Linking.canOpenURL(wallet.fallback);
        if (canOpenFallback) {
          await Linking.openURL(wallet.fallback);
        } else if (wallet.store && Platform.OS === 'android') {
          await Linking.openURL(`market://details?id=${wallet.store}`);
        } else if (wallet.store && Platform.OS === 'ios') {
          Alert.alert('App Not Installed', `${wallet.name} is not installed on your device.`);
        } else {
          Alert.alert('Cannot Open', `Unable to open ${wallet.name}.`);
        }
      } else if (wallet.store && Platform.OS === 'android') {
        await Linking.openURL(`market://details?id=${wallet.store}`);
      } else {
        Alert.alert('App Not Installed', `${wallet.name} is not installed on your device.`);
      }
    } catch (e) {
      Crashlytics.recordError(e instanceof Error? e : new Error(String(e)));
      Alert.alert('Error', 'Something went wrong opening the app. Please try again.');
    } finally {
      setShowLoadingWallet(false);
      setCurrentQR(null);
    }
  }, [currentQR]);

  const filteredQRs = useMemo(() => {
    let list = [...savedQRs];
    if (searchQuery) {
      list = list.filter(i =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.data.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (sortType === 'newest') {
      list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else if (sortType === 'oldest') {
      list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else if (sortType === 'merchant') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return list;
  }, [savedQRs, searchQuery, sortType]);

  const topMerchants: MerchantUI[] = useMemo(() => {
    const entries = Object.entries(liveStats).filter(([k]) => k.startsWith('merchant_'));
    const total = entries.reduce((sum, [, v]) => sum + v, 0) || 1;
    const colors = ['#FF4D8D', '#3A86FF', '#00F5A0', '#FF8C00', '#9D4EDD'];
    return entries
     .map(([k, v], idx) => ({
        rank: idx + 1,
        name: k.replace('merchant_', '').replace(/_/g, ' '),
        scans: v,
        color: colors[idx % colors.length],
        pct: `${Math.round((v / total) * 100)}%`,
      }))
     .sort((a, b) => b.scans - a.scans)
     .map((item, idx) => ({...item, rank: idx + 1 }));
  }, [liveStats]);

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <Text style={styles.permissionText}>Camera permission is required to scan QR codes.</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.permissionContainer}>
          <ActivityIndicator size="large" color={brandPink} />
          <Text style={styles.permissionText}>Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <Sentry.TouchEventBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <ImageBackground source={bgImage} style={StyleSheet.absoluteFill} resizeMode="cover">
          <LinearGradient colors={['rgba(0,0,0,0.7)', 'rgba(0,0,0,0.95)']} style={StyleSheet.absoluteFill} />
        </ImageBackground>

        <Camera
          style={StyleSheet.absoluteFill}
          device={device}
          isActive={!showWalletSelect &&!showLoadingWallet &&!showSettings}
          codeScanner={codeScanner}
          format={format}
          fps={fps}
          torch={torchOn? 'on' : 'off'}
          enableZoomGesture
        />

        <Animated.View style={[styles.scanOverlay, scanSuccessStyle]}>
          {scanSuccessAnimation && (
            <LottieView
              ref={lottieRef}
              source={scanSuccessAnimation}
              style={styles.lottieSuccess}
              autoPlay={false}
              loop={false}
            />
          )}
        </Animated.View>

        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowSettings(true)}>
            <Icon name="menu" size={28} color="#fff" />
          </TouchableOpacity>
          <PinkFadeText size={20} weight="700">UR SCANNER</PinkFadeText>
          <TouchableOpacity onPress={() => setTorchOn(!torchOn)}>
            <Icon name={torchOn? 'flashlight' : 'flashlight-outline'} size={28} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={styles.bottomBar}>
          <TouchableOpacity style={styles.bottomButton} onPress={() => setShowQRList(true)}>
            <MaterialIcon name="history" size={24} color="#fff" />
            <Text style={styles.bottomButtonText}>History</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.scanButton} onPress={() => setShowWalletSelect(true)}>
            <Animated.View style={animatedStyle}>
              <LinearGradient colors={[brandPink, '#000']} style={styles.scanButtonGradient}>
                <Icon name="qr-code" size={32} color="#fff" />
              </LinearGradient>
            </Animated.View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.bottomButton} onPress={() => setShowLiveStats(true)}>
            <MaterialIcon name="chart-line" size={24} color="#fff" />
            <Text style={styles.bottomButtonText}>Stats</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showWalletSelect} animationType="slide" transparent>
          <WalletSelectScreen
            onSelect={handleWalletSelect}
            onClose={() => setShowWalletSelect(false)}
          />
        </Modal>

        <Modal visible={showLoadingWallet} animationType="fade" transparent>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={brandPink} />
            <Text style={styles.loadingText}>Opening wallet...</Text>
          </View>
        </Modal>

        <Modal visible={showSettings} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Settings</Text>
              <TouchableOpacity onPress={() => setShowSettings(false)}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <TouchableOpacity style={styles.settingItem} onPress={() => { setShowSettings(false); setShowAbout(true); }}>
                <Icon name="information-circle-outline" size={24} color="#fff" />
                <Text style={styles.settingText}>About</Text>
                <Icon name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.settingItem} onPress={() => { setShowSettings(false); setShowPrivacy(true); }}>
                <Icon name="shield-checkmark-outline" size={24} color="#fff" />
                <Text style={styles.settingText}>Privacy Policy</Text>
                <Icon name="chevron-forward" size={20} color="#666" />
              </TouchableOpacity>
              <View style={styles.settingItem}>
                <Icon name="people-outline" size={24} color="#fff" />
                <Text style={styles.settingText}>Online Users</Text>
                <Text style={styles.settingValue}>{onlineUsers}</Text>
              </View>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={showLiveStats} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Live Stats</Text>
              <TouchableOpacity onPress={() => setShowLiveStats(false)}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <View style={styles.filterRow}>
                {(['Today', '7 Days', '30 Days', 'All Time'] as TimeFilter[]).map(f => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.filterButton, timeFilter === f && styles.filterButtonActive]}
                    onPress={() => setTimeFilter(f)}
                  >
                    <Text style={[styles.filterText, timeFilter === f && styles.filterTextActive]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={styles.chartContainer}>
                <LineChart
                  data={chartData}
                  width={width - 32}
                  height={220}
                  chartConfig={{
                    backgroundColor: '#0A0A0A',
                    backgroundGradientFrom: '#0A0A0A',
                    backgroundGradientTo: '#0A0A0A',
                    decimalPlaces: 0,
                    color: (opacity = 1) => `rgba(255, 77, 141, ${opacity})`,
                    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
                    style: { borderRadius: 16 },
                    propsForDots: { r: '4', strokeWidth: '2', stroke: brandPink }
                  }}
                  bezier
                  style={styles.chart}
                />
              </View>

              <Text style={styles.sectionTitle}>Top Merchants</Text>
              {(showAllMerchants? topMerchants : topMerchants.slice(0, 5)).map(item => (
                <MerchantRow key={item.name} item={item} />
              ))}
              {topMerchants.length > 5 && (
                <TouchableOpacity style={styles.seeAll} onPress={() => setShowAllMerchants(!showAllMerchants)}>
                  <Text style={styles.seeAllText}>{showAllMerchants? 'SEE LESS' : 'SEE ALL'}</Text>
                  <Icon name={showAllMerchants? 'chevron-up' : 'chevron-down'} size={22} color={PINK} />
                </TouchableOpacity>
              )}

              <Text style={styles.lastUpdated}>Last updated: {lastUpdated}</Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={showQRList} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Scan History</Text>
              <TouchableOpacity onPress={() => setShowQRList(false)}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchRow}>
              <Icon name="search" size={20} color="#666" />
              <TextInput
                style={styles.searchInputQR}
                placeholder="Search history..."
                placeholderTextColor="#666"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <View style={styles.sortRow}>
              {(['newest', 'oldest', 'merchant'] as SortType[]).map(s => (
                <TouchableOpacity
                  key={s}
                  style={[styles.sortButton, sortType === s && styles.sortButtonActive]}
                  onPress={() => setSortType(s)}
                >
                  <Text style={[styles.sortText, sortType === s && styles.sortTextActive]}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <FlashList
              data={filteredQRs}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.qrItem}
                  onPress={() => {
                    setCurrentQR(item.data);
                    setShowQRList(false);
                    setShowWalletSelect(true);
                  }}
                >
                  <View style={styles.qrItemLeft}>
                    <MaterialIcon name="qrcode-scan" size={24} color={brandPink} />
                    <View style={styles.qrItemText}>
                      <Text style={styles.qrItemName}>{item.name}</Text>
                      <Text style={styles.qrItemDate}>{new Date(item.date).toLocaleString()}</Text>
                    </View>
                  </View>
                  <Icon name="chevron-forward" size={20} color="#666" />
                </TouchableOpacity>
              )}
              keyExtractor={(item, idx) => `${item.data}-${idx}`}
              estimatedItemSize={70}
              contentContainerStyle={styles.qrList}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>No scan history yet</Text>
                </View>
              }
            />
          </SafeAreaView>
        </Modal>

        <Modal visible={showAbout} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>About</Text>
              <TouchableOpacity onPress={() => setShowAbout(false)}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.aboutText}>
                UR Scanner v{DeviceInfo.getVersion()} (Build {DeviceInfo.getBuildNumber()}){'\n\n'}
                A secure QRPH scanner for Philippine e-wallets and banks.{'\n\n'}
                Features:{'\n'}
                • Fast QRPH scanning{'\n'}
                • 30 supported wallets/banks{'\n'}
                • Scan history & analytics{'\n'}
                • Play Integrity security{'\n'}
                • Sentry error monitoring
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>

        <Modal visible={showPrivacy} animationType="slide" transparent>
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Privacy Policy</Text>
              <TouchableOpacity onPress={() => setShowPrivacy(false)}>
                <Icon name="close" size={28} color="#fff" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalContent}>
              <Text style={styles.aboutText}>
                We respect your privacy. This app:{'\n\n'}
                • Stores scan history locally on your device{'\n'}
                • Sends anonymous usage stats to improve the app{'\n'}
                • Does NOT access your wallet balances or transactions{'\n'}
                • Does NOT share personal data with third parties{'\n'}
                • Uses Firebase Analytics & Crashlytics for diagnostics{'\n'}
                • Uses Sentry for error monitoring{'\n\n'}
                For questions, contact support@urscanner.ph
              </Text>
            </ScrollView>
          </SafeAreaView>
        </Modal>

      </SafeAreaView>
    </Sentry.TouchEventBoundary>
  );
}

// STYLES - COMPLETE
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionText: { color: '#fff', fontSize: 16, textAlign: 'center', marginTop: 20, marginBottom: 20 },
  permissionButton: { backgroundColor: brandPink, paddingHorizontal: 30, paddingVertical: 15, borderRadius: 25 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  scanOverlay: {...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', pointerEvents: 'none' },
  lottieSuccess: { width: 200, height: 200 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android'? 20 : 0, paddingBottom: 10 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: Platform.OS === 'ios'? 30 : 20, paddingTop: 10, backgroundColor: 'rgba(0,0,0,0.8)' },
  bottomButton: { alignItems: 'center', padding: 10 },
  bottomButtonText: { color: '#fff', fontSize: 12, marginTop: 4 },
  scanButton: { marginTop: -30 },
  scanButtonGradient: { width: 70, height: 70, borderRadius: 35, justifyContent: 'center', alignItems: 'center', borderWidth: 3, borderColor: '#fff' },
  modalContainer: { flex: 1, backgroundColor: '#0A0A0A' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#222' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  modalContent: { flex: 1, padding: 16 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.9)' },
  loadingText: { color: '#fff', fontSize: 16, marginTop: 20 },
  settingItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#222' },
  settingText: { color: '#fff', fontSize: 16, marginLeft: 16, flex: 1 },
  settingValue: { color: '#999', fontSize: 14 },
  filterRow: { flexDirection: 'row', marginBottom: 20, gap: 8 },
  filterButton: { flex: 1, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, backgroundColor: '#1A1A1A', alignItems: 'center' },
  filterButtonActive: { backgroundColor: brandPink },
  filterText: { color: '#999', fontSize: 13, fontWeight: '600' },
  filterTextActive: { color: '#fff' },
  chartContainer: { marginBottom: 20, borderRadius: 16, overflow: 'hidden' },
  chart: { borderRadius: 16 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  merchantRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1A1A1A' },
  rank: { color: '#666', fontSize: 14, width: 30, fontWeight: '600' },
  merchantIcon: { color: '#fff', fontSize: 14, fontWeight: '700' },
  merchantName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  merchantSub: { color: '#666', fontSize: 12, marginTop: 2 },
  barBg: { flex: 1, height: 6, backgroundColor: '#1A1A1A', borderRadius: 3, marginHorizontal: 12, overflow: 'hidden' },
  bar: { height: '100%', backgroundColor: brandPink, borderRadius: 3 },
  pct: { color: '#999', fontSize: 13, fontWeight: '600', width: 40, textAlign: 'right' },
  lastUpdated: { color: '#666', fontSize: 12, textAlign: 'center', marginTop: 20, marginBottom: 20 },
  searchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, margin: 16, gap: 12 },
  searchInputQR: { flex: 1, color: '#fff', fontSize: 15 },
  sortRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 12, gap: 8 },
  sortButton: { flex: 1, paddingVertical: 8, borderRadius: 12, backgroundColor: '#1A1A1A', alignItems: 'center' },
  sortButtonActive: { backgroundColor: brandPink },
  sortText: { color: '#999', fontSize: 13, fontWeight: '600' },
  sortTextActive: { color: '#fff' },
  qrList: { paddingHorizontal: 16 },
  qrItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A1A1A', padding: 16, borderRadius: 12, marginBottom: 8 },
  qrItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  qrItemText: { flex: 1 },
  qrItemName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  qrItemDate: { color: '#666', fontSize: 12, marginTop: 2 },
  emptyContainer: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { color: '#666', fontSize: 15 },
  aboutText: { color: '#ccc', fontSize: 14, lineHeight: 22 },
  gradientText: { fontWeight: '500' },
  iconGradient: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  walletSelectContainer: { flex: 1, backgroundColor: '#0A0A0A', paddingTop: Platform.OS === 'ios'? 50 : 20 },
  walletHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
  closeWalletBtn: { padding: 8 },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1A1A1A', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginHorizontal: 20, marginBottom: 20, borderWidth: 1.5, gap: 12 },
  searchInput: { flex: 1, color: '#fff', fontSize: 15 },
  list: { paddingHorizontal: 16, paddingBottom: 20 },
  cardWrap: { width: CARD_W, height: CARD_H, margin: 4 },
  cardContent: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 20 },
  logoCanvas: { width: 56, height: 56 },
  name: { color: '#fff', fontSize: 13, fontWeight: '600', marginTop: 12, textAlign: 'center' },
  seeAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 16, gap: 8 },
  seeAllText: { color: PINK, fontSize: 15, fontWeight: '700', letterSpacing: 1 },
});

export default Sentry.wrap(App);
