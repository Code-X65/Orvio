# Orvio Hub Mobile App (React Native + Expo SDK 57)

Cross-platform mobile application for **Orvio Hub** business operating system, providing mobile POS cashier terminal, real-time inventory management, member check-in pass validation, and multi-tenant organization switching.

---

## 🛠️ Tech Stack & Architecture

- **Framework**: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) with **Expo Router** (file-based navigation)
- **Styling**: [NativeWind v4](https://www.nativewind.dev) (Tailwind CSS for React Native)
- **State Management**: [Zustand](https://github.com/pmndrs/zustand)
- **Secure Token Encryption**: [expo-secure-store](https://docs.expo.dev/versions/latest/sdk/securestore/) (iOS Keychain & Android Keystore)
- **Data Caching & API Client**: [TanStack Query v5](https://tanstack.com/query/latest) + Multi-Tenant Fetch Client
- **Native Hardware Integration**:
  - `expo-camera`: High-speed barcode and QR code scanner for SKU lookup and member check-ins.
  - `expo-haptics`: Physical tactile feedback on transactions and buttons.
  - `@react-native-community/netinfo`: Network connectivity monitoring.
- **Icons**: `lucide-react-native`

---

## 📁 Project Structure

```
mobile/
├── app/
│   ├── (auth)/
│   │   ├── _layout.tsx         # Auth stack navigator
│   │   ├── index.tsx           # Subdomain workspace discovery (acme.orvio.com)
│   │   └── login.tsx           # Tenant password & magic link sign-in
│   ├── (tabs)/
│   │   ├── _layout.tsx         # Bottom tab navigation
│   │   ├── index.tsx           # Workspace Dashboard & sales overview
│   │   ├── pos.tsx             # POS Cashier Desk & quick charge
│   │   ├── scanner.tsx         # Barcode & Member QR scanner
│   │   └── settings.tsx        # Profile, workspace switcher & logout
│   ├── _layout.tsx             # Root layout with QueryClient & SafeAreaProvider
│   └── +not-found.tsx          # 404 fallback screen
├── src/
│   ├── components/
│   │   └── ui/
│   │       ├── Button.tsx      # Touchable with haptic feedback & variants
│   │       ├── Input.tsx       # Dark mode text input with icon slots
│   │       └── Card.tsx        # Glassmorphism container
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts       # Multi-tenant API client with auto-refresh
│   │   │   └── auth.ts         # Authentication API endpoints
│   │   └── storage/
│   │       └── secure-store.ts # SecureStore encrypted persistence
│   ├── stores/
│   │   └── auth-store.ts       # Zustand auth store with workspace context
│   └── types/
│       └── index.ts            # Shared TypeScript interfaces
├── assets/                     # App icons and splash screens
├── app.json                    # Expo configuration
├── babel.config.js             # Babel config for NativeWind
├── metro.config.js             # Metro bundler with NativeWind
├── tailwind.config.js          # Tailwind theme tokens
└── tsconfig.json               # TypeScript configuration
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js >= 22.13
- `pnpm` >= 10.x
- [Expo Go](https://expo.dev/client) app installed on physical iOS / Android device OR an active Android Emulator / iOS Simulator.

### 2. Install Dependencies
```bash
pnpm install --frozen-lockfile
```

### 3. Run the Development Server
```bash
# Start Metro bundler
pnpm start

# Run on Android Emulator / Device
pnpm android

# Run on iOS Simulator (macOS)
pnpm ios

# Run in Web Browser preview
pnpm web
```

### 4. API Connection Configuration
By default, the app points to:
- **Android Emulator**: `http://10.0.2.2:3000/api/v1`
- **iOS Simulator / Web**: `http://localhost:3000/api/v1`
- **Physical Device / Production**: Set `EXPO_PUBLIC_API_URL=http://<YOUR_LOCAL_IP>:3000/api/v1` in `.env`.
