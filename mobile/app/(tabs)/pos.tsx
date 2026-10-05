import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ShoppingCart,
  Plus,
  Minus,
  CreditCard,
  Search,
} from 'lucide-react-native';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';

interface Item {
  id: string;
  name: string;
  price: number;
  stock: number;
  category: string;
}

const DEMO_ITEMS: Item[] = [
  { id: '1', name: 'Standard Day Pass', price: 2500, stock: 99, category: 'Pass' },
  { id: '2', name: 'Whey Protein 1kg', price: 28000, stock: 14, category: 'Supplements' },
  { id: '3', name: 'Isotonic Energy Drink', price: 1200, stock: 45, category: 'Drinks' },
  { id: '4', name: 'Monthly Gym Membership', price: 18000, stock: 999, category: 'Membership' },
  { id: '5', name: 'Lifting Grips / Straps', price: 6500, stock: 8, category: 'Gear' },
];

export default function PosScreen() {
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<Record<string, number>>({ '1': 2, '3': 1 });

  const filteredItems = DEMO_ITEMS.filter((item) =>
    item.name.toLowerCase().includes(search.toLowerCase())
  );

  const addToCart = (id: string) => {
    setCart((prev) => ({ ...prev, [id]: (prev[id] || 0) + 1 }));
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id] > 1) {
        next[id] -= 1;
      } else {
        delete next[id];
      }
      return next;
    });
  };

  const totalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = DEMO_ITEMS.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const totalItemsCount = Object.values(cart).reduce((sum, count) => sum + count, 0);

  const handleCheckout = () => {
    if (totalItemsCount === 0) return;
    Alert.alert(
      'Checkout Complete',
      `Payment of ₦${totalAmount.toLocaleString()} recorded successfully! Receipt sent.`,
      [{ text: 'OK', onPress: () => setCart({}) }]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-950">
      <View className="flex-1 px-5 pt-3">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-3">
          <View>
            <Text className="text-xl font-black text-white">POS Cashier Desk</Text>
            <Text className="text-xs text-slate-400">Quick checkout & sales terminal</Text>
          </View>
          <View className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
            <ShoppingCart color="#818cf8" size={16} />
            <Text className="text-xs font-bold text-indigo-400">{totalItemsCount} items</Text>
          </View>
        </View>

        {/* Search */}
        <View className="flex-row items-center bg-slate-900 border border-slate-800 rounded-xl px-3 h-10 mb-3">
          <Search color="#64748b" size={16} />
          <TextInput
            placeholder="Search catalog or barcode..."
            placeholderTextColor="#64748b"
            value={search}
            onChangeText={setSearch}
            className="flex-1 ml-2 text-xs text-white"
          />
        </View>

        {/* Catalog List */}
        <ScrollView className="flex-1 mb-3">
          <View className="space-y-2">
            {filteredItems.map((item) => {
              const inCartQty = cart[item.id] || 0;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.7}
                  onPress={() => addToCart(item.id)}
                  className={`p-3.5 rounded-2xl bg-slate-900/90 border flex-row items-center justify-between ${
                    inCartQty > 0 ? 'border-indigo-500/50 bg-indigo-950/20' : 'border-slate-800'
                  }`}
                >
                  <View className="flex-1">
                    <Text className="text-xs font-bold text-white">{item.name}</Text>
                    <Text className="text-[11px] text-slate-400 mt-0.5">
                      ₦{item.price.toLocaleString()} • {item.stock} in stock
                    </Text>
                  </View>

                  {inCartQty > 0 ? (
                    <View className="flex-row items-center gap-2">
                      <TouchableOpacity
                        onPress={() => removeFromCart(item.id)}
                        className="w-7 h-7 rounded-lg bg-slate-800 items-center justify-center"
                      >
                        <Minus color="#ffffff" size={12} />
                      </TouchableOpacity>
                      <Text className="text-xs font-bold text-indigo-400 min-w-[16px] text-center">
                        {inCartQty}
                      </Text>
                      <TouchableOpacity
                        onPress={() => addToCart(item.id)}
                        className="w-7 h-7 rounded-lg bg-indigo-600 items-center justify-center"
                      >
                        <Plus color="#ffffff" size={12} />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View className="w-8 h-8 rounded-xl bg-slate-800 items-center justify-center">
                      <Plus color="#94a3b8" size={16} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>

        {/* Checkout Card */}
        {totalItemsCount > 0 && (
          <Card className="mb-2 p-4 bg-slate-900 border-indigo-500/40">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-xs font-semibold text-slate-300">Total Payable</Text>
              <Text className="text-xl font-black text-white">₦{totalAmount.toLocaleString()}</Text>
            </View>
            <Button
              title={`Charge ₦${totalAmount.toLocaleString()}`}
              variant="emerald"
              size="lg"
              onPress={handleCheckout}
              leftIcon={<CreditCard color="#ffffff" size={16} />}
            />
          </Card>
        )}
      </View>
    </SafeAreaView>
  );
}
