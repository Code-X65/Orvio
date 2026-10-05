import React, { useState } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { ScanBarcode, RefreshCw, CheckCircle2 } from 'lucide-react-native';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Alert.alert('Barcode Scanned', `SKU / Member Pass ID: ${data}`, [
      { text: 'Scan Another', onPress: () => setScanned(false) },
    ]);
  };

  if (!permission) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center p-5">
        <Text className="text-xs text-slate-400">Requesting camera permissions...</Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView className="flex-1 bg-slate-950 items-center justify-center p-5">
        <Card className="w-full max-w-sm items-center text-center p-6 space-y-4">
          <View className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 items-center justify-center">
            <ScanBarcode color="#818cf8" size={28} />
          </View>
          <Text className="text-lg font-bold text-white text-center">Camera Access Required</Text>
          <Text className="text-xs text-slate-400 text-center">
            Orvio needs camera permissions to scan inventory barcodes and member QR check-in passes.
          </Text>
          <Button
            title="Grant Camera Permission"
            size="lg"
            onPress={requestPermission}
            className="w-full mt-2"
          />
        </Card>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-5 pt-3">
        {/* Top Header */}
        <View className="mb-4">
          <Text className="text-xl font-black text-white">Barcode & Pass Scanner</Text>
          <Text className="text-xs text-slate-400">Align barcode or member QR within frame</Text>
        </View>

        {/* Camera Viewfinder Box */}
        <View className="flex-1 rounded-3xl overflow-hidden border border-slate-800 bg-slate-900 relative justify-center items-center">
          <CameraView
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ['qr', 'ean13', 'ean8', 'code128', 'upc_a'],
            }}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            style={StyleSheet.absoluteFill}
          />

          {/* Target Reticle */}
          <View className="w-64 h-64 border-2 border-indigo-400/80 rounded-3xl items-center justify-center bg-transparent relative">
            <View className="w-full h-0.5 bg-indigo-500/80 shadow-lg shadow-indigo-500" />
          </View>

          {scanned && (
            <View className="absolute bottom-5 left-5 right-5">
              <Button
                title="Tap to Scan Again"
                variant="emerald"
                size="md"
                onPress={() => setScanned(false)}
                leftIcon={<RefreshCw color="#ffffff" size={16} />}
              />
            </View>
          )}
        </View>

        {/* Info */}
        <View className="mt-4 p-3.5 rounded-2xl bg-slate-900 border border-slate-800 flex-row items-center gap-3">
          <CheckCircle2 color="#34d399" size={18} />
          <Text className="text-xs text-slate-300 flex-1">
            Scanner automatically routes to inventory lookup or gym check-in pass validation.
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
