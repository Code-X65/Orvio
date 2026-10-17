import React, { useState } from 'react';
import {
  Animated,
  Dimensions,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/use-theme';
import { OrvioLogo } from './orvio-logo';

interface DemoWorkspaceProps {
  onReopenTour: () => void;
}

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  price: number;
  stock: number;
  minAlert: number;
  icon: keyof typeof Ionicons.glyphMap;
}

const INITIAL_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-1',
    name: 'Wireless 2D Barcode Scanner Pro',
    sku: 'ORV-SC-902',
    category: 'POS Hardware',
    price: 38500,
    stock: 24,
    minAlert: 5,
    icon: 'barcode-outline',
  },
  {
    id: 'prod-2',
    name: 'Thermal Receipt Printer 80mm',
    sku: 'ORV-PR-401',
    category: 'POS Hardware',
    price: 52000,
    stock: 3,
    minAlert: 5,
    icon: 'print-outline',
  },
  {
    id: 'prod-3',
    name: 'Inventory Mobile Data Terminal',
    sku: 'ORV-TR-108',
    category: 'Electronics',
    price: 125000,
    stock: 14,
    minAlert: 4,
    icon: 'phone-portrait-outline',
  },
  {
    id: 'prod-4',
    name: 'Thermal Paper Rolls (50-Pack)',
    sku: 'ORV-PP-005',
    category: 'Accessories',
    price: 16000,
    stock: 2,
    minAlert: 10,
    icon: 'receipt-outline',
  },
  {
    id: 'prod-5',
    name: 'Heavy Duty 4-Slot Cash Drawer',
    sku: 'ORV-CD-202',
    category: 'POS Hardware',
    price: 44000,
    stock: 19,
    minAlert: 3,
    icon: 'file-tray-stacked-outline',
  },
  {
    id: 'prod-6',
    name: 'Customer Facing Display Screen',
    sku: 'ORV-DS-330',
    category: 'Electronics',
    price: 68000,
    stock: 8,
    minAlert: 2,
    icon: 'tv-outline',
  },
];

const BRANCHES = [
  { id: 'b1', name: 'Ikeja Flagship Hub', location: 'Lagos Mainland', status: 'Primary Hub' },
  { id: 'b2', name: 'Victoria Island Outlet', location: 'Lagos Island', status: 'Active Branch' },
  { id: 'b3', name: 'Abuja Central Depot', location: 'FCT Abuja', status: 'Distribution Hub' },
  { id: 'b4', name: 'Port Harcourt Store', location: 'Rivers State', status: 'Retail Store' },
];

export function DemoWorkspace({ onReopenTour }: DemoWorkspaceProps) {
  const theme = useTheme();

  // State
  const [selectedBranch, setSelectedBranch] = useState(BRANCHES[0]);
  const [branchModalVisible, setBranchModalVisible] = useState(false);
  const [posModalVisible, setPosModalVisible] = useState(false);
  const [scannerModalVisible, setScannerModalVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sales & Inventory dynamic state
  const [totalSales, setTotalSales] = useState(845200);
  const [ordersCount, setOrdersCount] = useState(38);
  const [products, setProducts] = useState<ProductItem[]>(INITIAL_PRODUCTS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  // Checkout modal form
  const [selectedSaleProduct, setSelectedSaleProduct] = useState<ProductItem>(products[0]);
  const [saleQuantity, setSaleQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState<'transfer' | 'card' | 'cash'>('transfer');
  const [saleSuccess, setSaleSuccess] = useState(false);

  const categories = ['All', 'POS Hardware', 'Electronics', 'Accessories', 'Low Stock'];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3200);
  };

  // Handle instant item sale
  const handleQuickSell = (prod: ProductItem) => {
    if (prod.stock <= 0) {
      showToast(`⚠️ Cannot sell ${prod.name}: Out of Stock!`);
      return;
    }

    setProducts((prev) =>
      prev.map((item) => (item.id === prod.id ? { ...item, stock: item.stock - 1 } : item))
    );
    setTotalSales((prev) => prev + prod.price);
    setOrdersCount((prev) => prev + 1);
    showToast(`⚡ Sold 1x ${prod.name}! +₦${prod.price.toLocaleString()} added to register`);
  };

  // Restock action
  const handleRestock = (prodId: string) => {
    setProducts((prev) =>
      prev.map((item) => (item.id === prodId ? { ...item, stock: item.stock + 10 } : item))
    );
    showToast(`📦 Restocked +10 units to inventory!`);
  };

  // Submit POS checkout
  const handleCompleteSale = () => {
    if (selectedSaleProduct.stock < saleQuantity) {
      showToast('⚠️ Not enough stock available!');
      return;
    }

    const saleAmount = selectedSaleProduct.price * saleQuantity;
    setProducts((prev) =>
      prev.map((item) =>
        item.id === selectedSaleProduct.id ? { ...item, stock: item.stock - saleQuantity } : item
      )
    );
    setTotalSales((prev) => prev + saleAmount);
    setOrdersCount((prev) => prev + 1);
    setSaleSuccess(true);

    setTimeout(() => {
      setSaleSuccess(false);
      setPosModalVisible(false);
      showToast(
        `✅ Sale complete! ₦${saleAmount.toLocaleString()} recorded. WhatsApp receipt dispatched.`
      );
    }, 1400);
  };

  // Filter products
  const filteredProducts = products.filter((item) => {
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase());
    if (!matchesSearch) return false;

    if (selectedCategory === 'All') return true;
    if (selectedCategory === 'Low Stock') return item.stock <= item.minAlert;
    return item.category === selectedCategory;
  });

  const lowStockCount = products.filter((p) => p.stock <= p.minAlert).length;

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Toast Notification */}
      {toastMessage && (
        <View style={[styles.toastBanner, { backgroundColor: theme.primary }]}>
          <Ionicons name="notifications-outline" size={16} color="#FFFFFF" />
          <Text style={styles.toastText} numberOfLines={2}>
            {toastMessage}
          </Text>
        </View>
      )}

      {/* Workspace App Header */}
      <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
        <View style={styles.headerLeft}>
          <OrvioLogo size={34} showGlow={false} />
          <View>
            <View style={styles.brandTitleRow}>
              <Text style={[styles.brandTitle, { color: theme.text }]}>Orvio Hub</Text>
              <View style={[styles.osTag, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.osTagText, { color: theme.primary }]}>RETAIL OS</Text>
              </View>
            </View>

            {/* Interactive Branch Switcher Trigger */}
            <Pressable
              onPress={() => setBranchModalVisible(true)}
              style={({ pressed }) => [styles.branchPill, pressed && styles.pressed]}
            >
              <View style={[styles.activeDot, { backgroundColor: theme.success }]} />
              <Text style={[styles.branchName, { color: theme.textSecondary }]} numberOfLines={1}>
                {selectedBranch.name}
              </Text>
              <Ionicons name="chevron-down" size={13} color={theme.textSecondary} />
            </Pressable>
          </View>
        </View>

        {/* Right Header Actions */}
        <View style={styles.headerRight}>
          {/* Re-open Tour Pill */}
          <Pressable
            onPress={onReopenTour}
            style={({ pressed }) => [
              styles.tourButton,
              { backgroundColor: theme.primaryLight, borderColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="sparkles" size={13} color={theme.primary} />
            <Text style={[styles.tourButtonText, { color: theme.primary }]}>Tour</Text>
          </Pressable>

          {/* Quick Notification Bell */}
          <Pressable
            onPress={() =>
              showToast(
                `🔔 Live Notifications: 3 branches synced. Low stock alert for ${lowStockCount} items.`
              )
            }
            style={({ pressed }) => [
              styles.iconBtn,
              { backgroundColor: theme.backgroundElement },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="notifications" size={18} color={theme.text} />
            {lowStockCount > 0 && <View style={styles.notifBadge} />}
          </Pressable>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Live Network Status Banner */}
        <View
          style={[
            styles.syncBanner,
            { backgroundColor: theme.successLight, borderColor: theme.success },
          ]}
        >
          <View style={styles.syncLeft}>
            <View style={[styles.pulseBeacon, { backgroundColor: theme.success }]} />
            <Text style={[styles.syncText, { color: theme.success }]}>
              Connected to <Text style={{ fontWeight: '800' }}>{selectedBranch.name}</Text> • Cloud
              Sync Real-time
            </Text>
          </View>
          <Text style={[styles.subdomainTag, { color: theme.textSecondary }]}>
            ikeja.orvio.hub
          </Text>
        </View>

        {/* KPI Metrics Dashboard Cards */}
        <View style={styles.kpiGrid}>
          {/* Sales Card */}
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Today's Sales</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: theme.primaryLight }]}>
                <Ionicons name="cash-outline" size={16} color={theme.primary} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>
              ₦{totalSales.toLocaleString()}
            </Text>
            <View style={styles.kpiTrendRow}>
              <Ionicons name="trending-up" size={14} color={theme.success} />
              <Text style={[styles.kpiTrendText, { color: theme.success }]}>+14.2% vs yesterday</Text>
            </View>
          </View>

          {/* Orders Card */}
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Completed Orders</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: theme.secondaryLight }]}>
                <Ionicons name="bag-check-outline" size={16} color={theme.secondaryDark} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>{ordersCount}</Text>
            <Text style={[styles.kpiSubtext, { color: theme.textSecondary }]}>
              All receipts logged & synced
            </Text>
          </View>

          {/* Low Stock Warning Card */}
          <View
            style={[
              styles.kpiCard,
              {
                backgroundColor: theme.card,
                borderColor: lowStockCount > 0 ? theme.danger : theme.cardBorder,
              },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Stock Alerts</Text>
              <View
                style={[
                  styles.kpiIconWrap,
                  { backgroundColor: lowStockCount > 0 ? theme.dangerLight : theme.backgroundElement },
                ]}
              >
                <Ionicons
                  name="alert-circle-outline"
                  size={16}
                  color={lowStockCount > 0 ? theme.danger : theme.textSecondary}
                />
              </View>
            </View>
            <Text
              style={[
                styles.kpiValue,
                { color: lowStockCount > 0 ? theme.danger : theme.text },
              ]}
            >
              {lowStockCount} {lowStockCount === 1 ? 'Item' : 'Items'}
            </Text>
            <Text style={[styles.kpiSubtext, { color: theme.textSecondary }]}>
              {lowStockCount > 0 ? 'Action required below' : 'Inventory optimal'}
            </Text>
          </View>

          {/* Active Registers Card */}
          <View
            style={[
              styles.kpiCard,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
            ]}
          >
            <View style={styles.kpiHeaderRow}>
              <Text style={[styles.kpiLabel, { color: theme.textSecondary }]}>Active POS</Text>
              <View style={[styles.kpiIconWrap, { backgroundColor: theme.accentLight }]}>
                <Ionicons name="hardware-chip-outline" size={16} color={theme.accent} />
              </View>
            </View>
            <Text style={[styles.kpiValue, { color: theme.text }]}>2 Registers</Text>
            <Text style={[styles.kpiSubtext, { color: theme.textSecondary }]}>
              Cashier: Jane D. & Tunde A.
            </Text>
          </View>
        </View>

        {/* Quick Action Shortcuts */}
        <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Operations</Text>
        <View style={styles.quickActionRow}>
          {/* New Sale POS Trigger */}
          <Pressable
            onPress={() => {
              setSelectedSaleProduct(products[0]);
              setSaleQuantity(1);
              setPosModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.primary },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="flash" size={18} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>New POS Sale</Text>
          </Pressable>

          {/* Barcode Scanner */}
          <Pressable
            onPress={() => setScannerModalVisible(true)}
            style={({ pressed }) => [
              styles.actionButtonSecondary,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="scan-outline" size={18} color={theme.primary} />
            <Text style={[styles.actionButtonSecondaryText, { color: theme.text }]}>
              Scan Barcode
            </Text>
          </Pressable>

          {/* Restock All Low Items */}
          <Pressable
            onPress={() => {
              setProducts((prev) =>
                prev.map((item) =>
                  item.stock <= item.minAlert ? { ...item, stock: item.stock + 15 } : item
                )
              );
              showToast('📦 Batch Restocked all low-inventory items (+15 units each)!');
            }}
            style={({ pressed }) => [
              styles.actionButtonSecondary,
              { backgroundColor: theme.card, borderColor: theme.cardBorder },
              pressed && styles.pressed,
            ]}
          >
            <Ionicons name="cube-outline" size={18} color={theme.secondaryDark} />
            <Text style={[styles.actionButtonSecondaryText, { color: theme.text }]}>Restock</Text>
          </Pressable>
        </View>

        {/* Interactive Inventory & Catalog Section */}
        <View style={styles.catalogHeaderRow}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Branch Inventory Catalog</Text>
            <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
              Tap '+1 Sale' to ring up items live or tap product to adjust
            </Text>
          </View>
        </View>

        {/* Search Bar */}
        <View
          style={[
            styles.searchContainer,
            { backgroundColor: theme.card, borderColor: theme.cardBorder },
          ]}
        >
          <Ionicons name="search" size={18} color={theme.textSecondary} />
          <TextInput
            placeholder="Search items by name or SKU..."
            placeholderTextColor={theme.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: theme.text }]}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')} hitSlop={10}>
              <Ionicons name="close-circle" size={16} color={theme.textSecondary} />
            </Pressable>
          )}
        </View>

        {/* Category Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryPillsList}
        >
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <Pressable
                key={cat}
                onPress={() => setSelectedCategory(cat)}
                style={[
                  styles.categoryPill,
                  isSelected
                    ? { backgroundColor: theme.primary, borderColor: theme.primary }
                    : { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <Text
                  style={[
                    styles.categoryPillText,
                    { color: isSelected ? '#FFFFFF' : theme.textSecondary },
                  ]}
                >
                  {cat}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {/* Product Cards Feed */}
        <View style={styles.productsList}>
          {filteredProducts.map((prod) => {
            const isLowStock = prod.stock <= prod.minAlert;
            const isOutOfStock = prod.stock === 0;

            return (
              <View
                key={prod.id}
                style={[
                  styles.productCard,
                  { backgroundColor: theme.card, borderColor: theme.cardBorder },
                ]}
              >
                <View style={styles.prodMainRow}>
                  {/* Product Icon Box */}
                  <View
                    style={[
                      styles.prodIconWrap,
                      {
                        backgroundColor: isLowStock ? theme.dangerLight : theme.backgroundElement,
                      },
                    ]}
                  >
                    <Ionicons
                      name={prod.icon}
                      size={22}
                      color={isLowStock ? theme.danger : theme.primary}
                    />
                  </View>

                  {/* Product Details */}
                  <View style={styles.prodDetails}>
                    <Text style={[styles.prodName, { color: theme.text }]}>{prod.name}</Text>
                    <View style={styles.prodMetaRow}>
                      <Text style={[styles.prodSku, { color: theme.textSecondary }]}>
                        {prod.sku} • {prod.category}
                      </Text>
                    </View>
                    <Text style={[styles.prodPrice, { color: theme.text }]}>
                      ₦{prod.price.toLocaleString()}
                    </Text>
                  </View>

                  {/* Stock Status Badge */}
                  <View style={styles.prodStockCol}>
                    <View
                      style={[
                        styles.stockBadge,
                        {
                          backgroundColor: isOutOfStock
                            ? theme.dangerLight
                            : isLowStock
                            ? theme.warningLight
                            : theme.successLight,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.stockBadgeText,
                          {
                            color: isOutOfStock
                              ? theme.danger
                              : isLowStock
                              ? theme.warning
                              : theme.success,
                          },
                        ]}
                      >
                        {isOutOfStock
                          ? 'Out of Stock'
                          : isLowStock
                          ? `Low: ${prod.stock} left`
                          : `${prod.stock} in stock`}
                      </Text>
                    </View>

                    {/* Action Button: +1 Quick Sale */}
                    <Pressable
                      onPress={() => handleQuickSell(prod)}
                      style={({ pressed }) => [
                        styles.quickSellBtn,
                        {
                          backgroundColor: isOutOfStock ? theme.cardBorder : theme.primary,
                        },
                        pressed && styles.pressed,
                      ]}
                      disabled={isOutOfStock}
                    >
                      <Ionicons name="cart-outline" size={13} color="#FFFFFF" />
                      <Text style={styles.quickSellBtnText}>+1 Sale</Text>
                    </Pressable>
                  </View>
                </View>

                {/* Card Sub-actions if Low Stock */}
                {isLowStock && (
                  <View
                    style={[
                      styles.lowStockWarningBar,
                      { backgroundColor: theme.dangerLight, borderColor: theme.danger },
                    ]}
                  >
                    <Ionicons name="warning-outline" size={14} color={theme.danger} />
                    <Text style={[styles.lowStockWarningText, { color: theme.danger }]}>
                      Threshold breached (Min: {prod.minAlert}).
                    </Text>
                    <Pressable onPress={() => handleRestock(prod.id)} hitSlop={6}>
                      <Text style={[styles.quickRestockLink, { color: theme.primary }]}>
                        Restock +10
                      </Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })}

          {filteredProducts.length === 0 && (
            <View style={styles.emptyState}>
              <Ionicons name="file-tray-outline" size={40} color={theme.textSecondary} />
              <Text style={[styles.emptyStateTitle, { color: theme.text }]}>No products found</Text>
              <Text style={[styles.emptyStateSub, { color: theme.textSecondary }]}>
                Try adjusting your search query or selected filter category.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* MODAL 1: Branch Switcher */}
      <Modal
        visible={branchModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setBranchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: theme.text }]}>Switch Branch Location</Text>
                <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                  Select a registered business outlet
                </Text>
              </View>
              <Pressable onPress={() => setBranchModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            <View style={styles.branchList}>
              {BRANCHES.map((branch) => {
                const isCurrent = branch.id === selectedBranch.id;
                return (
                  <Pressable
                    key={branch.id}
                    onPress={() => {
                      setSelectedBranch(branch);
                      setBranchModalVisible(false);
                      showToast(`📍 Switched active location to ${branch.name}`);
                    }}
                    style={[
                      styles.branchItem,
                      isCurrent
                        ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                        : { backgroundColor: theme.backgroundElement, borderColor: 'transparent' },
                    ]}
                  >
                    <View style={styles.branchItemLeft}>
                      <Ionicons
                        name={isCurrent ? 'radio-button-on' : 'radio-button-off'}
                        size={18}
                        color={isCurrent ? theme.primary : theme.textSecondary}
                      />
                      <View>
                        <Text style={[styles.branchItemName, { color: theme.text }]}>
                          {branch.name}
                        </Text>
                        <Text style={[styles.branchItemLoc, { color: theme.textSecondary }]}>
                          {branch.location} • {branch.status}
                        </Text>
                      </View>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentPill, { backgroundColor: theme.primary }]}>
                        <Text style={styles.currentPillText}>Active</Text>
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: Interactive POS Checkout Sheet */}
      <Modal
        visible={posModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPosModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: theme.card, borderColor: theme.cardBorder }]}>
            <View style={styles.modalHeader}>
              <View style={styles.posHeaderRow}>
                <View style={[styles.posBadge, { backgroundColor: theme.primaryLight }]}>
                  <Ionicons name="receipt" size={18} color={theme.primary} />
                </View>
                <View>
                  <Text style={[styles.modalTitle, { color: theme.text }]}>New POS Checkout</Text>
                  <Text style={[styles.modalSubtitle, { color: theme.textSecondary }]}>
                    Ring up customer & send WhatsApp e-receipt
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setPosModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color={theme.text} />
              </Pressable>
            </View>

            {saleSuccess ? (
              <View style={styles.successBox}>
                <Ionicons name="checkmark-circle" size={54} color={theme.success} />
                <Text style={[styles.successTitle, { color: theme.text }]}>Transaction Approved!</Text>
                <Text style={[styles.successSub, { color: theme.textSecondary }]}>
                  Payment verified and WhatsApp receipt dispatched.
                </Text>
              </View>
            ) : (
              <>
                {/* Select Product */}
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Select Item to Ring Up
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.posItemsScroll}>
                  {products.map((item) => {
                    const isSelected = item.id === selectedSaleProduct.id;
                    return (
                      <Pressable
                        key={item.id}
                        onPress={() => setSelectedSaleProduct(item)}
                        style={[
                          styles.posItemCard,
                          isSelected
                            ? { backgroundColor: theme.primaryLight, borderColor: theme.primary }
                            : { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                        ]}
                      >
                        <Text
                          style={[styles.posItemName, { color: theme.text }]}
                          numberOfLines={1}
                        >
                          {item.name}
                        </Text>
                        <Text style={[styles.posItemPrice, { color: theme.primary }]}>
                          ₦{item.price.toLocaleString()}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {/* Quantity Control */}
                <View style={styles.qtyRow}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Quantity</Text>
                  <View style={styles.qtyControl}>
                    <Pressable
                      onPress={() => setSaleQuantity((q) => Math.max(1, q - 1))}
                      style={[styles.qtyBtn, { backgroundColor: theme.backgroundElement }]}
                    >
                      <Ionicons name="remove" size={16} color={theme.text} />
                    </Pressable>
                    <Text style={[styles.qtyValue, { color: theme.text }]}>{saleQuantity}</Text>
                    <Pressable
                      onPress={() => setSaleQuantity((q) => q + 1)}
                      style={[styles.qtyBtn, { backgroundColor: theme.backgroundElement }]}
                    >
                      <Ionicons name="add" size={16} color={theme.text} />
                    </Pressable>
                  </View>
                </View>

                {/* Payment Method Selector */}
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
                  Payment Method
                </Text>
                <View style={styles.paymentMethodRow}>
                  {[
                    { id: 'transfer', label: 'Bank Transfer', icon: 'phone-portrait-outline' },
                    { id: 'card', label: 'POS Card', icon: 'card-outline' },
                    { id: 'cash', label: 'Cash', icon: 'cash-outline' },
                  ].map((m) => {
                    const isSelected = paymentMethod === m.id;
                    return (
                      <Pressable
                        key={m.id}
                        onPress={() => setPaymentMethod(m.id as any)}
                        style={[
                          styles.payOption,
                          isSelected
                            ? { backgroundColor: theme.primary, borderColor: theme.primary }
                            : { backgroundColor: theme.backgroundElement, borderColor: theme.cardBorder },
                        ]}
                      >
                        <Ionicons
                          name={m.icon as any}
                          size={16}
                          color={isSelected ? '#FFFFFF' : theme.text}
                        />
                        <Text
                          style={[
                            styles.payOptionText,
                            { color: isSelected ? '#FFFFFF' : theme.text },
                          ]}
                        >
                          {m.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* Total Summary */}
                <View style={[styles.checkoutSummary, { backgroundColor: theme.backgroundElement }]}>
                  <Text style={[styles.summaryLabel, { color: theme.textSecondary }]}>
                    Total Due ({saleQuantity} item{saleQuantity > 1 ? 's' : ''})
                  </Text>
                  <Text style={[styles.summaryAmount, { color: theme.text }]}>
                    ₦{(selectedSaleProduct.price * saleQuantity).toLocaleString()}
                  </Text>
                </View>

                {/* Complete Sale Button */}
                <Pressable
                  onPress={handleCompleteSale}
                  style={({ pressed }) => [
                    styles.completeSaleBtn,
                    { backgroundColor: theme.primary },
                    pressed && styles.pressed,
                  ]}
                >
                  <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.completeSaleText}>
                    Charge ₦{(selectedSaleProduct.price * saleQuantity).toLocaleString()}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* MODAL 3: Barcode Scanner Simulation */}
      <Modal
        visible={scannerModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScannerModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalBox, { backgroundColor: '#0B0F17', borderColor: '#232D3F' }]}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: '#F8FAFC' }]}>Mobile Barcode Scanner</Text>
                <Text style={[styles.modalSubtitle, { color: '#94A3B8' }]}>
                  Align barcode inside the viewfinder
                </Text>
              </View>
              <Pressable onPress={() => setScannerModalVisible(false)} hitSlop={10}>
                <Ionicons name="close" size={22} color="#F8FAFC" />
              </Pressable>
            </View>

            {/* Viewfinder simulation */}
            <View style={styles.viewFinderContainer}>
              <View style={styles.scannerLaser} />
              <Ionicons name="scan-outline" size={140} color="#985184" />
              <Text style={styles.viewFinderHelp}>Aiming camera at product barcode...</Text>
            </View>

            {/* Quick Simulate Buttons */}
            <Text style={styles.scannerPrompt}>Tap to simulate scanning an item:</Text>
            <View style={styles.scanSimulateRow}>
              <Pressable
                onPress={() => {
                  setScannerModalVisible(false);
                  handleQuickSell(products[0]);
                }}
                style={[styles.scanQuickBtn, { backgroundColor: '#181E29' }]}
              >
                <Ionicons name="barcode" size={16} color="#FBB945" />
                <Text style={styles.scanQuickText}>Scan Scanner Pro</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setScannerModalVisible(false);
                  handleQuickSell(products[1]);
                }}
                style={[styles.scanQuickBtn, { backgroundColor: '#181E29' }]}
              >
                <Ionicons name="barcode" size={16} color="#FBB945" />
                <Text style={styles.scanQuickText}>Scan Receipt Printer</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toastBanner: {
    position: 'absolute',
    top: Platform.select({ ios: 46, android: 16, default: 16 }),
    left: 20,
    right: 20,
    zIndex: 9999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.select({ ios: 12, android: 14, default: 14 }),
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  brandTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  osTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  osTagText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  branchPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 2,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  branchName: {
    fontSize: 12,
    fontWeight: '600',
    maxWidth: 160,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tourButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
  },
  tourButtonText: {
    fontSize: 12,
    fontWeight: '700',
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute',
    top: 7,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EF4444',
  },
  pressed: {
    opacity: 0.7,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  syncBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  syncLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  pulseBeacon: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  syncText: {
    fontSize: 12,
    fontWeight: '600',
  },
  subdomainTag: {
    fontSize: 11,
    fontWeight: '600',
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
  },
  kpiCard: {
    width: (Dimensions.get('window').width - 44) / 2,
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  kpiHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  kpiLabel: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiIconWrap: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  kpiTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  kpiTrendText: {
    fontSize: 11,
    fontWeight: '700',
  },
  kpiSubtext: {
    fontSize: 11,
    fontWeight: '500',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 12,
    marginBottom: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1.3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    shadowColor: '#985184',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
  },
  actionButtonSecondaryText: {
    fontSize: 12,
    fontWeight: '700',
  },
  catalogHeaderRow: {
    marginBottom: 8,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    height: '100%',
  },
  categoryPillsList: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  categoryPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  productsList: {
    gap: 12,
  },
  productCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 2,
  },
  prodMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  prodIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prodDetails: {
    flex: 1,
  },
  prodName: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 2,
  },
  prodMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  prodSku: {
    fontSize: 11,
  },
  prodPrice: {
    fontSize: 14,
    fontWeight: '800',
  },
  prodStockCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  stockBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  stockBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  quickSellBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  quickSellBtnText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  lowStockWarningBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
  },
  lowStockWarningText: {
    fontSize: 11,
    fontWeight: '600',
    flex: 1,
    marginLeft: 6,
  },
  quickRestockLink: {
    fontSize: 11,
    fontWeight: '800',
    textDecorationLine: 'underline',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 15,
    fontWeight: '700',
  },
  emptyStateSub: {
    fontSize: 12,
    textAlign: 'center',
    paddingHorizontal: 20,
  },

  /* Modals */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalBox: {
    width: '100%',
    maxWidth: 480,
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  branchList: {
    gap: 10,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  branchItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  branchItemName: {
    fontSize: 13,
    fontWeight: '700',
  },
  branchItemLoc: {
    fontSize: 11,
    marginTop: 1,
  },
  currentPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  currentPillText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  /* POS Checkout Modal Styles */
  posHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  posBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 6,
  },
  posItemsScroll: {
    marginBottom: 14,
  },
  posItemCard: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 160,
  },
  posItemName: {
    fontSize: 12,
    fontWeight: '600',
  },
  posItemPrice: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
  qtyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  qtyControl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  qtyBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  qtyValue: {
    fontSize: 16,
    fontWeight: '800',
    minWidth: 20,
    textAlign: 'center',
  },
  paymentMethodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  payOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  payOptionText: {
    fontSize: 11,
    fontWeight: '700',
  },
  checkoutSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  summaryAmount: {
    fontSize: 18,
    fontWeight: '800',
  },
  completeSaleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 12,
  },
  completeSaleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  successBox: {
    alignItems: 'center',
    paddingVertical: 24,
    gap: 10,
  },
  successTitle: {
    fontSize: 18,
    fontWeight: '800',
  },
  successSub: {
    fontSize: 13,
    textAlign: 'center',
  },

  /* Scanner Modal Styles */
  viewFinderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 200,
    backgroundColor: '#0F141E',
    borderRadius: 14,
    marginVertical: 12,
    position: 'relative',
    overflow: 'hidden',
  },
  scannerLaser: {
    position: 'absolute',
    top: '50%',
    left: '10%',
    right: '10%',
    height: 2,
    backgroundColor: '#FBB945',
    shadowColor: '#FBB945',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  viewFinderHelp: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  scannerPrompt: {
    color: '#F8FAFC',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  scanSimulateRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scanQuickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  scanQuickText: {
    color: '#F8FAFC',
    fontSize: 11,
    fontWeight: '700',
  },
});
