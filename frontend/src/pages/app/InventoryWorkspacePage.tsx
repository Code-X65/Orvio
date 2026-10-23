import * as React from 'react';
import {
  Package,
  Plus,
  LayoutDashboard,
  FolderTree,
  Boxes,
  ShoppingCart,
  Users,
  FileText,
  RotateCcw,
  BarChart3,
  Settings,
  Search,
  Bell,
  Mail,
  ChevronDown,
  TrendingDown,
  TrendingUp,
  ShoppingBag,
  SlidersHorizontal,
  MoreVertical,
  CheckCircle2,
  Clock,
  Menu,
  X,
  Sparkles,
  Store,
  LayoutGrid,
  Award,
  Layers,
  PanelLeftClose,
  PanelLeftOpen,
  UserCheck,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { SeoHead } from '../../components/seo/SeoHead';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { CategoriesPage } from '../../features/inventory/components/CategoriesPage';
import { BrandsPage } from '../../features/inventory/components/BrandsPage';
import { ProductsPage } from '../../features/inventory/components/ProductsPage';
import { StockManagementPage } from '../../features/inventory/components/StockManagementPage';
import { SuppliersPage } from '../../features/inventory/components/SuppliersPage';
import { StaffListPage } from '../../features/staff/components/StaffListPage';
import { OperationalSectionView, type OperationalSection } from '../../features/inventory/components/OperationalSectionView';
import { BranchManagementModal } from '../../features/inventory/components/BranchManagementModal';
import { AddBranchWizardModal } from '../../features/inventory/components/AddBranchWizardModal';
import { BranchSwitchingOverlay } from '../../components/ui/BranchSwitchingOverlay';
import { branchApi } from '../../features/inventory/branches-api';
import { useOrgWebSocket } from '../../hooks/useOrgWebSocket';
import { useAuthStore } from '../../stores/auth-store';
import { toast } from 'sonner';
import { useUrlActionState } from '../../hooks/useUrlActionState';
import { CatalogSearchModal } from '../../features/inventory/components/CatalogSearchModal';
import { getJwtPayload } from '../../lib/api/token-utils';
import { AccessRevocationModal } from '../../components/auth/AccessRevocationModal';
import { getAccountsBaseUrl } from '../../app/config/authUrls';
import {
  DashboardPerspectivePill,
  type DashboardPerspective,
} from '../../features/inventory/components/dashboard/DashboardPerspectivePill';
import { ExecutiveDashboardView } from '../../features/inventory/components/dashboard/ExecutiveDashboardView';
import { CashierDashboardView } from '../../features/inventory/components/dashboard/CashierDashboardView';
import { StorekeeperDashboardView } from '../../features/inventory/components/dashboard/StorekeeperDashboardView';
import { useBranchCatalog } from '../../features/inventory/hooks';
import { RoleChangeTransitionOverlay } from '../../components/ui/RoleChangeTransitionOverlay';

interface InventoryWorkspacePageProps {
  organization: {
    id?: string;
    name: string;
    subdomain: string;
    currency: string;
    business_type?: string;
  };
  branch: {
    id: string;
    name: string;
    code?: string | null;
    type: string;
    is_primary?: boolean;
  } | null;
  branches: Array<{
    id: string;
    name: string;
    code?: string | null;
    type: string;
    is_primary?: boolean;
  }>;
}

export function InventoryWorkspacePage({
  organization,
  branch,
  branches,
}: InventoryWorkspacePageProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const { status: wsStatus } = useOrgWebSocket(organization.id, accessToken);

  // Compute authenticated user role & branch permissions from JWT claims
  const jwtClaims = React.useMemo(() => {
    if (!accessToken) return null;
    return getJwtPayload<{
      role?: string;
      org_role?: string;
      scope_all_branches?: boolean;
      branch_scope?: string[];
      branch_roles?: Record<string, string>;
    }>(accessToken);
  }, [accessToken]);

  const [activeRoleOverride, setActiveRoleOverride] = React.useState<string | null>(null);
  const [branchRolesMap, setBranchRolesMap] = React.useState<Record<string, string>>(() => jwtClaims?.branch_roles || {});

  // Sync branchRolesMap if JWT claims update after silent refresh
  React.useEffect(() => {
    if (jwtClaims?.branch_roles) {
      setBranchRolesMap((prev) => ({ ...prev, ...jwtClaims.branch_roles }));
    }
  }, [jwtClaims?.branch_roles]);
  const baseOrgRole = (activeRoleOverride || jwtClaims?.org_role || jwtClaims?.role || 'owner').toLowerCase();
  const isElevatedBase = baseOrgRole === 'owner' || baseOrgRole === 'manager';
  const hasGlobalBranchScope = isElevatedBase || Boolean(jwtClaims?.scope_all_branches);
  const permittedBranchScope = jwtClaims?.branch_scope || [];

  // Scoped branches for non-elevated staff
  const scopedInitialBranches = React.useMemo(() => {
    const base = branches || [];
    if (hasGlobalBranchScope || permittedBranchScope.length === 0) return base;
    return base.filter((b) => permittedBranchScope.includes(b.id));
  }, [branches, hasGlobalBranchScope, permittedBranchScope]);

  const [branchList, setBranchList] = React.useState(scopedInitialBranches);
  const [isBranchModalOpen, setIsBranchModalOpen] = React.useState(false);
  const [isAddBranchWizardOpen, setIsAddBranchWizardOpen] = React.useState(false);
  const [isSwitchingBranch, setIsSwitchingBranch] = React.useState(false);
  const [switchingTargetName, setSwitchingTargetName] = React.useState('');
  const [switchingSourceName, setSwitchingSourceName] = React.useState<string | null>(null);
  const [isSearchModalOpen, setIsSearchModalOpen] = React.useState(false);
  const orgKey = organization.id || organization.subdomain;

  // Initialize selectedBranchId from URL query param (?branch=...) or sessionStorage or default branch
  const [selectedBranchId, setSelectedBranchId] = React.useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const paramBranch = params.get('branch');
    const available = scopedInitialBranches.length > 0 ? scopedInitialBranches : (branches || []);

    if (hasGlobalBranchScope) {
      if (paramBranch === 'all') return 'all';
      if (paramBranch && available.some((b) => b.id === paramBranch)) return paramBranch;
      const sessionBranch = sessionStorage.getItem(`orvio.selectedBranch.${orgKey}`);
      if (sessionBranch === 'all') return 'all';
      if (sessionBranch && available.some((b) => b.id === sessionBranch)) return sessionBranch;
      return branch?.id || available[0]?.id || 'all';
    } else {
      // Subordinate role: MUST be a specific authorized branch
      if (paramBranch && available.some((b) => b.id === paramBranch)) return paramBranch;
      const sessionBranch = sessionStorage.getItem(`orvio.selectedBranch.${orgKey}`);
      if (sessionBranch && available.some((b) => b.id === sessionBranch)) return sessionBranch;
      return branch?.id || available[0]?.id || '';
    }
  });

  const selectedBranch = React.useMemo(() => {
    if (selectedBranchId === 'all') return null;
    return branchList.find((b) => b.id === selectedBranchId) || branchList[0] || null;
  }, [selectedBranchId, branchList]);

  // Resolve effective role for the currently active branch
  const effectiveRole = React.useMemo<string>(() => {
    if (baseOrgRole === 'owner') return 'owner';
    if (selectedBranchId && selectedBranchId !== 'all' && branchRolesMap[selectedBranchId]) {
      return branchRolesMap[selectedBranchId].toLowerCase();
    }
    return baseOrgRole;
  }, [baseOrgRole, selectedBranchId, branchRolesMap]);

  const rawRole = effectiveRole;
  const isOwner = rawRole === 'owner';
  const isManager = rawRole === 'manager';
  const isCashier = rawRole === 'cashier';
  const isStorekeeper = rawRole === 'storekeeper';
  const isElevated = isOwner || isManager;

  // Role Change Transition Modal state (with 3-second animated countdown)
  const [roleTransitionModal, setRoleTransitionModal] = React.useState<{
    isOpen: boolean;
    branchName: string;
    oldRole: string;
    newRole: string;
  }>({
    isOpen: false,
    branchName: '',
    oldRole: '',
    newRole: '',
  });

  // Dashboard perspective state (defaults based on authenticated role, switchable for Owners/Managers)
  const [dashboardPerspective, setDashboardPerspective] = React.useState<DashboardPerspective>(() => {
    if (isCashier) return 'cashier';
    if (isStorekeeper) return 'storekeeper';
    return 'executive';
  });

  // Keep perspective in sync if user role updates in real-time
  React.useEffect(() => {
    if (isCashier) setDashboardPerspective('cashier');
    else if (isStorekeeper) setDashboardPerspective('storekeeper');
    else if (isElevated) setDashboardPerspective('executive');
  }, [isCashier, isStorekeeper, isElevated]);

  // Real-time Access Revocation / Ejection Modal State
  const [revocationModal, setRevocationModal] = React.useState<{
    isOpen: boolean;
    type: 'branch' | 'organization';
    branchName?: string;
    organizationName?: string;
    remainingBranchId?: string;
    remainingBranchName?: string;
  }>({
    isOpen: false,
    type: 'branch',
  });

  // Listen for real-time access revocation events (WebSocket and BroadcastChannel)
  React.useEffect(() => {
    const handleRevocation = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        type: string;
        payload?: Record<string, unknown>;
        orgId?: string;
      }>;
      const { type, payload } = customEvt.detail || {};
      const targetUserId = payload?.userId as string | undefined;
      const currentUserId = user?.id;

      if (!targetUserId || !currentUserId || targetUserId !== currentUserId) {
        return;
      }

      // Tier 1: Organization-level revocation or suspension
      if (type === 'staff:suspended' || type === 'staff:removed') {
        setRevocationModal({
          isOpen: true,
          type: 'organization',
          organizationName: organization.name,
        });
      } else if (type === 'staff:branch_revoked') {
        // Tier 2: Branch-level revocation
        const revokedBranchIds = (payload?.revokedBranchIds as string[]) || [];
        const currentBranchId = branch?.id;

        if (currentBranchId && revokedBranchIds.includes(currentBranchId)) {
          const remainingBranchIds = (payload?.remainingBranchIds as string[]) || [];
          const remainingBranch = (branches || []).find((b) => remainingBranchIds.includes(b.id));

          setRevocationModal({
            isOpen: true,
            type: 'branch',
            branchName: branch.name,
            remainingBranchId: remainingBranch?.id,
            remainingBranchName: remainingBranch?.name,
          });
        }
      }
    };

    window.addEventListener('orvio:access-revoked', handleRevocation);
    return () => window.removeEventListener('orvio:access-revoked', handleRevocation);
  }, [user?.id, branch?.id, branch?.name, organization.name, branches]);

  const [isRolePulsing, setIsRolePulsing] = React.useState(false);

  // Listen for real-time role change events
  React.useEffect(() => {
    const handleRoleChanged = (evt: Event) => {
      const customEvt = evt as CustomEvent<{
        newRole?: string;
        oldRole?: string;
        branchRoles?: Record<string, string>;
      }>;
      const { newRole, oldRole, branchRoles } = customEvt.detail || {};
      const roleTitle = newRole ? newRole.charAt(0).toUpperCase() + newRole.slice(1) : 'Team Member';

      if (branchRoles) {
        setBranchRolesMap((prev) => ({ ...prev, ...branchRoles }));

        // Notify for non-active branches updated in background
        Object.entries(branchRoles).forEach(([bId, bRole]) => {
          if (bId !== selectedBranchId) {
            const allB = branches || branchList || [];
            const bName = allB.find((b) => b.id === bId)?.name || 'Branch';
            const bRoleTitle = bRole.charAt(0).toUpperCase() + bRole.slice(1);
            toast.info('Branch Role Updated', {
              description: `Your role for ${bName} was updated to ${bRoleTitle}.`,
              duration: 5000,
              id: `realtime-role-changed-${bId}`,
            });
          }
        });
      }

      // Check if current active branch has a role change
      const targetBranchRole = (selectedBranchId && branchRoles && branchRoles[selectedBranchId]) || newRole;

      if (targetBranchRole && targetBranchRole.toLowerCase() !== rawRole) {
        // Trigger the 3-second animated transition overlay
        setRoleTransitionModal({
          isOpen: true,
          branchName: selectedBranch?.name || 'Current Branch',
          oldRole: rawRole,
          newRole: targetBranchRole,
        });

        setIsRolePulsing(true);
        setTimeout(() => setIsRolePulsing(false), 3500);

        // Display informative toast for active role update
        toast.info('Workspace Role Updated', {
          description: `Your role was updated to ${roleTitle} by an administrator. Permissions refreshed.`,
          duration: 5000,
          id: 'realtime-role-changed-workspace',
        });
      } else if (newRole && !branchRoles) {
        setActiveRoleOverride(newRole);
        setIsRolePulsing(true);
        setTimeout(() => setIsRolePulsing(false), 3500);

        toast.info('Workspace Role Updated', {
          description: `Your role was updated to ${roleTitle} by an administrator. Permissions refreshed.`,
          duration: 5000,
          id: 'realtime-role-changed-workspace',
        });
      }

      // Restricted page redirection for downgraded roles:
      const effectiveNext = (targetBranchRole || newRole || '').toLowerCase();
      if (effectiveNext === 'cashier' || effectiveNext === 'accountant') {
        const restrictedPaths = ['/inventory/branches', '/inventory/settings'];
        const pathname = location.pathname.toLowerCase();
        if (restrictedPaths.some((p) => pathname.includes(p))) {
          navigate({ pathname: '/inventory/products', search: location.search }, { replace: true });
          toast.warning('Redirected to Catalog', {
            description: 'You were redirected to products because your new role does not have access to that area.',
          });
        }
      }
    };

    window.addEventListener('orvio:role-changed', handleRoleChanged);
    return () => window.removeEventListener('orvio:role-changed', handleRoleChanged);
  }, [branchList, branches, location.pathname, location.search, navigate, rawRole, selectedBranch?.name, selectedBranchId]);

  const handleCompleteRoleTransition = React.useCallback(() => {
    const nextRole = (roleTransitionModal.newRole || 'cashier').toLowerCase();
    setRoleTransitionModal((prev) => ({ ...prev, isOpen: false }));
    setActiveRoleOverride(nextRole);
    if (selectedBranchId && selectedBranchId !== 'all') {
      setBranchRolesMap((prev) => ({ ...prev, [selectedBranchId]: nextRole }));
    }
    if (nextRole === 'cashier') {
      setDashboardPerspective('cashier');
    } else if (nextRole === 'storekeeper') {
      setDashboardPerspective('storekeeper');
    } else if (nextRole === 'manager' || nextRole === 'owner') {
      setDashboardPerspective('executive');
    }

    // Always navigate to designated Dashboard view to showcase new role perspective
    navigate({ pathname: '/inventory', search: location.search }, { replace: true });
  }, [location.search, navigate, roleTransitionModal.newRole, selectedBranchId]);

  const handleProceedRevocation = () => {
    if (revocationModal.type === 'organization') {
      useAuthStore.getState().clearSession();
      window.location.href = `${getAccountsBaseUrl()}/login`;
    } else {
      setRevocationModal((prev) => ({ ...prev, isOpen: false }));
      if (revocationModal.remainingBranchId) {
        handleSelectBranchId(revocationModal.remainingBranchId);
      } else {
        navigate('/dashboard');
      }
    }
  };

  // Global Ctrl+K / Cmd+K keyboard shortcut to toggle catalog search modal
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchModalOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute authenticated user role label
  const userRole = React.useMemo(() => {
    if (rawRole) {
      return rawRole.charAt(0).toUpperCase() + rawRole.slice(1);
    }
    return 'Owner';
  }, [rawRole]);

  // Compute authenticated user initials
  const userInitials = React.useMemo(() => {
    if (!user?.fullName) return 'U';
    const parts = user.fullName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }, [user?.fullName]);

  // Navigation handlers for search palette results
  const handleSelectCatalogProduct = React.useCallback(
    (productId: string) => {
      setIsSearchModalOpen(false);
      const params = new URLSearchParams(location.search);
      params.set('productId', productId);
      navigate({
        pathname: '/inventory/products',
        search: `?${params.toString()}`,
      });
    },
    [location.search, navigate]
  );

  const handleSelectCatalogCategory = React.useCallback(
    (categoryId: string) => {
      setIsSearchModalOpen(false);
      const params = new URLSearchParams(location.search);
      params.set('categoryId', categoryId);
      navigate({
        pathname: '/inventory/categories',
        search: `?${params.toString()}`,
      });
    },
    [location.search, navigate]
  );

  const handleSelectCatalogBrand = React.useCallback(
    (brandId: string) => {
      setIsSearchModalOpen(false);
      const params = new URLSearchParams(location.search);
      params.set('brandId', brandId);
      navigate({
        pathname: '/inventory/brands',
        search: `?${params.toString()}`,
      });
    },
    [location.search, navigate]
  );

  // URL Action State for deep-linking & session resumption
  const {
    activeAction,
    openAction,
    closeAction,
  } = useUrlActionState<'manage-branches' | 'add-branch'>({
    actionParam: 'action',
  });

  // Notify user when workflow session is restored from URL
  const restoredToastRef = React.useRef(false);
  React.useEffect(() => {
    if (activeAction && !restoredToastRef.current) {
      restoredToastRef.current = true;
      toast.info('Session restored — resumed where you left off', {
        description: `Active workflow: ${activeAction.replace('-', ' ')}`,
      });
    }
  }, [activeAction]);

  // Sync active action with branch modals
  React.useEffect(() => {
    if (activeAction === 'manage-branches') {
      setIsBranchModalOpen(true);
      setIsAddBranchWizardOpen(false);
    } else if (activeAction === 'add-branch') {
      setIsAddBranchWizardOpen(true);
      setIsBranchModalOpen(false);
    }
  }, [activeAction]);



  const handleSelectBranchId = React.useCallback(
    (id: string) => {
      if (id === selectedBranchId) return;

      // Prevent non-authorized staff from selecting "all" or branches outside their permitted scope
      if (!hasGlobalBranchScope && (id === 'all' || !branchList.some((b) => b.id === id))) {
        return;
      }

      const fromName = selectedBranchId === 'all' ? 'All Branches (Overview)' : (branchList.find((b) => b.id === selectedBranchId)?.name || 'Previous Location');
      const toName = id === 'all' ? 'All Branches (Overview)' : (branchList.find((b) => b.id === id)?.name || 'Selected Location');

      setSwitchingSourceName(fromName);
      setSwitchingTargetName(toName);
      setIsSwitchingBranch(true);

      setTimeout(() => {
        setSelectedBranchId(id);
        sessionStorage.setItem(`orvio.selectedBranch.${orgKey}`, id);

        // Dynamically re-hydrate dashboard perspective based on branch's designated role
        if (id !== 'all' && branchRolesMap[id]) {
          const targetRole = branchRolesMap[id].toLowerCase();
          if (targetRole === 'cashier') {
            setDashboardPerspective('cashier');
          } else if (targetRole === 'storekeeper') {
            setDashboardPerspective('storekeeper');
          } else if (targetRole === 'manager' || targetRole === 'owner') {
            setDashboardPerspective('executive');
          }
        }

        const params = new URLSearchParams(location.search);
        params.set('branch', id);
        navigate(
          {
            pathname: location.pathname,
            search: `?${params.toString()}`,
          },
          { replace: true }
        );
        setTimeout(() => {
          setIsSwitchingBranch(false);
        }, 350);
      }, 550);
    },
    [selectedBranchId, branchList, orgKey, location.pathname, location.search, navigate, hasGlobalBranchScope, branchRolesMap]
  );

  const handleRefreshBranches = React.useCallback(async () => {
    try {
      const res = await branchApi.getBranches({ activeOnly: true });
      if (res.branches) {
        const filtered = !hasGlobalBranchScope && permittedBranchScope.length > 0
          ? res.branches.filter((b) => permittedBranchScope.includes(b.id))
          : res.branches;
        setBranchList(filtered);
        if (selectedBranchId !== 'all' && !filtered.some((b) => b.id === selectedBranchId)) {
          const primary = filtered.find((b) => b.is_primary) || filtered[0];
          handleSelectBranchId(primary?.id || (hasGlobalBranchScope ? 'all' : ''));
        }
      }
    } catch (err) {
      console.error('Failed to refresh branches:', err);
    }
  }, [selectedBranchId, handleSelectBranchId, hasGlobalBranchScope, permittedBranchScope]);

  // URL Protection & Tampering Prevention: sanitize URL if non-owner is requesting unauthorized branch
  React.useEffect(() => {
    if (!hasGlobalBranchScope && branchList.length > 0) {
      const searchParams = new URLSearchParams(location.search);
      const urlBranch = searchParams.get('branch');
      if (urlBranch === 'all' || (urlBranch && !branchList.some((b) => b.id === urlBranch))) {
        const fallbackBranchObj = (branch?.id && branchList.find((b) => b.id === branch.id))
          ? branchList.find((b) => b.id === branch.id)
          : branchList[0];
        const fallbackBranch = fallbackBranchObj?.id;
        if (fallbackBranch && fallbackBranch !== selectedBranchId) {
          toast.warning('Access Restricted', {
            description: `You don't have access to that branch; switched to your assigned branch: ${fallbackBranchObj?.name || 'Assigned Branch'}`,
            id: 'unauthorized-branch-warning',
          });
          handleSelectBranchId(fallbackBranch);
        }
      }
    }
  }, [hasGlobalBranchScope, branchList, location.search, branch?.id, selectedBranchId, handleSelectBranchId]);

  const [currentCurrency] = React.useState('NGN');

  // Normalize pathname (strip trailing slash)
  const currentPath = React.useMemo(() => {
    const raw = location.pathname.toLowerCase().replace(/\/+$/, '') || '/inventory';
    return raw;
  }, [location.pathname]);

  // Handle redirects for singular or alias paths to standard plural routes
  React.useEffect(() => {
    const aliasMap: Record<string, string> = {
      '/inventory/product': '/inventory/products',
      '/inventory/category': '/inventory/categories',
      '/inventory/brand': '/inventory/brands',
      '/inventory/order': '/inventory/orders',
      '/inventory/supplier': '/inventory/suppliers',
      '/inventory/purchase-order': '/inventory/purchase-orders',
      '/inventory/return': '/inventory/returns',
      '/inventory/report': '/inventory/reports',
      '/inventory/setting': '/inventory/settings',
      '/inventory/inventory': '/inventory/stock',
    };
    if (aliasMap[currentPath]) {
      navigate({ pathname: aliasMap[currentPath], search: location.search }, { replace: true });
    }
  }, [currentPath, location.search, navigate]);

  // Derive active tab directly from URL
  const activeTab = React.useMemo(() => {
    if (currentPath === '/inventory/products' || currentPath === '/inventory/product') return 'Products';
    if (currentPath === '/inventory/categories' || currentPath === '/inventory/category') return 'Categories';
    if (currentPath === '/inventory/brands' || currentPath === '/inventory/brand') return 'Brands';
    if (currentPath === '/inventory/stock' || currentPath === '/inventory/inventory') return 'Inventory';
    if (currentPath === '/inventory/orders' || currentPath === '/inventory/order') return 'Orders';
    if (currentPath === '/inventory/suppliers' || currentPath === '/inventory/supplier') return 'Suppliers';
    if (currentPath === '/inventory/purchase-orders' || currentPath === '/inventory/purchase-order') return 'Purchase Orders';
    if (currentPath === '/inventory/returns' || currentPath === '/inventory/return') return 'Returns';
    if (currentPath === '/inventory/reports' || currentPath === '/inventory/report') return 'Reports';
    if (currentPath === '/inventory/settings/staff' || currentPath === '/inventory/staff') return 'Staff & Access';
    if (currentPath === '/inventory/settings' || currentPath === '/inventory/setting') return 'Settings';
    return 'Dashboard';
  }, [currentPath]);

  // Real-time branch catalog query for Storekeeper dashboard metrics & priority restock table
  const { data: branchCatalogData, isLoading: isCatalogLoading } = useBranchCatalog({
    branchId: selectedBranchId === 'all' ? undefined : selectedBranchId,
    limit: 50,
    enabled: activeTab === 'Dashboard' && (dashboardPerspective === 'storekeeper' || isStorekeeper),
  });

  const storekeeperProducts = React.useMemo(() => {
    return (branchCatalogData?.products || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      sku: p.sku || null,
      stock: p.stock ?? 0,
      minStock: p.minStock ?? 5,
      category: p.category,
      price: p.price,
    }));
  }, [branchCatalogData?.products]);

  // Read category parameter from URL query string
  const categoryParam = React.useMemo(() => {
    const params = new URLSearchParams(location.search);
    return params.get('category') || undefined;
  }, [location.search]);

  // Navigation handler that preserves active search params (?branch=... etc.)
  const handleNavigateSection = React.useCallback(
    (targetPath: string) => {
      setMobileMenuOpen(false);
      navigate({
        pathname: targetPath,
        search: location.search,
      });
    },
    [navigate, location.search]
  );

  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);
  const [activeModal, setActiveModal] = React.useState<string | null>(null);
  const [categoryTimeRange, setCategoryTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('Monthly');
  const [demographicTimeRange, setDemographicTimeRange] = React.useState<'All time' | 'Weekly' | 'Monthly'>('All time');
  const [hoveredBarIndex, setHoveredBarIndex] = React.useState<number | null>(6); // Default 7 May (index 6)

  const currencySymbol = currentCurrency === 'NGN' ? '₦' : '$';

  // Sidebar Display Mode: 'icon-and-name' (default/expanded) vs 'icon-only' (collapsed)
  type SidebarMode = 'icon-and-name' | 'icon-only';

  const [sidebarMode, setSidebarMode] = React.useState<SidebarMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('orvio.sidebar.mode');
      if (saved === 'icon-only' || saved === 'icon-and-name') return saved as SidebarMode;
    }
    return 'icon-and-name';
  });

  const handleSetSidebarMode = React.useCallback((mode: SidebarMode) => {
    setSidebarMode(mode);
    try {
      localStorage.setItem('orvio.sidebar.mode', mode);
    } catch {
      // ignore
    }
  }, []);

  const toggleSidebarMode = React.useCallback(() => {
    handleSetSidebarMode(sidebarMode === 'icon-and-name' ? 'icon-only' : 'icon-and-name');
  }, [sidebarMode, handleSetSidebarMode]);

  // Catalog Section & Dropdown State
  const isCatalogSectionActive =
    activeTab === 'Products' || activeTab === 'Categories' || activeTab === 'Brands';
  const [isCatalogOpen, setIsCatalogOpen] = React.useState(true);
  const [isCatalogFlyoutOpen, setIsCatalogFlyoutOpen] = React.useState(false);
  const catalogFlyoutRef = React.useRef<HTMLDivElement>(null);

  // Close flyout when clicking outside
  React.useEffect(() => {
    if (!isCatalogFlyoutOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (catalogFlyoutRef.current && !catalogFlyoutRef.current.contains(event.target as Node)) {
        setIsCatalogFlyoutOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isCatalogFlyoutOpen]);

  // Catalog Sub-Items (Consolidating Products, Categories, Brands under parent CATALOG)
  const catalogSubItems = [
    { name: 'Products', icon: Package, path: '/inventory/products' },
    { name: 'Categories', icon: FolderTree, path: '/inventory/categories' },
    { name: 'Brands', icon: Award, path: '/inventory/brands' },
  ];

  // Secondary Navigation Items following CATALOG
  const secondaryNavItems = React.useMemo(() => {
    const items = [
      { name: 'Inventory', icon: Boxes, path: '/inventory/stock' },
      { name: 'Orders', icon: ShoppingCart, path: '/inventory/orders' },
      { name: 'Suppliers', icon: Users, path: '/inventory/suppliers' },
      { name: 'Purchase Orders', icon: FileText, path: '/inventory/purchase-orders' },
      { name: 'Returns', icon: RotateCcw, path: '/inventory/returns' },
      { name: 'Reports', icon: BarChart3, path: '/inventory/reports' },
    ];
    if (isElevated) {
      items.push(
        { name: 'Staff & Access', icon: UserCheck, path: '/inventory/settings/staff' },
        { name: 'Settings', icon: Settings, path: '/inventory/settings' }
      );
    }
    return items;
  }, [isElevated]);

  // Daily Orders & Profit Data (May 1 - May 15)
  const dailyOrdersData = [
    { day: '1 May', income: 4200, profit: 1200 },
    { day: '2 May', income: 4900, profit: 1100 },
    { day: '3 May', income: 6400, profit: 1500 },
    { day: '4 May', income: 5800, profit: 1200 },
    { day: '5 May', income: 5100, profit: 1000 },
    { day: '6 May', income: 4800, profit: 900 },
    { day: '7 May', income: 4620, profit: 1080 },
    { day: '8 May', income: 3900, profit: 800 },
    { day: '9 May', income: 4700, profit: 1100 },
    { day: '10 May', income: 5300, profit: 1300 },
    { day: '11 May', income: 5900, profit: 1400 },
    { day: '12 May', income: 7200, profit: 1800 },
    { day: '13 May', income: 6800, profit: 1600 },
    { day: '14 May', income: 5400, profit: 1200 },
    { day: '15 May', income: 5100, profit: 1100 },
  ];

  // Top Categories Donut Data
  const categoriesData = [
    { name: 'T-Shirts', percent: 30, color: '#fbb945' },
    { name: 'Hoodies', percent: 22, color: '#985184' },
    { name: 'Jeans', percent: 18, color: '#d48834' },
    { name: 'Shoes', percent: 15, color: '#854372' },
    { name: 'Jackets', percent: 10, color: '#e09825' },
    { name: 'Other', percent: 5, color: '#4a4e5a' },
  ];

  // Customer Demographics Data
  const demographicData = [
    { range: '18–24', percent: 24 },
    { range: '25–34', percent: 29 },
    { range: '35–44', percent: 21 },
    { range: '45–54', percent: 16 },
    { range: '55+', percent: 10 },
  ];

  // Product Sales Catalog
  const productSales = [
    {
      id: 'p1',
      name: 'Classic Oversized Tee',
      imgBg: 'bg-[#2a2d36]',
      stock: 156,
      oldPrice: 39.99,
      sale: '15%',
      newPrice: 33.99,
      itemsSold: 320,
    },
    {
      id: 'p2',
      name: 'Premium Hoodie',
      imgBg: 'bg-[#2a2d36]',
      stock: 98,
      oldPrice: 79.99,
      sale: '20%',
      newPrice: 63.99,
      itemsSold: 210,
    },
    {
      id: 'p3',
      name: 'Slim Fit Jeans',
      imgBg: 'bg-[#2a2d36]',
      stock: 214,
      oldPrice: 59.99,
      sale: '10%',
      newPrice: 53.99,
      itemsSold: 178,
    },
    {
      id: 'p4',
      name: 'Bomber Jacket',
      imgBg: 'bg-[#2a2d36]',
      stock: 67,
      oldPrice: 119.99,
      sale: '25%',
      newPrice: 89.99,
      itemsSold: 96,
    },
    {
      id: 'p5',
      name: 'Sneakers Pro',
      imgBg: 'bg-[#2a2d36]',
      stock: 132,
      oldPrice: 89.99,
      sale: '12%',
      newPrice: 79.19,
      itemsSold: 142,
    },
  ];

  // Recent Orders Feed
  const recentOrders = [
    {
      id: '#ORD-7956',
      customer: 'Rohan Verma',
      amount: 149.99,
      status: 'Delivered',
      statusColor: 'text-emerald-400 bg-emerald-500/10',
      time: '2h ago',
    },
    {
      id: '#ORD-7955',
      customer: 'Ananya Singh',
      amount: 89.5,
      status: 'Processing',
      statusColor: 'text-[#fbb945] bg-[#fbb945]/10',
      time: '4h ago',
    },
    {
      id: '#ORD-7954',
      customer: 'Karan Mehta',
      amount: 199.0,
      status: 'Shipped',
      statusColor: 'text-sky-400 bg-sky-500/10',
      time: '6h ago',
    },
    {
      id: '#ORD-7953',
      customer: 'Neha Kapoor',
      amount: 59.49,
      status: 'Processing',
      statusColor: 'text-[#fbb945] bg-[#fbb945]/10',
      time: '8h ago',
    },
    {
      id: '#ORD-7952',
      customer: 'Vikram Patel',
      amount: 249.0,
      status: 'Cancelled',
      statusColor: 'text-rose-400 bg-rose-500/10',
      time: '10h ago',
    },
  ];

  return (
    <div className="min-h-screen bg-[#111215] text-slate-100 flex flex-col font-sans selection:bg-[#985184] selection:text-white">
      <SeoHead
        title={`${activeTab} — ${organization.name} Inventory`}
        description={`Manage ${activeTab.toLowerCase()} records, stock tracking, and sales operations in ${organization.name}.`}
      />

      {/* Main Layout Container */}
      <div className="flex flex-1 min-h-screen">
        {/* ================= LEFT SIDEBAR (DESKTOP & DRAWER) ================= */}
        {/* Mobile Backdrop */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-xs z-40 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          data-testid="inventory-sidebar"
          data-sidebar-mode={sidebarMode}
          className={`fixed inset-y-0 left-0 z-50 bg-[#141519] flex flex-col justify-between transition-all duration-200 lg:static lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          } ${
            sidebarMode === 'icon-only'
              ? 'w-20 p-2.5 items-center'
              : 'w-64 p-4'
          }`}
        >
          {/* Top Brand & Navigation */}
          <div className="space-y-4 w-full">
            {/* Organization Branding & Header */}
            {sidebarMode === 'icon-and-name' ? (
              <div className="flex items-center justify-between px-2 pt-1">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-sm bg-[#985184] flex items-center justify-center text-white font-black text-lg shadow-sm shrink-0">
                    {organization.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="leading-tight truncate max-w-[120px]">
                    <div className="font-bold text-white text-sm truncate">{organization.name}</div>
                    <div className="text-[11px] text-slate-400 font-medium">Inventory Management</div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    data-testid="sidebar-collapse-btn"
                    onClick={() => handleSetSidebarMode('icon-only')}
                    title="Switch to Icon Only mode"
                    aria-label="Switch to Icon Only mode"
                    className="hidden lg:flex p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors cursor-pointer"
                  >
                    <PanelLeftClose className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(false)}
                    className="lg:hidden p-1 text-slate-400 hover:text-white rounded-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>
            ) : (
              /* Icon Only Header */
              <div className="flex flex-col items-center gap-2 pt-1 w-full">
                <div className="w-9 h-9 rounded-sm bg-[#985184] flex items-center justify-center text-white font-black text-lg shadow-sm">
                  {organization.name.charAt(0).toUpperCase()}
                </div>
                <button
                  type="button"
                  data-testid="sidebar-expand-btn"
                  onClick={() => handleSetSidebarMode('icon-and-name')}
                  title="Switch to Icon + Name mode"
                  aria-label="Switch to Icon + Name mode"
                  className="p-1.5 text-slate-400 hover:text-white hover:bg-white/5 rounded-sm transition-colors cursor-pointer"
                >
                  <PanelLeftOpen className="w-4 h-4 text-[#fbb945]" />
                </button>
              </div>
            )}

            {/* Navigation Menu */}
            <nav className="space-y-1 w-full">
              {/* 1. Dashboard */}
              {sidebarMode === 'icon-and-name' ? (
                <Link
                  to={{ pathname: '/inventory', search: location.search }}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-xs font-semibold transition-all cursor-pointer text-left ${
                    activeTab === 'Dashboard'
                      ? 'bg-[#985184] text-white shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'Dashboard' ? 'text-white' : 'text-slate-400'}`} />
                  <span>Dashboard</span>
                </Link>
              ) : (
                <div className="flex justify-center">
                  <Link
                    to={{ pathname: '/inventory', search: location.search }}
                    onClick={() => setMobileMenuOpen(false)}
                    title="Dashboard"
                    className={`w-10 h-10 flex items-center justify-center rounded-sm text-xs font-semibold transition-all cursor-pointer relative group ${
                      activeTab === 'Dashboard'
                        ? 'bg-[#985184] text-white shadow-sm'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <LayoutDashboard className={`w-4 h-4 ${activeTab === 'Dashboard' ? 'text-white' : 'text-slate-400'}`} />
                    <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e2026] text-white text-[11px] font-medium rounded-xs shadow-lg border border-[#2d3139] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                      Dashboard
                    </span>
                  </Link>
                </div>
              )}

              {/* 2. CATALOG - Consolidated Dropdown Menu */}
              {sidebarMode === 'icon-and-name' ? (
                <div className="space-y-1">
                  <button
                    type="button"
                    data-testid="catalog-menu-toggle"
                    aria-expanded={isCatalogOpen}
                    aria-controls="catalog-submenu"
                    onClick={() => setIsCatalogOpen((prev) => !prev)}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-sm text-xs font-semibold transition-all cursor-pointer text-left ${
                      isCatalogSectionActive
                        ? 'bg-[#985184]/20 text-white border border-[#985184]/40 shadow-xs'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Layers className={`w-4 h-4 shrink-0 ${isCatalogSectionActive ? 'text-[#fbb945]' : 'text-slate-400'}`} />
                      <span className="tracking-wide">CATALOG</span>
                    </div>
                    <ChevronDown
                      className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
                        isCatalogOpen ? 'rotate-180 text-white' : 'text-slate-400'
                      }`}
                    />
                  </button>

                  {/* Dropdown sub-items */}
                  {isCatalogOpen && (
                    <div
                      id="catalog-submenu"
                      data-testid="catalog-submenu"
                      className="ml-4 pl-3 py-1 space-y-1 border-l-2 border-[#2d3139] transition-all"
                    >
                      {catalogSubItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeTab === subItem.name;

                        return (
                          <Link
                            key={subItem.name}
                            to={{ pathname: subItem.path, search: location.search }}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-sm text-xs font-medium transition-all cursor-pointer text-left ${
                              isSubActive
                                ? 'bg-[#985184] text-white shadow-xs font-semibold'
                                : 'text-slate-400 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                /* Icon Only CATALOG with Flyout Dropdown */
                <div className="relative flex justify-center" ref={catalogFlyoutRef}>
                  <button
                    type="button"
                    data-testid="catalog-menu-toggle"
                    aria-expanded={isCatalogFlyoutOpen}
                    title="CATALOG"
                    aria-label="CATALOG"
                    onClick={() => setIsCatalogFlyoutOpen((prev) => !prev)}
                    className={`w-10 h-10 flex items-center justify-center rounded-sm text-xs font-semibold transition-all cursor-pointer relative group ${
                      isCatalogSectionActive
                        ? 'bg-[#985184]/25 text-white ring-1 ring-[#985184]'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    <Layers className={`w-4 h-4 ${isCatalogSectionActive ? 'text-[#fbb945]' : 'text-slate-400'}`} />
                    {isCatalogSectionActive && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-[#fbb945]" />
                    )}
                    {!isCatalogFlyoutOpen && (
                      <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e2026] text-white text-[11px] font-medium rounded-xs shadow-lg border border-[#2d3139] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        CATALOG
                      </span>
                    )}
                  </button>

                  {/* Flyout Dropdown */}
                  {isCatalogFlyoutOpen && (
                    <div
                      data-testid="catalog-flyout-menu"
                      className="absolute left-full top-0 ml-3 w-48 bg-[#181a20] border border-[#2d3139] rounded-sm p-1.5 shadow-2xl z-50 space-y-1 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <div className="px-2.5 py-1 text-[10px] font-bold text-slate-400 tracking-wider uppercase border-b border-[#2d3139]/60 flex items-center justify-between">
                        <span>CATALOG</span>
                        <span className="text-[9px] text-[#fbb945] font-mono">3 items</span>
                      </div>
                      {catalogSubItems.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = activeTab === subItem.name;
                        return (
                          <Link
                            key={subItem.name}
                            to={{ pathname: subItem.path, search: location.search }}
                            onClick={() => {
                              setIsCatalogFlyoutOpen(false);
                              setMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-sm text-xs font-medium transition-all cursor-pointer ${
                              isSubActive
                                ? 'bg-[#985184] text-white shadow-xs font-semibold'
                                : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                          >
                            <SubIcon className={`w-3.5 h-3.5 shrink-0 ${isSubActive ? 'text-white' : 'text-slate-400'}`} />
                            <span>{subItem.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 3. Secondary Nav Items */}
              {secondaryNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.name;

                if (sidebarMode === 'icon-and-name') {
                  return (
                    <Link
                      key={item.name}
                      to={{ pathname: item.path, search: location.search }}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-xs font-semibold transition-all cursor-pointer text-left ${
                        isActive
                          ? 'bg-[#985184] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.name}</span>
                    </Link>
                  );
                }

                return (
                  <div key={item.name} className="flex justify-center">
                    <Link
                      to={{ pathname: item.path, search: location.search }}
                      onClick={() => setMobileMenuOpen(false)}
                      title={item.name}
                      className={`w-10 h-10 flex items-center justify-center rounded-sm text-xs font-semibold transition-all cursor-pointer relative group ${
                        isActive
                          ? 'bg-[#985184] text-white shadow-sm'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e2026] text-white text-[11px] font-medium rounded-xs shadow-lg border border-[#2d3139] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                        {item.name}
                      </span>
                    </Link>
                  </div>
                );
              })}
            </nav>
          </div>

          {/* Bottom Active Branch & POS Card + User Profile */}
          {sidebarMode === 'icon-and-name' ? (
            <div className="bg-[#181a20] p-4 rounded-sm space-y-3 mt-6 border border-[#2d3139]/40 w-full">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-sm bg-[#fbb945]/15 text-[#fbb945] flex items-center justify-center shrink-0">
                  <Store className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <div className="text-xs font-bold text-white truncate">
                    {selectedBranchId === 'all' ? 'All Branches' : selectedBranch?.name || 'Primary Store'}
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {selectedBranchId === 'all'
                      ? 'Aggregated Org View'
                      : `${selectedBranch?.code || selectedBranch?.type?.toUpperCase() || 'STORE'} • Active`}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {selectedBranchId === 'all'
                  ? 'Displaying organization-wide consolidated stock totals across all branches.'
                  : 'Stock synced in real-time across checkout counters and registers.'}
              </p>

              {isElevated && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    openAction('manage-branches');
                    setIsBranchModalOpen(true);
                  }}
                  className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-8 rounded-sm shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Branch Settings</span>
                </Button>
              )}

              {/* Authenticated User Profile */}
              <div
                data-testid="sidebar-user-profile"
                className="mt-3 pt-3 border-t border-[#2d3139]/60 flex items-center gap-3 w-full"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#985184] to-[#fbb945] text-white font-bold text-xs flex items-center justify-center shadow-md ring-1 ring-white/10 shrink-0 select-none">
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-100 truncate" title={user?.fullName || 'Authenticated User'}>
                    {user?.fullName || 'Authenticated User'}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className={`text-[9px] uppercase tracking-wider font-extrabold px-1.5 py-0.5 rounded-xs bg-[#fbb945]/15 text-[#fbb945] border border-[#fbb945]/30 transition-all ${
                        isRolePulsing ? 'animate-bounce ring-2 ring-[#fbb945] shadow-lg shadow-[#fbb945]/40' : ''
                      }`}
                    >
                      {userRole}
                    </span>
                    {user?.email && (
                      <span className="text-[10px] text-slate-400 truncate font-mono">
                        {user.email}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Icon Only Bottom Store Button & User Avatar */
            <div className="flex flex-col items-center gap-3 pt-3 border-t border-[#2d3139]/40 w-full">
              {isElevated && (
                <button
                  type="button"
                  onClick={() => {
                    openAction('manage-branches');
                    setIsBranchModalOpen(true);
                  }}
                  title={`Branch Settings (${selectedBranchId === 'all' ? 'All Branches' : selectedBranch?.name || 'Primary Store'})`}
                  aria-label="Branch Settings"
                  className="w-10 h-10 rounded-sm bg-[#181a20] hover:bg-[#985184]/20 border border-[#2d3139] text-[#fbb945] flex items-center justify-center transition-colors cursor-pointer relative group"
                >
                  <Store className="w-4 h-4" />
                  <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e2026] text-white text-[11px] font-medium rounded-xs shadow-lg border border-[#2d3139] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                    {selectedBranchId === 'all' ? 'All Branches' : selectedBranch?.name || 'Branch Settings'}
                  </span>
                </button>
              )}

              {/* Authenticated User Avatar (Icon Only) */}
              <div
                data-testid="sidebar-user-avatar-collapsed"
                title={`${user?.fullName || 'Authenticated User'} (${userRole})`}
                aria-label={`${user?.fullName || 'Authenticated User'} (${userRole})`}
                className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#985184] to-[#fbb945] text-white font-bold text-xs flex items-center justify-center shadow-md ring-1 ring-white/10 shrink-0 cursor-default relative group select-none"
              >
                {userInitials}
                <span className="absolute left-full ml-3 px-2 py-1 bg-[#1e2026] text-white text-[11px] font-medium rounded-xs shadow-lg border border-[#2d3139] whitespace-nowrap opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
                  {user?.fullName || 'Authenticated User'} • {userRole}
                </span>
              </div>
            </div>
          )}
        </aside>

        {/* ================= MAIN CONTENT AREA ================= */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Header Bar */}
          <header className="h-16 bg-[#141519] px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
            {/* Left: Mobile Toggle, Desktop Mode Toggle & Global Search */}
            <div className="flex items-center gap-3 sm:gap-4 flex-1 max-w-md">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5"
              >
                <Menu className="w-5 h-5" />
              </button>

              <button
                type="button"
                data-testid="header-sidebar-toggle"
                onClick={toggleSidebarMode}
                title={sidebarMode === 'icon-only' ? 'Switch to Icon + Name mode' : 'Switch to Icon Only mode'}
                aria-label={sidebarMode === 'icon-only' ? 'Switch to Icon + Name mode' : 'Switch to Icon Only mode'}
                className="hidden lg:flex p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 transition-colors cursor-pointer"
              >
                {sidebarMode === 'icon-only' ? (
                  <PanelLeftOpen className="w-4 h-4 text-[#fbb945]" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>

              {/* Catalog Search Bar Trigger (Ctrl + K) */}
              <button
                type="button"
                data-testid="catalog-search-trigger"
                onClick={() => setIsSearchModalOpen(true)}
                title="Search catalog (Ctrl + K)"
                className="relative w-full flex items-center justify-between bg-[#181a20] hover:bg-[#1f222a] border border-[#2d3139]/60 hover:border-[#985184]/50 text-xs text-slate-400 pl-9 pr-2.5 py-2 rounded-sm transition-all text-left cursor-pointer group shadow-inner"
              >
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-slate-200 transition-colors pointer-events-none" />
                <span className="truncate group-hover:text-slate-200 transition-colors">
                  Search catalog (products, categories, brands)...
                </span>
                <span className="shrink-0 text-[10px] font-mono text-slate-400 bg-white/5 border border-white/10 px-1.5 py-0.5 rounded-xs flex items-center gap-0.5 ml-2">
                  <span className="text-[9px]">Ctrl</span> K
                </span>
              </button>
            </div>

            {/* Right: Branch Selector, Locked Currency, Sync Status, Alerts */}
            <div className="flex items-center gap-2 sm:gap-4">
              {/* Branch Selector Dropdown */}
              <div className="relative">
                <div className={`flex items-center gap-1.5 bg-[#181a20] border border-[#2d3139] px-2.5 py-1.5 rounded-sm ${
                  !hasGlobalBranchScope && branchList.length <= 1 ? 'opacity-90' : 'hover:border-[#3d424e]'
                }`}>
                  <Store className="w-3.5 h-3.5 text-[#fbb945] shrink-0" />
                  <select
                    aria-label="Active branch selection"
                    value={selectedBranchId}
                    disabled={!hasGlobalBranchScope && branchList.length <= 1}
                    onChange={(e) => {
                      if (e.target.value === '__add_branch__') {
                        openAction('add-branch');
                        setIsAddBranchWizardOpen(true);
                      } else if (e.target.value === '__manage__') {
                        openAction('manage-branches');
                        setIsBranchModalOpen(true);
                      } else {
                        handleSelectBranchId(e.target.value);
                      }
                    }}
                    className={`bg-transparent text-xs font-semibold text-slate-200 pr-5 appearance-none focus:outline-hidden ${
                      !hasGlobalBranchScope && branchList.length <= 1 ? 'cursor-default' : 'cursor-pointer'
                    }`}
                  >
                    {hasGlobalBranchScope && (
                      <option value="all" className="bg-[#181a20] text-white">
                        All Branches (Org-wide)
                      </option>
                    )}
                    {branchList.map((b) => (
                      <option key={b.id} value={b.id} className="bg-[#181a20] text-white">
                        {b.is_primary ? '★ ' : ''}{b.name} ({b.type})
                      </option>
                    ))}
                    {isElevated && (
                      <>
                        <option disabled className="bg-[#181a20] text-slate-500">
                          ──────────
                        </option>
                        <option value="__add_branch__" className="bg-[#181a20] text-[#fbb945] font-semibold">
                          ＋ Add New Branch...
                        </option>
                        <option value="__manage__" className="bg-[#181a20] text-slate-300">
                          ⚙ Manage Branches Hub...
                        </option>
                      </>
                    )}
                  </select>
                  {(hasGlobalBranchScope || branchList.length > 1) && (
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  )}
                </div>
              </div>

              {/* Fixed Currency Badge (Locked to NGN) */}
              <div
                data-testid="currency-badge"
                title="Currency is locked to Nigerian Naira (NGN)"
                className="flex items-center gap-1.5 bg-[#181a20]/90 border border-[#2d3139] px-2.5 py-1.5 rounded-sm text-xs font-semibold text-slate-300 cursor-not-allowed select-none transition-colors hover:border-[#2d3139]"
              >
                <span className="font-mono text-[#fbb945] font-bold">₦</span>
                <span>NGN</span>
              </div>

              {/* Realtime Live Sync Status */}
              <div
                className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-sm border border-[#2d3139] bg-[#181a20] text-xs transition-colors"
                title={
                  wsStatus === 'connected'
                    ? 'Realtime sync active: Live inventory updates are automatically synchronized'
                    : wsStatus === 'connecting'
                    ? 'Connecting to realtime inventory sync...'
                    : 'Realtime sync disconnected: Reconnecting...'
                }
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsStatus === 'connected'
                      ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                      : wsStatus === 'connecting'
                      ? 'bg-amber-400 animate-pulse'
                      : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-300 hidden md:inline">
                  {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting' : 'Offline'}
                </span>
              </div>

              {/* Notification Bell */}
              <button
                type="button"
                onClick={() => setActiveModal('Notifications')}
                className="relative p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer"
                title="Notifications"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-[#fbb945] text-[#111215] font-black text-[9px] rounded-full flex items-center justify-center">
                  3
                </span>
              </button>

              {/* Messages / Mail */}
              <button
                type="button"
                onClick={() => setActiveModal('Messages')}
                className="p-2 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer hidden sm:flex"
                title="Messages"
              >
                <Mail className="w-4 h-4" />
              </button>
            </div>
          </header>

          {/* ================= WORKSPACE BODY CONTENT ================= */}
          <main className="flex-1 p-4 sm:p-6 lg:p-8 space-y-6 w-full mx-auto">
            {activeTab === 'Categories' ? (
              <CategoriesPage
                organization={organization}
                branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
                onNavigateToProducts={(catId) => {
                  const params = new URLSearchParams(location.search);
                  if (catId) {
                    params.set('category', catId);
                  } else {
                    params.delete('category');
                  }
                  navigate({
                    pathname: '/inventory/products',
                    search: params.toString() ? `?${params.toString()}` : '',
                  });
                }}
              />
            ) : activeTab === 'Brands' ? (
              <BrandsPage
                organization={organization}
                branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
              />
            ) : activeTab === 'Products' ? (
              <ProductsPage
                organization={organization}
                branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
                branchName={selectedBranchId === 'all' ? 'All Branches' : (selectedBranch?.name || 'Selected Branch')}
                initialCategoryId={categoryParam}
                onClearInitialCategory={() => {
                  const params = new URLSearchParams(location.search);
                  params.delete('category');
                  navigate(
                    {
                      pathname: '/inventory/products',
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                  );
                }}
                onCategoryChange={(catId) => {
                  const params = new URLSearchParams(location.search);
                  if (catId && catId !== 'all') {
                    params.set('category', catId);
                  } else {
                    params.delete('category');
                  }
                  navigate(
                    {
                      pathname: '/inventory/products',
                      search: params.toString() ? `?${params.toString()}` : '',
                    },
                    { replace: true }
                  );
                }}
              />
            ) : activeTab === 'Inventory' ? (
              <StockManagementPage
                organization={organization}
                branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
                branchName={selectedBranchId === 'all' ? 'All Branches' : (selectedBranch?.name || 'Primary Store')}
                branches={branchList}
                onOpenBranchModal={() => {
                  openAction('manage-branches');
                  setIsBranchModalOpen(true);
                }}
              />
            ) : activeTab === 'Suppliers' ? (
              <SuppliersPage
                organization={organization}
                branches={branchList}
                activeBranchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
                onNavigateToStockReceipts={(supplierId) => {
                  const params = new URLSearchParams(location.search);
                  params.set('subTab', 'receipts');
                  if (supplierId) {
                    params.set('supplierId', supplierId);
                  }
                  navigate({
                    pathname: '/inventory/stock',
                    search: `?${params.toString()}`,
                  });
                }}
              />
            ) : activeTab === 'Staff & Access' ? (
              <StaffListPage
                organization={organization && organization.id ? { id: organization.id, name: organization.name, subdomain: organization.subdomain } : null}
                branches={branchList}
                activeBranchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
                contextApp="inventory"
              />
            ) : activeTab === 'Dashboard' ? (
              <div className="space-y-6">
                {/* Executive Dashboard Perspective Switcher */}
                {isElevated && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[#2b2f3a]/60">
                    <div>
                      <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                        <span>Role Perspective</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#985184]/20 border border-[#985184]/40 text-[#fbb945] font-semibold">
                          Executive View
                        </span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-0.5">
                        Inspect operations through your team members' dashboard views
                      </p>
                    </div>

                    <DashboardPerspectivePill
                      currentPerspective={dashboardPerspective}
                      onChangePerspective={setDashboardPerspective}
                      isElevated={isElevated}
                    />
                  </div>
                )}

                {/* Conditional Rendering of Role Dashboard */}
                {dashboardPerspective === 'cashier' ? (
                  <CashierDashboardView
                    currencySymbol={currencySymbol}
                    cashierName={user?.fullName || 'Cashier Staff'}
                    branchName={selectedBranchId === 'all' ? 'All Branches' : (selectedBranch?.name || 'Primary Store')}
                    onNavigateToPos={() => {
                      navigate({ pathname: '/inventory/orders', search: location.search });
                    }}
                    onOpenPriceCheck={() => setIsSearchModalOpen(true)}
                  />
                ) : dashboardPerspective === 'storekeeper' ? (
                  <StorekeeperDashboardView
                    currencySymbol={currencySymbol}
                    branchName={selectedBranchId === 'all' ? 'All Branches' : (selectedBranch?.name || 'Primary Store')}
                    products={storekeeperProducts || []}
                    isLoading={isCatalogLoading}
                    onOpenAdjustStock={() => {
                      setActiveModal('Stock Adjustment');
                    }}
                    onOpenReceiveStock={() => {
                      setActiveModal('Receive Stock');
                    }}
                    onOpenNewProduct={() => setActiveModal('New Product')}
                    onOpenCatalogSearch={() => setIsSearchModalOpen(true)}
                  />
                ) : (
                  <ExecutiveDashboardView
                    currencySymbol={currencySymbol}
                    categoriesData={categoriesData}
                    dailyOrdersData={dailyOrdersData}
                    demographicData={demographicData}
                    productSales={productSales}
                    recentOrders={recentOrders}
                    onOpenNewProduct={() => setActiveModal('New Product')}
                    onOpenProductDetail={(name) => setActiveModal(`Product: ${name}`)}
                    onOpenOrderDetail={(orderId) => setActiveModal(`Order: ${orderId}`)}
                  />
                )}
              </div>
            ) : (
              <OperationalSectionView
                section={activeTab as OperationalSection}
                organization={organization}
                branchName={selectedBranchId === 'all' ? 'All Branches' : (selectedBranch?.name || 'Primary Store')}
                isAllBranches={selectedBranchId === 'all'}
                currencySymbol={currencySymbol}
                onOpenBranchModal={() => {
                  openAction('manage-branches');
                  setIsBranchModalOpen(true);
                }}
                onNavigate={(path) => handleNavigateSection(path)}
              />
            )}
          </main>
        </div>
      </div>

      {/* ================= OPERATIONAL ACTION MODAL ================= */}
      {activeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-[#181a20] rounded-sm max-w-sm w-full p-6 text-center space-y-4 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 right-4 p-1 text-slate-400 hover:text-white rounded-sm hover:bg-white/5 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="w-12 h-12 rounded-sm bg-[#985184]/15 text-[#985184] mx-auto flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-[#fbb945]" />
            </div>

            <div>
              <h3 className="text-base font-bold text-white tracking-tight">{activeModal}</h3>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Branch <span className="text-[#fbb945] font-semibold">{selectedBranch?.name || 'Primary Store'}</span> is synced. You can manage {activeModal.toLowerCase()} records, barcode printing, and pricing parameters here.
              </p>
            </div>

            <div className="pt-2">
              <Button
                type="button"
                onClick={() => setActiveModal(null)}
                className="w-full bg-[#985184] hover:bg-[#854372] text-white font-semibold text-xs h-9 rounded-sm cursor-pointer shadow-sm"
              >
                Close & Continue
              </Button>
            </div>
          </div>
        </div>
      )}
      {/* ================= BRANCH MANAGEMENT MODAL ================= */}
      <BranchManagementModal
        isOpen={isBranchModalOpen}
        onClose={() => {
          setIsBranchModalOpen(false);
          closeAction();
        }}
        currentBranchId={selectedBranchId}
        onSelectBranch={(b) => handleSelectBranchId(b.id)}
        onBranchesUpdated={handleRefreshBranches}
        onOpenAddWizard={() => {
          setIsBranchModalOpen(false);
          openAction('add-branch');
          setIsAddBranchWizardOpen(true);
        }}
      />

      {/* ================= ADD BRANCH ONBOARDING WIZARD ================= */}
      <AddBranchWizardModal
        isOpen={isAddBranchWizardOpen}
        onClose={() => {
          setIsAddBranchWizardOpen(false);
          closeAction();
        }}
        organization={organization}
        branches={branchList}
        onBranchCreated={(newBranch) => {
          handleRefreshBranches();
          handleSelectBranchId(newBranch.id);
          closeAction();
        }}
      />

      {/* ================= FULL-SCREEN BRANCH SWITCHING OVERLAY ================= */}
      <BranchSwitchingOverlay
        isVisible={isSwitchingBranch}
        fromBranchName={switchingSourceName}
        toBranchName={switchingTargetName}
      />

      {/* ================= CATALOG SEARCH PALETTE MODAL (Ctrl + K) ================= */}
      <CatalogSearchModal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        branchId={selectedBranchId === 'all' ? undefined : selectedBranchId}
        onSelectProduct={handleSelectCatalogProduct}
        onSelectCategory={handleSelectCatalogCategory}
      />

      {/* ================= REAL-TIME ACCESS REVOCATION EJECTION MODAL ================= */}
      <AccessRevocationModal
        isOpen={revocationModal.isOpen}
        type={revocationModal.type}
        branchName={revocationModal.branchName}
        organizationName={revocationModal.organizationName}
        remainingBranchName={revocationModal.remainingBranchName}
        onProceed={handleProceedRevocation}
      />

      {/* ================= REAL-TIME ROLE CHANGE ANIMATED TRANSITION OVERLAY ================= */}
      <RoleChangeTransitionOverlay
        isOpen={roleTransitionModal.isOpen}
        branchName={roleTransitionModal.branchName}
        oldRole={roleTransitionModal.oldRole}
        newRole={roleTransitionModal.newRole}
        onComplete={handleCompleteRoleTransition}
      />
    </div>
  );
}
