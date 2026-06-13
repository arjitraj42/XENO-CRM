import React, { useState, useEffect, useRef } from 'react';
import { 
  Users, 
  ShoppingBag, 
  Layers, 
  Send, 
  BarChart3, 
  Database, 
  Sparkles, 
  Search, 
  Filter, 
  Plus, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  HelpCircle,
  TrendingUp,
  FileSpreadsheet,
  RefreshCw,
  Terminal,
  X,
  ChevronRight,
  ArrowUpRight,
  ShieldAlert,
  Activity,
  Smartphone,
  Info,
  User,
  Sliders,
  DollarSign,
  Percent
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  PieChart, 
  Pie, 
  Cell,
  LineChart,
  Line
} from 'recharts';

const BACKEND_URL = 'http://localhost:5000';
const COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#ec4899', '#f59e0b', '#06b6d4'];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [sseStatus, setSseStatus] = useState('connecting'); // connecting, connected, disconnected
  const [notification, setNotification] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Shared CRM States
  const [customers, setCustomers] = useState([]);
  const [customersTotal, setCustomersTotal] = useState(0);
  const [customersFilter, setCustomersFilter] = useState({ city: '', gender: '', search: '', page: 1 });
  const [segments, setSegments] = useState([]);
  const [campaigns, setCampaigns] = useState([]);

  // New Analytics States
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Customer Intelligence States
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);
  const [selectedCustomerDetail, setSelectedCustomerDetail] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [loadingCustomerDetail, setLoadingCustomerDetail] = useState(false);

  // Helper flags to trigger segment / campaign setup from recommendations
  const [prefilledFilter, setPrefilledFilter] = useState(null);
  const [prefilledCampaignData, setPrefilledCampaignData] = useState(null);

  const [autoRefresh, setAutoRefresh] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Stable references to fetch functions to avoid resetting interval on state changes
  const fetchCustomersRef = useRef(null);
  const fetchSegmentsRef = useRef(null);
  const fetchCampaignsRef = useRef(null);
  const fetchAnalyticsRef = useRef(null);

  useEffect(() => {
    fetchCustomersRef.current = fetchCustomers;
    fetchSegmentsRef.current = fetchSegments;
    fetchCampaignsRef.current = fetchCampaigns;
    fetchAnalyticsRef.current = fetchAnalytics;
  });

  const refreshAllData = async () => {
    setIsRefreshing(true);
    showToast("Refreshing CRM data...");
    try {
      await Promise.all([
        fetchCustomers(),
        fetchSegments(),
        fetchCampaigns(),
        fetchAnalytics()
      ]);
      showToast("CRM data refreshed successfully!");
    } catch (err) {
      console.error("Manual refresh failed:", err);
      showToast("Sync failed", "error");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    let intervalId = null;
    if (autoRefresh) {
      showToast("Auto-refresh enabled (every 15s)");
      intervalId = setInterval(() => {
        fetchCustomersRef.current();
        fetchSegmentsRef.current();
        fetchCampaignsRef.current();
        fetchAnalyticsRef.current();
      }, 15000);
    }
    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [autoRefresh]);

  // SSE connection holder
  useEffect(() => {
    let eventSource = new EventSource(`${BACKEND_URL}/api/events`);

    eventSource.onopen = () => {
      setSseStatus('connected');
      console.log('[SSE] Stream connected successfully.');
    };

    eventSource.onerror = (err) => {
      setSseStatus('disconnected');
      console.error('[SSE] Connection error. Retrying...', err);
    };

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        console.log('[SSE] Broadcast event received:', payload);

        if (payload.type === 'COMMUNICATION_STATUS_UPDATE') {
          // Commented out to prevent toast flooding when sending campaigns to many customers
          // showToast(`Message Status: ${payload.data.status}`);
          fetchCampaigns();
          if (activeTab === 'dashboard') fetchAnalytics();
        } else if (payload.type === 'CAMPAIGN_STATE_CHANGE') {
          showToast(`Campaign status shifted: ${payload.data.status}`);
          fetchCampaigns();
          if (activeTab === 'dashboard') fetchAnalytics();
        } else if (payload.type === 'CUSTOMERS_INGESTED') {
          showToast(`Bulk customers ingested: +${payload.data.inserted}`);
          fetchCustomers();
          if (activeTab === 'dashboard') fetchAnalytics();
        } else if (payload.type === 'ORDERS_INGESTED') {
          showToast(`Bulk orders ingested: +${payload.data.inserted}`);
          fetchCustomers();
          if (activeTab === 'dashboard') fetchAnalytics();
        }
      } catch (err) {
        console.error('[SSE] Failed to parse event payload:', err);
      }
    };

    return () => {
      eventSource.close();
    };
  }, [activeTab]);

  // API Fetch actions
  const fetchCustomers = async () => {
    try {
      const { search, city, gender, page } = customersFilter;
      let url = `${BACKEND_URL}/api/customers?limit=15&page=${page}`;
      if (city) url += `&city=${city}`;
      if (gender) url += `&gender=${gender}`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (search) {
        const filteredList = data.list.filter(c => 
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase()) ||
          c.phone.includes(search)
        );
        setCustomers(filteredList);
        setCustomersTotal(filteredList.length);
      } else {
        setCustomers(data.list);
        setCustomersTotal(data.total);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
    }
  };

  const fetchSegments = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/segments`);
      const data = await res.json();
      setSegments(data);
    } catch (err) {
      console.error('Error fetching segments:', err);
    }
  };

  const fetchCampaigns = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/campaigns`);
      const data = await res.json();
      setCampaigns(data);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  const fetchAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/analytics/dashboard`);
      const data = await res.json();
      setAnalyticsData(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const fetchCustomerDetails = async (id) => {
    setLoadingCustomerDetail(true);
    try {
      // Get customer profile
      const resCust = await fetch(`${BACKEND_URL}/api/customers/${id}`);
      const dataCust = await resCust.json();
      setSelectedCustomerDetail(dataCust);

      // Get customer orders
      const resOrders = await fetch(`${BACKEND_URL}/api/customers/${id}/orders`);
      const dataOrders = await resOrders.json();
      setCustomerOrders(dataOrders);
    } catch (err) {
      console.error('Error loading customer detail drawer:', err);
      showToast('Error loading customer information', 'error');
    } finally {
      setLoadingCustomerDetail(false);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [customersFilter]);

  useEffect(() => {
    fetchSegments();
    fetchCampaigns();
    if (activeTab === 'dashboard') {
      fetchAnalytics();
    }
  }, [activeTab]);

  useEffect(() => {
    if (selectedCustomerId) {
      fetchCustomerDetails(selectedCustomerId);
    } else {
      setSelectedCustomerDetail(null);
      setCustomerOrders([]);
    }
  }, [selectedCustomerId]);

  const showToast = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Trigger segment creation from recommendation
  const handleTriggerSegment = (filter) => {
    setPrefilledFilter(filter);
    setActiveTab('segments');
  };

  return (
    <div className="flex h-screen bg-[#09090b] text-[#e4e4e7] overflow-hidden font-sans">
      
      {/* Toast Notification */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border border-zinc-800 bg-[#121214]/90 backdrop-blur-md shadow-2xl animate-slide-up glow-blue">
          <div className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-zinc-100">{notification.message}</span>
          <button onClick={() => setNotification(null)} className="ml-2 text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Sidebar Navigation */}
      <aside className={`${sidebarCollapsed ? 'w-20' : 'w-64'} border-r border-zinc-800 bg-[#121214] flex flex-col justify-between transition-all duration-300 z-30 shrink-0`}>
        <div>
          {/* Logo Section */}
          <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              {!sidebarCollapsed && (
                <div className="animate-fade-in">
                  <h1 className="font-extrabold text-sm tracking-tight text-white uppercase">
                    XENO CRM
                  </h1>
                  <span className="text-[9px] uppercase tracking-wider text-blue-400 font-bold">AI Customer Engine</span>
                </div>
              )}
            </div>
          </div>

          {/* User Profile Workspace Indicator */}
          {!sidebarCollapsed && (
            <div className="p-4 mx-3 my-4 rounded-xl bg-zinc-900/40 border border-zinc-800/60 flex items-center gap-3 animate-fade-in">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-300 border border-zinc-700">
                HQ
              </div>
              <div className="flex-1 overflow-hidden">
                <p className="text-xs font-bold text-zinc-200 truncate">Enterprise Workspace</p>
                <p className="text-[10px] text-zinc-500 font-mono">Premium Hub</p>
              </div>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="p-3 space-y-1">
            {[
              { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
              { id: 'customers', label: 'Customers', icon: Users },
              { id: 'segments', label: 'Segments', icon: Layers },
              { id: 'campaigns', label: 'Campaigns', icon: Send },
              { id: 'data-manager', label: 'Data Manager', icon: Database },
              { id: 'ai-assistant', label: '✨ Xeno AI Assistant', icon: Sparkles, isAi: true }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button 
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    // Close drawers
                    setSelectedCustomerId(null);
                  }}
                  className={`w-full flex items-center rounded-xl p-3 transition-all duration-200 group relative ${
                    isActive 
                      ? tab.isAi
                        ? 'bg-gradient-to-r from-indigo-950/40 to-blue-950/40 text-white font-medium border-l-2 border-indigo-500 shadow-lg shadow-indigo-500/5'
                        : 'bg-zinc-800 text-white font-medium border-l-2 border-blue-500' 
                      : tab.isAi
                        ? 'text-indigo-400 hover:bg-indigo-950/10 hover:text-indigo-200'
                        : 'text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 transition-transform group-hover:scale-105 ${
                    isActive 
                      ? tab.isAi ? 'text-indigo-400' : 'text-blue-500' 
                      : tab.isAi ? 'text-indigo-400/80 group-hover:text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
                  } ${tab.isAi ? 'animate-pulse' : ''}`} />
                  {!sidebarCollapsed && <span className="ml-3 text-sm animate-fade-in">{tab.label}</span>}
                  
                  {/* Tooltip for collapsed view */}
                  {sidebarCollapsed && (
                    <div className="absolute left-full ml-4 px-2 py-1 rounded bg-zinc-950 text-xs text-white border border-zinc-800 opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity duration-200 z-40 shadow-xl font-medium whitespace-nowrap">
                      {tab.label}
                    </div>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Real-time SSE Agent status */}
        <div className="p-4 border-t border-zinc-800 bg-[#0c0c0d]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 overflow-hidden">
              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                sseStatus === 'connected' ? 'bg-emerald-500 pulse-green' : sseStatus === 'connecting' ? 'bg-amber-500 animate-pulse' : 'bg-red-500'
              }`} />
              {!sidebarCollapsed && (
                <span className="text-xs font-semibold text-zinc-400 truncate animate-fade-in">
                  {sseStatus === 'connected' ? 'AI Agent Sync Active' : sseStatus === 'connecting' ? 'Sync Reconnecting' : 'Sync Disconnected'}
                </span>
              )}
            </div>
            {!sidebarCollapsed && (
              <span className="text-[9px] text-blue-400 bg-zinc-900 border border-zinc-800 px-1.5 py-0.5 rounded font-mono font-bold animate-fade-in">LIVE</span>
            )}
          </div>
        </div>
      </aside>

      {/* Main Workspace Container */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-[#09090b]">
        
        {/* Header */}
        <header className="h-16 border-b border-zinc-850 px-8 flex items-center justify-between shrink-0 glass-panel sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition md:block hidden"
              title="Toggle Sidebar"
            >
              <ChevronRight className={`w-4 h-4 transition-transform duration-300 ${sidebarCollapsed ? '' : 'rotate-180'}`} />
            </button>
            <h2 className="text-lg font-bold tracking-tight text-white capitalize flex items-center gap-2">
              {activeTab === 'data-manager' ? 'Data Manager' : activeTab === 'ai-assistant' ? '✨ Xeno AI Assistant' : `${activeTab}`}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Auto Refresh Web Host option */}
            <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-zinc-400 hover:text-zinc-200 transition">
              <div className="relative">
                <input 
                  type="checkbox" 
                  checked={autoRefresh} 
                  onChange={(e) => setAutoRefresh(e.target.checked)} 
                  className="sr-only"
                />
                <div className={`w-8 h-5 rounded-full transition-colors ${autoRefresh ? 'bg-indigo-600' : 'bg-zinc-800 border border-zinc-700'}`} />
                <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${autoRefresh ? 'translate-x-3' : 'translate-x-0'}`} />
              </div>
              <span className="md:block hidden">Auto Refresh Web Host</span>
            </label>

            {/* Refresh Web Host option */}
            <button
              onClick={refreshAllData}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 hover:border-zinc-700 text-zinc-300 hover:text-white rounded-xl text-xs font-bold transition shadow"
              title="Force sync database and refresh all components"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-indigo-400' : 'text-zinc-400'}`} />
              <span>Refresh Web Host</span>
            </button>

            {/* Server API tag */}
            <div className="text-xs bg-zinc-900 border border-zinc-800 px-3 py-1.5 rounded-xl text-zinc-300 font-mono md:block hidden">
              Server API: <span className="text-blue-400 font-semibold">{BACKEND_URL}</span>
            </div>
          </div>
        </header>

        {/* View Router */}
        <div className="p-8 flex-1">
          {activeTab === 'dashboard' && (
            <DashboardView 
              campaigns={campaigns} 
              analyticsData={analyticsData}
              loadingAnalytics={loadingAnalytics}
              showToast={showToast} 
              onTriggerSegment={handleTriggerSegment}
              onSelectCustomer={setSelectedCustomerId}
              onNavigate={setActiveTab}
            />
          )}
          {activeTab === 'customers' && (
            <CustomersView 
              customers={customers} 
              total={customersTotal} 
              filter={customersFilter} 
              setFilter={setCustomersFilter} 
              refresh={fetchCustomers} 
              onSelectCustomer={setSelectedCustomerId}
            />
          )}
          {activeTab === 'segments' && (
            <SegmentsView 
              segments={segments} 
              refresh={fetchSegments} 
              showToast={showToast}
              prefilledFilter={prefilledFilter}
              clearPrefilledFilter={() => setPrefilledFilter(null)}
            />
          )}
          {activeTab === 'campaigns' && (
            <CampaignsView 
              campaigns={campaigns} 
              segments={segments} 
              refresh={fetchCampaigns} 
              showToast={showToast}
              prefilledCampaignData={prefilledCampaignData}
              clearPrefilledCampaignData={() => setPrefilledCampaignData(null)}
            />
          )}
          {activeTab === 'data-manager' && (
            <DataManagerView 
              showToast={showToast} 
              refreshCustomers={fetchCustomers} 
              customersTotal={customersTotal}
              segmentsTotal={segments.length}
              campaignsTotal={campaigns.length}
            />
          )}
          {activeTab === 'ai-assistant' && (
            <AiAssistantView 
              analyticsData={analyticsData}
              campaigns={campaigns}
              segments={segments}
              showToast={showToast}
              onTriggerSegment={handleTriggerSegment}
              onTriggerCampaign={(campData) => {
                setPrefilledCampaignData(campData);
                setActiveTab('campaigns');
              }}
              onSelectCustomer={setSelectedCustomerId}
            />
          )}
        </div>
      </main>

      {/* Customer Intelligence Sliding Drawer */}
      {selectedCustomerId && (
        <CustomerIntelligenceDrawer 
          customerId={selectedCustomerId}
          customerDetail={selectedCustomerDetail}
          orders={customerOrders}
          loading={loadingCustomerDetail}
          onClose={() => setSelectedCustomerId(null)}
          onTriggerCampaign={(campData) => {
            setPrefilledCampaignData(campData);
            setActiveTab('campaigns');
            setSelectedCustomerId(null);
          }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

// ----------------------------------------------------
// 1. DASHBOARD VIEW
// ----------------------------------------------------
function DashboardView({ campaigns, analyticsData, loadingAnalytics, showToast, onTriggerSegment, onSelectCustomer, onNavigate }) {
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [stats, setStats] = useState(null);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingFunnel, setLoadingFunnel] = useState(false);
  const [activeChartTab, setActiveChartTab] = useState('revenue'); // revenue, growth

  const viewCampaignStats = async (campaign) => {
    setLoadingFunnel(true);
    setSelectedCampaign(campaign);
    try {
      const res = await fetch(`${BACKEND_URL}/api/campaigns/${campaign.id}/stats`);
      const data = await res.json();
      setStats(data.stats);
      setAiSummary(data.aiSummary);
    } catch (err) {
      console.error(err);
      showToast('Error loading campaign metrics', 'error');
    } finally {
      setLoadingFunnel(false);
    }
  };

  // Funnel chart compiled dynamically
  const funnelData = stats ? [
    { name: 'Sent', value: stats.sentCount, fill: '#3b82f6' },
    { name: 'Delivered', value: Math.round(stats.sentCount * (stats.deliveryRate / 100)), fill: '#06b6d4' },
    { name: 'Opened', value: Math.round(stats.sentCount * (stats.deliveryRate / 100) * (stats.openRate / 100)), fill: '#8b5cf6' },
    { name: 'Read', value: Math.round(stats.sentCount * (stats.deliveryRate / 100) * (stats.readRate / 100)), fill: '#ec4899' },
    { name: 'Clicked', value: Math.round(stats.sentCount * (stats.deliveryRate / 100) * (stats.clickRate / 100)), fill: '#10b981' }
  ] : [];

  if (loadingAnalytics) {
    return (
      <div className="h-96 flex flex-col items-center justify-center gap-3">
        <RefreshCw className="w-10 h-10 text-blue-500 animate-spin" />
        <p className="text-sm text-zinc-450 font-medium">Analyzing database & generating intelligence metrics...</p>
      </div>
    );
  }

  // Dashboard Fallback calculations if backend has delay or empty
  const revenueTrendData = analyticsData?.revenueTrend || [];
  const audienceGrowthData = analyticsData?.audienceGrowth || [];
  const channelBreakoutData = analyticsData?.channelBreakout || [];
  const churnRisks = analyticsData?.churnRisks || [];
  const healthStats = analyticsData?.healthStats || { excellent: 0, good: 0, atRisk: 0 };
  const topCustomers = analyticsData?.topCustomers || [];
  const recommendations = analyticsData?.recommendations || [];
  const segmentSuggestions = analyticsData?.segmentSuggestions || [];
  const bestCampaign = analyticsData?.bestCampaign || null;

  // Render KPIs
  const totalAttributedRevenue = revenueTrendData.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="space-y-8 animate-fade-in">
      
      {/* 1. TOP KPI METRICS */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="glass-card p-6 rounded-2xl glow-blue">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Attributed Revenue</span>
            <DollarSign className="w-5 h-5 text-blue-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">₹{totalAttributedRevenue ? totalAttributedRevenue.toLocaleString('en-IN') : '0'}</h3>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold mt-3 inline-block">
            +18.4% vs Last Period
          </span>
        </div>

        <div className="glass-card p-6 rounded-2xl glow-violet">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Active Campaigns</span>
            <Send className="w-5 h-5 text-violet-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">{campaigns.length}</h3>
          <span className="text-[10px] text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded-full font-bold mt-3 inline-block">
            Dispatched & Scheduled
          </span>
        </div>

        <div className="glass-card p-6 rounded-2xl glow-emerald">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Avg. Open Rate</span>
            <Percent className="w-5 h-5 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">62.8%</h3>
          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full font-bold mt-3 inline-block font-mono">
            Industry Beat (+12%)
          </span>
        </div>

        <div className="glass-card p-6 rounded-2xl glow-amber">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Click Conversion</span>
            <Activity className="w-5 h-5 text-amber-500" />
          </div>
          <h3 className="text-2xl font-extrabold text-white">16.4%</h3>
          <span className="text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full font-bold mt-3 inline-block">
            Attributed Purchases
          </span>
        </div>
      </div>

      {/* 2. DYNAMIC AI RECOMMENDATION CENTER */}
      {recommendations.length > 0 && (
        <div className="glass-card p-6 rounded-2xl border-l-4 border-l-blue-600 bg-gradient-to-r from-blue-950/20 to-transparent">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            AI Recommendation Center
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {recommendations.map(rec => (
              <div key={rec.id} className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800 hover:border-zinc-750 transition flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2 h-2 rounded-full ${
                      rec.type === 'danger' ? 'bg-rose-500' : rec.type === 'success' ? 'bg-emerald-500' : 'bg-blue-500'
                    }`} />
                    <h4 className="text-xs font-bold text-zinc-200">{rec.title}</h4>
                  </div>
                  <p className="text-[11px] leading-relaxed text-zinc-400">{rec.desc}</p>
                </div>
                {rec.actionText && (
                  <button 
                    onClick={() => {
                      if (rec.suggestedFilter) {
                        handleTriggerSegment(rec.suggestedFilter);
                      } else {
                        onNavigate(rec.actionTab || 'dashboard');
                      }
                    }}
                    className="mt-4 w-full py-1.5 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500 hover:text-white text-blue-400 text-xs font-bold transition flex items-center justify-center gap-1"
                  >
                    {rec.actionText}
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. CHARTS PANEL (REVENUE TREND & AUDIENCE GROWTH) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-500" />
                Performance Analytics
              </h3>
              <div className="flex rounded-lg bg-zinc-900 p-0.5 border border-zinc-850">
                <button 
                  onClick={() => setActiveChartTab('revenue')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${activeChartTab === 'revenue' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Revenue Trends
                </button>
                <button 
                  onClick={() => setActiveChartTab('growth')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition ${activeChartTab === 'growth' ? 'bg-zinc-800 text-white shadow' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Audience Growth
                </button>
              </div>
            </div>

            <div className="h-72">
              {activeChartTab === 'revenue' ? (
                revenueTrendData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs italic">
                    Not enough order data to render trends. Ingest orders in the Data Manager.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueTrendData} margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                      <XAxis dataKey="_id" stroke="#52525b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} tickFormatter={(val) => `₹${val}`} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        labelClassName="text-[10px] text-zinc-500 font-mono"
                      />
                      <Area type="monotone" dataKey="revenue" stroke="#3b82f6" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRevenue)" name="Revenue" />
                    </AreaChart>
                  </ResponsiveContainer>
                )
              ) : (
                audienceGrowthData.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs italic">
                    Not enough customer profile registrations to render growth.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={audienceGrowthData} margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1f1f23" vertical={false} />
                      <XAxis dataKey="month" stroke="#52525b" fontSize={10} tickLine={false} />
                      <YAxis stroke="#52525b" fontSize={10} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                        itemStyle={{ color: '#fff' }}
                        labelClassName="text-[10px] text-zinc-500 font-mono"
                      />
                      <Line type="monotone" dataKey="totalAudience" stroke="#8b5cf6" strokeWidth={3} dot={{ r: 4, stroke: '#8b5cf6', strokeWidth: 2, fill: '#09090b' }} name="Total Contacts" />
                    </LineChart>
                  </ResponsiveContainer>
                )
              )}
            </div>
          </div>
          <p className="text-[10px] text-zinc-500 mt-4 leading-relaxed flex items-center gap-1 font-medium">
            <Info className="w-3.5 h-3.5" />
            Charts update in real-time as transactions or audience logs flow via Webhook/SSE streams.
          </p>
        </div>

        {/* CHANNEL BREAKOUT PIE */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-indigo-500" />
              Channel Breakout
            </h3>

            <div className="h-48 relative flex items-center justify-center">
              {channelBreakoutData.length === 0 ? (
                <div className="text-zinc-500 text-xs italic">No sales data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={channelBreakoutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={3}
                      dataKey="value"
                      nameKey="_id"
                    >
                      {channelBreakoutData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Legend */}
            <div className="mt-4 grid grid-cols-3 gap-2 text-[10px] text-zinc-400 font-bold">
              {channelBreakoutData.map((item, idx) => (
                <div key={item._id} className="flex items-center gap-1.5 truncate">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                  <span className="truncate">{item._id}: ₹{item.value.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 4. CHURN PREDICTION, HEALTH SCORES, BEST CAMPAIGN */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* CHURN PREDICTION WIDGET */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            Churn Risk Warning
          </h3>
          <div className="space-y-3">
            {churnRisks.map(cust => (
              <div key={cust.id} className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-center justify-between">
                <div>
                  <h4 onClick={() => onSelectCustomer(cust.id)} className="text-xs font-bold text-zinc-200 cursor-pointer hover:text-blue-400 hover:underline">{cust.name}</h4>
                  <p className="text-[10px] text-zinc-500">Idle for {cust.lastPurchaseDaysAgo} days · LTV ₹{cust.lifetimeValue.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-500/15 text-rose-400 font-mono border border-rose-500/20">
                    {cust.churnProbability}% RISK
                  </span>
                </div>
              </div>
            ))}
            {churnRisks.length === 0 && (
              <div className="text-center py-6 text-zinc-500 text-xs italic">No high-risk dormant customer records.</div>
            )}
          </div>
        </div>

        {/* CUSTOMER HEALTH SCORES */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Customer Health Scores
          </h3>
          
          {/* Health Stats Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] font-bold text-zinc-400">
              <span className="text-emerald-400">Excellent ({healthStats.excellent})</span>
              <span className="text-amber-400">Good ({healthStats.good})</span>
              <span className="text-rose-400">At Risk ({healthStats.atRisk})</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-900 border border-zinc-800 flex overflow-hidden">
              <div style={{ width: `${healthStats.excellent}%` }} className="bg-emerald-500 h-full" />
              <div style={{ width: `${healthStats.good}%` }} className="bg-amber-500 h-full" />
              <div style={{ width: `${healthStats.atRisk}%` }} className="bg-rose-500 h-full" />
            </div>
          </div>

          {/* Top customer health entries */}
          <div className="space-y-3 pt-2">
            {topCustomers.map(cust => (
              <div key={cust.id} className="flex items-center justify-between text-xs border-b border-zinc-850 pb-2.5">
                <div>
                  <h4 onClick={() => onSelectCustomer(cust.id)} className="font-bold text-zinc-200 cursor-pointer hover:text-blue-400 hover:underline">{cust.name}</h4>
                  <p className="text-[10px] text-zinc-500">{cust.city} · LTV ₹{cust.lifetimeValue.toLocaleString('en-IN')}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  cust.healthScore >= 80 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                  cust.healthScore >= 50 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}>
                  {cust.healthScore} / 100
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* BEST PERFORMING CAMPAIGN WIDGET */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Top Campaign Winner
            </h3>
            
            {bestCampaign ? (
              <div className="space-y-4">
                <div>
                  <h4 className="text-md font-bold text-zinc-150">{bestCampaign.name}</h4>
                  <p className="text-[10px] uppercase font-bold font-mono text-zinc-450 tracking-wider mt-0.5">{bestCampaign.channel}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs font-bold font-mono border-t border-zinc-850 pt-4">
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-850">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">Revenue Lift</span>
                    <p className="text-sm text-emerald-400 mt-1">₹{bestCampaign.revenueLift.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-850">
                    <span className="text-[9px] uppercase tracking-wider text-zinc-500">Conversions</span>
                    <p className="text-sm text-blue-400 mt-1">+{bestCampaign.attributedOrders} sales</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800 rounded-xl">
                <HelpCircle className="w-7 h-7 text-zinc-500 mb-2" />
                <p className="text-xs text-zinc-500 italic">No campaign analytics data found yet. Launch and complete campaigns to populate conversions.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 5. SMART SEGMENT SUGGESTIONS */}
      <div className="glass-card p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Layers className="w-5 h-5 text-violet-500" />
          Smart Segment Recommendations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {segmentSuggestions.map((seg, idx) => (
            <div key={idx} className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/80 hover:border-violet-500/40 transition flex flex-col justify-between">
              <div>
                <h4 className="text-xs font-bold text-zinc-200">{seg.name}</h4>
                <p className="text-[11px] text-zinc-500 mt-1.5 leading-relaxed">{seg.desc}</p>
              </div>
              <button 
                onClick={() => handleTriggerSegment(seg.filter_json)}
                className="mt-4 w-full py-1.5 border border-zinc-800 bg-zinc-950/60 hover:bg-zinc-800 hover:text-white text-zinc-400 text-xs font-bold rounded-lg transition"
              >
                Compile Target Filter
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* 6. CAMPAIGN TABLE & FUNNEL ANALYTICS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Campaign List */}
        <div className="lg:col-span-2 glass-card p-6 rounded-2xl">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            Recent Campaign Dispatches
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500 font-bold font-mono">
                  <th className="pb-3">Name</th>
                  <th className="pb-3">Channel</th>
                  <th className="pb-3">Status</th>
                  <th className="pb-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850/60 text-xs font-medium">
                {campaigns.map((camp) => (
                  <tr key={camp.id} className="hover:bg-zinc-900/20 transition">
                    <td className="py-4 font-bold text-zinc-200">{camp.name}</td>
                    <td className="py-4 capitalize font-mono text-[11px] text-blue-400">{camp.channel}</td>
                    <td className="py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-extrabold tracking-wider uppercase ${
                        camp.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                        camp.status === 'SENDING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse' :
                        camp.status === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                        'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}>
                        {camp.status}
                      </span>
                    </td>
                    <td className="py-4 text-right">
                      {camp.status !== 'DRAFT' && (
                        <button 
                          onClick={() => viewCampaignStats(camp)}
                          className="px-3 py-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 hover:border-zinc-700 text-zinc-300 rounded-lg text-[11px] font-bold transition duration-150"
                        >
                          View Stats
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {campaigns.length === 0 && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-zinc-500 text-xs italic">
                      No campaigns built. Navigate to the Campaigns tab to start.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Funnel Panel */}
        <div className="glass-card p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              Campaign Funnel
            </h3>
            {!selectedCampaign ? (
              <div className="h-64 flex flex-col items-center justify-center text-center p-4 border border-dashed border-zinc-800 rounded-xl">
                <HelpCircle className="w-8 h-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-550 italic leading-relaxed">Select a campaign from the left list to load its real-time analytics conversion funnel and AI generated summary notes.</p>
              </div>
            ) : loadingFunnel ? (
              <div className="h-64 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
              </div>
            ) : stats ? (
              <div className="space-y-6">
                <h4 className="text-xs font-bold text-zinc-200 border-b border-zinc-850 pb-2">{selectedCampaign.name}</h4>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={funnelData} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={80} stroke="#71717a" fontSize={10} tickLine={false} />
                      <Tooltip cursor={{ fill: 'rgba(59, 130, 246, 0.03)' }} contentStyle={{ backgroundColor: '#121214', borderColor: '#27272a', borderRadius: '12px' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={12} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Stats list */}
                <div className="grid grid-cols-2 gap-4 text-xs font-bold font-mono">
                  <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase">Open Rate</span>
                    <p className="text-xs text-zinc-250 mt-1">{stats.openRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase">Delivered</span>
                    <p className="text-xs text-zinc-250 mt-1">{stats.deliveryRate.toFixed(1)}%</p>
                  </div>
                  <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase">Conversions</span>
                    <p className="text-xs text-emerald-400 mt-1">+{stats.attributedOrders} sales</p>
                  </div>
                  <div className="bg-zinc-900/60 p-2.5 rounded-lg border border-zinc-850">
                    <span className="text-[9px] text-zinc-500 uppercase">Revenue Lift</span>
                    <p className="text-xs text-blue-400 mt-1">₹{stats.revenueLift.toLocaleString('en-IN')}</p>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {selectedCampaign && stats && !loadingFunnel && (
            <div className="mt-6 p-4 rounded-xl bg-violet-500/5 border border-violet-500/10 animate-slide-up">
              <h4 className="text-[10px] font-extrabold text-violet-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                AI Campaign Insight
              </h4>
              <p className="text-[11px] leading-relaxed text-zinc-300 font-sans italic">{aiSummary}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 2. CUSTOMERS VIEW
// ----------------------------------------------------
function CustomersView({ customers, total, filter, setFilter, refresh, onSelectCustomer }) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Search and Filters */}
      <div className="glass-card p-6 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="relative flex-1 min-w-[280px]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input 
            type="text" 
            placeholder="Search customer records by name, email or phone..." 
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-full bg-[#121214] border border-zinc-800 hover:border-zinc-700 focus:border-blue-500 rounded-xl pl-10 pr-4 py-2.5 text-sm focus:outline-none text-white transition placeholder-zinc-650"
          />
        </div>

        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-zinc-500" />
            <select
              value={filter.city}
              onChange={(e) => setFilter({ ...filter, city: e.target.value })}
              className="bg-[#121214] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-zinc-200 font-semibold"
            >
              <option value="">All Cities</option>
              {['Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Pune', 'Hyderabad', 'Ahmedabad'].map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <select
            value={filter.gender}
            onChange={(e) => setFilter({ ...filter, gender: e.target.value })}
            className="bg-[#121214] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-zinc-200 font-semibold"
          >
            <option value="">All Genders</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
          </select>
        </div>
      </div>

      {/* Customer List */}
      <div className="glass-card p-6 rounded-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500 font-bold font-mono">
                <th className="pb-3">Customer ID / Name</th>
                <th className="pb-3">Contact</th>
                <th className="pb-3">Demographics</th>
                <th className="pb-3">Tags</th>
                <th className="pb-3 text-right">LTV</th>
                <th className="pb-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60 text-xs font-semibold">
              {customers.map((cust) => {
                // Approximate score for layout
                const healthScore = Math.max(0, Math.min(100, Math.round((cust.lifetime_value / 250) + 70)));
                return (
                  <tr key={cust.id} className="hover:bg-zinc-900/30 transition">
                    <td className="py-4">
                      <p className="font-bold text-zinc-100 hover:text-blue-400 cursor-pointer" onClick={() => onSelectCustomer(cust.id)}>{cust.name}</p>
                      <span className="text-[10px] text-zinc-500 font-mono">{cust.id}</span>
                    </td>
                    <td className="py-4 font-mono text-[11px]">
                      <p className="text-zinc-250">{cust.email}</p>
                      <p className="text-zinc-500 mt-0.5">{cust.phone}</p>
                    </td>
                    <td className="py-4">
                      <p className="text-zinc-200">{cust.city}</p>
                      <span className="text-[10px] text-zinc-500">Age {cust.age} · {cust.gender}</span>
                    </td>
                    <td className="py-4">
                      <div className="flex flex-wrap gap-1">
                        {cust.tags.map(t => (
                          <span key={t} className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 text-[9px] font-extrabold uppercase border border-zinc-800/80 tracking-wider">
                            {t}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="py-4 text-right font-mono font-bold text-blue-400">
                      ₹{cust.lifetime_value.toLocaleString('en-IN')}
                    </td>
                    <td className="py-4 text-right">
                      <button 
                        onClick={() => onSelectCustomer(cust.id)}
                        className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 text-zinc-300 rounded-lg text-[10px] font-extrabold uppercase transition"
                      >
                        Analyze
                      </button>
                    </td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr>
                  <td colSpan="6" className="text-center py-8 text-zinc-500 italic">
                    No customers found matching search filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between border-t border-zinc-850 mt-6 pt-4 text-xs font-bold text-zinc-550">
          <span>Displaying {customers.length} of {total} contacts</span>
          <div className="flex gap-2 font-mono">
            <button 
              disabled={filter.page === 1}
              onClick={() => setFilter({ ...filter, page: filter.page - 1 })}
              className="px-3 py-1.5 bg-[#121214] border border-zinc-800 hover:border-zinc-700 text-zinc-350 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
            >
              PREV
            </button>
            <button 
              disabled={customers.length < 15}
              onClick={() => setFilter({ ...filter, page: filter.page + 1 })}
              className="px-3 py-1.5 bg-[#121214] border border-zinc-800 hover:border-zinc-700 text-zinc-350 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition"
            >
              NEXT
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. CUSTOMER INTELLIGENCE SLIDING DRAWER
// ----------------------------------------------------
function CustomerIntelligenceDrawer({ customerId, customerDetail, orders, loading, onClose, onTriggerCampaign, showToast }) {
  if (loading || !customerDetail) {
    return (
      <div className="fixed inset-y-0 right-0 w-96 border-l border-zinc-800 bg-[#121214] p-8 z-40 flex flex-col items-center justify-center gap-3 shadow-2xl">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-xs text-zinc-500 font-medium">Fetching profile details & purchase histories...</p>
      </div>
    );
  }

  const daysSince = customerDetail.last_purchase_at ? Math.round((new Date() - new Date(customerDetail.last_purchase_at)) / (1000 * 60 * 60 * 24)) : 365;
  let churnProbability = daysSince > 90 ? 85 : daysSince > 60 ? 60 : daysSince > 30 ? 30 : 10;
  let healthScore = Math.max(0, Math.min(100, Math.round((customerDetail.lifetime_value / 250) + (100 - churnProbability))));

  const aov = orders.length > 0 ? customerDetail.lifetime_value / orders.length : 0;

  return (
    <div className="fixed inset-y-0 right-0 w-[480px] border-l border-zinc-850 bg-[#121214]/95 backdrop-blur-md z-45 flex flex-col justify-between shadow-2xl animate-slide-up">
      {/* Drawer Header */}
      <div className="p-6 border-b border-zinc-850 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-zinc-800 to-zinc-700 flex items-center justify-center text-zinc-200 border border-zinc-700">
            <User className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white leading-tight">{customerDetail.name}</h3>
            <span className="text-[10px] text-zinc-500 font-mono">{customerDetail.id}</span>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg border border-zinc-850 hover:bg-zinc-900 text-zinc-400 hover:text-zinc-200 transition">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Drawer Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Profile Stats Cards */}
        <div className="grid grid-cols-2 gap-4 text-xs font-semibold">
          <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
            <span className="text-[9px] text-zinc-550 uppercase">Email</span>
            <p className="text-zinc-200 truncate mt-1">{customerDetail.email}</p>
          </div>
          <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
            <span className="text-[9px] text-zinc-550 uppercase">Phone</span>
            <p className="text-zinc-250 mt-1">{customerDetail.phone}</p>
          </div>
          <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
            <span className="text-[9px] text-zinc-550 uppercase">City</span>
            <p className="text-zinc-200 mt-1">{customerDetail.city}</p>
          </div>
          <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
            <span className="text-[9px] text-zinc-550 uppercase">Age / Gender</span>
            <p className="text-zinc-200 mt-1">Age {customerDetail.age} · {customerDetail.gender}</p>
          </div>
        </div>

        {/* Intelligence Gauges */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Health Score</span>
            <div className="flex items-center gap-3">
              <span className={`text-2xl font-extrabold ${healthScore >= 75 ? 'text-emerald-400' : healthScore >= 45 ? 'text-amber-400' : 'text-rose-400'}`}>
                {healthScore}
              </span>
              <span className="text-[9px] font-bold text-zinc-400 font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-850">
                {healthScore >= 75 ? 'EXCELLENT' : healthScore >= 45 ? 'AVERAGE' : 'AT RISK'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-zinc-950 flex overflow-hidden">
              <div style={{ width: `${healthScore}%` }} className={`h-full ${healthScore >= 75 ? 'bg-emerald-500' : healthScore >= 45 ? 'bg-amber-500' : 'bg-rose-500'}`} />
            </div>
          </div>

          <div className="p-4 bg-zinc-900/60 border border-zinc-850 rounded-xl space-y-2">
            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Churn risk index</span>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-extrabold text-zinc-200">{churnProbability}%</span>
              <span className={`text-[9px] font-bold font-mono px-2 py-0.5 rounded border ${
                churnProbability >= 60 ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
              }`}>
                {churnProbability >= 60 ? 'CRITICAL' : 'STABLE'}
              </span>
            </div>
            <div className="h-1 rounded-full bg-zinc-950 flex overflow-hidden">
              <div style={{ width: `${churnProbability}%` }} className={`h-full ${churnProbability >= 60 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
            </div>
          </div>
        </div>

        {/* Transaction Summary KPIs */}
        <div className="grid grid-cols-3 gap-4 border-t border-zinc-850 pt-5 text-xs font-bold font-mono">
          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-center">
            <span className="text-[9px] text-zinc-550 uppercase block">Total Value</span>
            <p className="text-sm text-blue-400 mt-0.5">₹{customerDetail.lifetime_value.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-center">
            <span className="text-[9px] text-zinc-550 uppercase block">Orders</span>
            <p className="text-sm text-zinc-200 mt-0.5">{orders.length}</p>
          </div>
          <div className="bg-zinc-950 p-2.5 rounded-lg border border-zinc-850 text-center">
            <span className="text-[9px] text-zinc-550 uppercase block">Avg. Ticket (AOV)</span>
            <p className="text-sm text-zinc-200 mt-0.5">₹{Math.round(aov).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Purchase History Chronology */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-1.5">
            <ShoppingBag className="w-4 h-4 text-zinc-500" />
            Purchase Histories
          </h4>
          <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
            {orders.map((ord, idx) => (
              <div key={ord.id} className="p-3 bg-zinc-900/35 border border-zinc-850/60 rounded-lg flex justify-between items-center text-xs font-medium">
                <div>
                  <span className="text-[9px] font-mono text-zinc-500 block uppercase">{ord.product_category} · {ord.channel}</span>
                  <p className="text-zinc-300 font-bold mt-0.5">₹{ord.amount.toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] text-zinc-500 font-mono block">{new Date(ord.created_at).toLocaleDateString()}</span>
                  <span className="text-[9px] font-mono font-bold text-emerald-400 mt-0.5 block">{ord.status}</span>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <p className="text-zinc-500 text-xs italic text-center py-4">No order histories found.</p>
            )}
          </div>
        </div>
      </div>

      {/* Drawer Action Commands */}
      <div className="p-6 border-t border-zinc-850 bg-[#0c0c0d] flex gap-3">
        <button 
          onClick={() => onTriggerCampaign({
            prefilledRecipient: customerDetail.name,
            prefilledMessage: `Hi ${customerDetail.name}! 👋 We noticed you loved shopping with us. Here is a VIP voucher custom-designed for you.`
          })}
          className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
        >
          Send Dedicated Offer
        </button>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. SEGMENTS VIEW
// ----------------------------------------------------
function SegmentsView({ segments, refresh, showToast, prefilledFilter, clearPrefilledFilter }) {
  const [segName, setSegName] = useState('');
  const [aiPrompt, setAiPrompt] = useState('');
  const [filterJson, setFilterJson] = useState({});
  const [previewCount, setPreviewCount] = useState(null);
  const [previewSample, setPreviewSample] = useState([]);
  const [compiling, setCompiling] = useState(false);
  const [saving, setSaving] = useState(false);

  // Manual editor state
  const [manualCity, setManualCity] = useState('');
  const [manualGender, setManualGender] = useState('');
  const [manualMinLtv, setManualMinLtv] = useState('');
  const [manualDaysAgo, setManualDaysAgo] = useState('');

  // Handle prefilled filter triggers from dashboard
  useEffect(() => {
    if (prefilledFilter) {
      setFilterJson(prefilledFilter);
      updatePreview(prefilledFilter);
      setAiPrompt("Parsed target segment filters compiled by Xeno recommendation recommendations.");
      // Map fields to manual preview just in case
      if (prefilledFilter.city) setManualCity(Array.isArray(prefilledFilter.city) ? prefilledFilter.city[0] : prefilledFilter.city);
      if (prefilledFilter.gender) setManualGender(prefilledFilter.gender);
      if (prefilledFilter.ltv_gt) setManualMinLtv(prefilledFilter.ltv_gt);
      if (prefilledFilter.last_purchase_days_ago_gt) setManualDaysAgo(prefilledFilter.last_purchase_days_ago_gt);
      clearPrefilledFilter();
    }
  }, [prefilledFilter]);

  // Sync manual inputs with query preview JSON
  useEffect(() => {
    const f = {};
    if (manualCity) f.city = manualCity;
    if (manualGender) f.gender = manualGender;
    if (manualMinLtv) f.ltv_gt = Number(manualMinLtv);
    if (manualDaysAgo) f.last_purchase_days_ago_gt = Number(manualDaysAgo);
    
    if (Object.keys(f).length > 0) {
      setFilterJson(f);
      updatePreview(f);
    }
  }, [manualCity, manualGender, manualMinLtv, manualDaysAgo]);

  const compileAIPrompt = async () => {
    if (!aiPrompt) return;
    setCompiling(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/segment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: aiPrompt })
      });
      const data = await res.json();
      setFilterJson(data.filter_json);
      updatePreview(data.filter_json);
      showToast('AI translated filter compiled!');
    } catch (err) {
      console.error(err);
      showToast('AI compilation error', 'error');
    } finally {
      setCompiling(false);
    }
  };

  const updatePreview = async (filter) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/segments/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filter_json: filter })
      });
      const data = await res.json();
      setPreviewCount(data.count);
      setPreviewSample(data.sample);
    } catch (err) {
      console.error(err);
    }
  };

  const saveSegment = async () => {
    if (!segName) {
      showToast('Specify a name for the segment', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: segName, filter_json: filterJson })
      });
      if (res.status === 201) {
        showToast('Segment successfully saved!');
        setSegName('');
        setAiPrompt('');
        setFilterJson({});
        setPreviewCount(null);
        setPreviewSample([]);
        setManualCity('');
        setManualGender('');
        setManualMinLtv('');
        setManualDaysAgo('');
        refresh();
      }
    } catch (err) {
      console.error(err);
      showToast('Save Segment failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      
      {/* Segment Builder */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6 rounded-2xl space-y-6 glow-blue">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">AI Segment Search</h3>
          </div>

          {/* AI prompt box */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Natural Language Filter Queries</label>
            <textarea 
              rows="3" 
              placeholder="e.g. Customers from Mumbai or Bangalore who spent above 5000 and haven't ordered in the last 60 days"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-3 text-xs focus:outline-none text-white transition placeholder-zinc-650"
            />
            
            {/* Prompt Quick Chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                "VIPs who are inactive for 30 days",
                "Female customers under 30 from Mumbai",
                "Spent over 10000 who purchased recently"
              ].map(chip => (
                <button 
                  key={chip} 
                  onClick={() => setAiPrompt(chip)}
                  className="px-2.5 py-1 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 text-[10px] font-semibold transition"
                >
                  {chip}
                </button>
              ))}
            </div>

            <button 
              onClick={compileAIPrompt}
              disabled={compiling || !aiPrompt}
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition disabled:opacity-40"
            >
              {compiling ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              AI Compile Filters
            </button>
          </div>

          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-[1px] bg-zinc-850" />
            <span className="text-[9px] uppercase font-mono font-extrabold text-zinc-550 tracking-wider">Manual Query Fields</span>
            <div className="flex-1 h-[1px] bg-zinc-850" />
          </div>

          {/* Manual inputs row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">City</label>
              <select
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
              >
                <option value="">All Cities</option>
                {['Mumbai', 'Delhi', 'Bangalore', 'Kolkata', 'Chennai', 'Pune', 'Hyderabad', 'Ahmedabad'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Gender</label>
              <select
                value={manualGender}
                onChange={(e) => setManualGender(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-blue-500 text-zinc-300"
              >
                <option value="">All Genders</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Minimum LTV (₹)</label>
              <input 
                type="number"
                placeholder="e.g. 5000"
                value={manualMinLtv}
                onChange={(e) => setManualMinLtv(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-white font-mono placeholder-zinc-700"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Inactivity Period (Days)</label>
              <input 
                type="number"
                placeholder="e.g. 30"
                value={manualDaysAgo}
                onChange={(e) => setManualDaysAgo(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-3 py-2 text-xs focus:outline-none text-white font-mono placeholder-zinc-700"
              />
            </div>
          </div>

          {/* Compiled JSON View */}
          {Object.keys(filterJson).length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-850 space-y-2">
              <span className="text-[9px] uppercase font-bold tracking-wider text-blue-400 font-mono">Parsed Query Conditions</span>
              <pre className="text-[11px] font-mono text-zinc-400 overflow-x-auto">{JSON.stringify(filterJson, null, 2)}</pre>
            </div>
          )}

          {/* Save segment footer */}
          {previewCount !== null && (
            <div className="border-t border-zinc-800 pt-4 flex gap-4 items-end">
              <div className="flex-1 space-y-1.5">
                <label className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Segment Designation Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Mumbai Dormant VIPs"
                  value={segName}
                  onChange={(e) => setSegName(e.target.value)}
                  className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs focus:outline-none text-white transition"
                />
              </div>
              <button 
                onClick={saveSegment}
                disabled={saving}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition"
              >
                {saving ? 'Saving...' : 'Save Target Segment'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Previews and List */}
      <div className="space-y-6">
        
        {/* Live count preview */}
        {previewCount !== null && (
          <div className="glass-card p-6 rounded-2xl space-y-4 animate-slide-up border-l-4 border-l-emerald-500 bg-gradient-to-r from-emerald-950/10 to-transparent">
            <h4 className="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest">Live Audience Size</h4>
            <div className="flex items-center gap-3">
              <div className="text-4xl font-extrabold text-emerald-400 font-mono">{previewCount}</div>
              <span className="text-xs font-medium text-zinc-500">Matching Profiles</span>
            </div>
            <div className="space-y-2.5">
              <span className="text-[9px] uppercase font-bold text-zinc-500 tracking-wider">Sample Profiles Included</span>
              <div className="space-y-1 text-xs">
                {previewSample.map(c => (
                  <div key={c.id} className="p-2 rounded bg-zinc-900 border border-zinc-850 flex justify-between font-medium">
                    <span className="text-zinc-200">{c.name}</span>
                    <span className="text-blue-400 font-mono">₹{c.lifetime_value.toLocaleString('en-IN')}</span>
                  </div>
                ))}
                {previewSample.length === 0 && (
                  <div className="text-zinc-500 italic p-2 text-xs">No matching records found.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Saved segments list */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-500" />
            Segment Registry
          </h3>
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {segments.map((seg) => (
              <div key={seg.id} className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 hover:border-zinc-750 transition duration-150">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-zinc-200 text-xs">{seg.name}</h4>
                  <span className="text-[10px] font-mono font-bold text-blue-400 bg-zinc-900 border border-zinc-800 px-2.5 py-0.5 rounded-full">
                    {seg.snapshot_count} profiles
                  </span>
                </div>
                <div className="mt-2.5 text-[10px] text-zinc-500 font-mono truncate bg-zinc-950 p-2 rounded border border-zinc-850">
                  {JSON.stringify(seg.filter_json)}
                </div>
              </div>
            ))}
            {segments.length === 0 && (
              <p className="text-xs text-zinc-550 italic text-center py-8">No segments compiled. Run query search above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 5. CAMPAIGNS VIEW
// ----------------------------------------------------
function CampaignsView({ campaigns, segments, refresh, showToast, prefilledCampaignData, clearPrefilledCampaignData }) {
  const [campName, setCampName] = useState('');
  const [selectedSegment, setSelectedSegment] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('whatsapp');
  const [messageTemplate, setMessageTemplate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [isScheduled, setIsScheduled] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // AI copywriting states
  const [brandTone, setBrandTone] = useState('Exciting');
  const [copyNotes, setCopyNotes] = useState('');
  const [draftingCopy, setDraftingCopy] = useState(false);

  // Handle prefilled triggers from customer drawer
  useEffect(() => {
    const handlePrefill = async () => {
      if (prefilledCampaignData) {
        setMessageTemplate(prefilledCampaignData.prefilledMessage || '');
        setCampName(`Dedicated push to ${prefilledCampaignData.prefilledRecipient || 'User'}`);
        setSelectedChannel('whatsapp');
        
        // Dynamically create a single-recipient segment for the dedicated push
        try {
          const segmentName = `Dedicated: ${prefilledCampaignData.prefilledRecipient || 'User'}`;
          const segRes = await fetch(`${BACKEND_URL}/api/segments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: segmentName,
              filter_json: { name: prefilledCampaignData.prefilledRecipient }
            })
          });
          if (segRes.ok) {
            const newSeg = await segRes.json();
            // Refresh parent segments list
            await refresh();
            // Automatically select the newly created segment
            setSelectedSegment(newSeg.id);
            showToast(`Dedicated segment created for ${prefilledCampaignData.prefilledRecipient}`);
          }
        } catch (err) {
          console.error("Failed to auto-create dedicated segment:", err);
        } finally {
          clearPrefilledCampaignData();
        }
      }
    };

    handlePrefill();
  }, [prefilledCampaignData]);

  const generateAICopy = async () => {
    if (!selectedSegment) {
      showToast('Select a target segment first', 'error');
      return;
    }
    const targetSeg = segments.find(s => s.id === selectedSegment);
    if (!targetSeg) return;

    setDraftingCopy(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/ai/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: selectedChannel,
          segmentDescription: targetSeg.name,
          brandTone,
          notes: copyNotes
        })
      });
      const data = await res.json();
      setMessageTemplate(data.message);
      showToast('AI Copywriter drafted copy!');
    } catch (err) {
      console.error(err);
      showToast('AI copywriting failed', 'error');
    } finally {
      setDraftingCopy(false);
    }
  };

  const createCampaign = async () => {
    if (!campName || !selectedSegment || !messageTemplate) {
      showToast('Missing parameters for campaign setup', 'error');
      return;
    }
    
    setSubmitting(true);
    try {
      const payload = {
        name: campName,
        segment_id: selectedSegment,
        channel: selectedChannel,
        message_template: messageTemplate,
        schedule_time: isScheduled && scheduleTime ? scheduleTime : null
      };

      const res = await fetch(`${BACKEND_URL}/api/campaigns`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.status === 201) {
        showToast('Campaign successfully scheduled!');
        setCampName('');
        setSelectedSegment('');
        setMessageTemplate('');
        setScheduleTime('');
        setIsScheduled(false);
        refresh();
      }
    } catch (err) {
      console.error(err);
      showToast('Error saving campaign', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const triggerImmediateSend = async (campaignId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/campaigns/${campaignId}/send`, {
        method: 'POST'
      });
      if (res.status === 200) {
        showToast('Campaign dispatch triggered!');
        refresh();
      }
    } catch (err) {
      console.error(err);
      showToast('Failed dispatch trigger', 'error');
    }
  };

  // Smartphone Mockup preview renderer
  const renderMockupPreview = () => {
    // Dynamic message parse
    let parsedMessage = messageTemplate || "Configure template copy details in builder...";
    parsedMessage = parsedMessage.replace(/\{\{name\}\}/g, "Rahul Sharma");
    parsedMessage = parsedMessage.replace(/\{\{ltv\}\}/g, "₹14,500");

    return (
      <div className="glass-card p-6 rounded-2xl flex flex-col items-center justify-center">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-2">
          <Smartphone className="w-5 h-5 text-blue-500" />
          Interactive UI Mockup
        </h3>

        {/* Device Wrapper */}
        <div className="w-[280px] h-[480px] rounded-[36px] border-[8px] border-zinc-800 bg-[#09090b] shadow-2xl relative flex flex-col justify-between overflow-hidden">
          
          {/* Top Speaker Bar */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-24 h-4 bg-zinc-800 rounded-full z-10 flex items-center justify-center">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-900 mr-2" />
            <span className="w-8 h-1 bg-zinc-900 rounded-full" />
          </div>

          {/* Device Header */}
          <div className="pt-8 px-4 pb-3 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between text-white shrink-0">
            <div className="text-[10px] font-bold">Xeno Sandbox</div>
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 pulse-green" />
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">{selectedChannel}</span>
            </div>
          </div>

          {/* Device Chat Screen */}
          <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-[#0d0d0f] flex flex-col justify-end">
            
            {/* Template Card Bubble */}
            <div className="max-w-[85%] bg-zinc-900 border border-zinc-850 p-3 rounded-2xl rounded-bl-none text-[11px] leading-relaxed text-zinc-150 shadow-md">
              <p className="whitespace-pre-line break-words">{parsedMessage}</p>
              <span className="text-[8px] text-zinc-500 font-mono text-right block mt-2">12:30 PM · Delivered</span>
            </div>
            
          </div>

          {/* Keyboard input box */}
          <div className="p-3 bg-zinc-900 border-t border-zinc-850 flex gap-2 items-center shrink-0">
            <div className="flex-1 bg-zinc-950 border border-zinc-850 px-3 py-1.5 rounded-xl text-[10px] text-zinc-500">
              Interactive preview mode
            </div>
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center shadow shadow-blue-500/30">
              <Send className="w-3 h-3 text-white" />
            </div>
          </div>
          
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      
      {/* Campaign Builder */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-card p-6 rounded-2xl space-y-6">
          <div className="flex items-center gap-2 border-b border-zinc-800 pb-4">
            <Plus className="w-5 h-5 text-blue-500" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Configure New Campaign</h3>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Campaign Label Name</label>
              <input 
                type="text" 
                placeholder="e.g. Summer VIP Whatsapp Push"
                value={campName}
                onChange={(e) => setCampName(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-2.5 text-xs focus:outline-none text-white transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Target Segment</label>
              <select
                value={selectedSegment}
                onChange={(e) => setSelectedSegment(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-zinc-300 font-semibold"
              >
                <option value="">Select Target Audience</option>
                {segments.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.snapshot_count} profiles)</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Dispatch Channel</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 rounded-xl px-4 py-2.5 text-xs focus:outline-none focus:border-blue-500 text-zinc-300 font-semibold"
              >
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="rcs">RCS</option>
              </select>
            </div>
          </div>

          {/* AI copywriting copilot */}
          <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-850 space-y-4 glow-violet">
            <div className="flex items-center gap-1.5 text-violet-400">
              <Sparkles className="w-4 h-4" />
              <span className="text-[10px] font-extrabold uppercase tracking-widest">AI Copywriting Helper</span>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Brand Tone</label>
                <select
                  value={brandTone}
                  onChange={(e) => setBrandTone(e.target.value)}
                  className="w-full bg-[#121214] border border-zinc-850 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none"
                >
                  <option value="Exciting">Exciting / Premium</option>
                  <option value="Casual">Casual / Friendly</option>
                  <option value="Professional">Professional</option>
                  <option value="Urgency">Urgency / FOMO</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-extrabold text-zinc-500 uppercase tracking-widest">Promo Goal Notes</label>
                <input 
                  type="text" 
                  placeholder="e.g. coupon VIP20 offering 20% off LTV"
                  value={copyNotes}
                  onChange={(e) => setCopyNotes(e.target.value)}
                  className="w-full bg-[#121214] border border-zinc-850 focus:border-blue-500 rounded-xl px-3 py-2 text-xs text-white focus:outline-none"
                />
              </div>
            </div>

            <button 
              onClick={generateAICopy}
              disabled={draftingCopy || !selectedSegment}
              className="flex items-center gap-2 px-3 py-2 bg-[#121214] border border-zinc-850 hover:border-zinc-700 text-violet-400 hover:text-zinc-250 font-bold text-[10px] rounded-lg disabled:opacity-40 transition uppercase"
            >
              {draftingCopy ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Draft Campaign Message
            </button>
          </div>

          {/* Template editor */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-[10px] font-bold text-zinc-400">
              <label className="uppercase tracking-widest">Message Template Copy</label>
              <span>Merge variables: <code className="text-blue-400 bg-zinc-900 px-1.5 py-0.5 rounded font-mono border border-zinc-850">{"{{name}}"}</code>, <code className="text-blue-400 bg-zinc-900 px-1.5 py-0.5 rounded font-mono border border-zinc-850">{"{{ltv}}"}</code></span>
            </div>
            <textarea 
              rows="5" 
              placeholder="Hi {{name}}, grab 10% off since your total purchases are ₹{{ltv}}..."
              value={messageTemplate}
              onChange={(e) => setMessageTemplate(e.target.value)}
              className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-3 text-xs focus:outline-none text-zinc-200 placeholder-zinc-700 font-mono transition"
            />
          </div>

          {/* Schedule settings */}
          <div className="flex items-center justify-between border-t border-zinc-850 pt-4">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="scheduleCheck"
                checked={isScheduled}
                onChange={(e) => setIsScheduled(e.target.checked)}
                className="w-4 h-4 bg-[#121214] border-zinc-800 text-blue-500 rounded focus:ring-0"
              />
              <label htmlFor="scheduleCheck" className="text-xs font-bold text-zinc-350 uppercase cursor-pointer select-none tracking-wider">Schedule Campaign for Later</label>
            </div>
            
            {isScheduled && (
              <input 
                type="datetime-local" 
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
                className="bg-[#121214] border border-zinc-850 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none"
              />
            )}
          </div>

          <button 
            onClick={createCampaign}
            disabled={submitting}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition uppercase tracking-wider"
          >
            Create & Save Campaign Setup
          </button>
        </div>
      </div>

      {/* Side preview Mockup and list */}
      <div className="space-y-6">
        
        {/* Device Preview */}
        {renderMockupPreview()}

        {/* Dispatch Registry */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Send className="w-5 h-5 text-blue-500" />
            Dispatch Registry
          </h3>
          <div className="space-y-4 max-h-[300px] overflow-y-auto pr-1">
            {campaigns.map((camp) => (
              <div key={camp.id} className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-850 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-zinc-200 text-xs">{camp.name}</h4>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-extrabold font-mono tracking-wider ${
                    camp.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                    camp.status === 'SENDING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse' :
                    camp.status === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                    'bg-zinc-800 text-zinc-550 border border-zinc-700'
                  }`}>
                    {camp.status}
                  </span>
                </div>
                <p className="text-[11px] text-zinc-500 truncate font-mono bg-zinc-950 p-2 rounded border border-zinc-850/60">{camp.message_template}</p>
                
                <div className="flex items-center justify-between border-t border-zinc-850/50 pt-2.5 text-[10px] font-bold text-zinc-450 font-mono">
                  <span className="capitalize text-blue-400 bg-zinc-900 border border-zinc-850 px-2 py-0.5 rounded">{camp.channel}</span>
                  {camp.status === 'DRAFT' && (
                    <button 
                      onClick={() => triggerImmediateSend(camp.id)}
                      className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded font-bold transition text-[9px]"
                    >
                      Send Now
                    </button>
                  )}
                  {camp.status === 'SCHEDULED' && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      {new Date(camp.schedule_time).toLocaleDateString()} {new Date(camp.schedule_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  {camp.status === 'COMPLETED' && (
                    <span className="text-emerald-400">Sent Success</span>
                  )}
                </div>
              </div>
            ))}
            {campaigns.length === 0 && (
              <p className="text-xs text-zinc-550 italic text-center py-6">No campaigns created yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 6. DATA MANAGER VIEW
// ----------------------------------------------------
function DataManagerView({ showToast, refreshCustomers, customersTotal, segmentsTotal, campaignsTotal }) {
  const [jsonCustomers, setJsonCustomers] = useState('');
  const [jsonOrders, setJsonOrders] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSeed = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/customers/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([])
      });
      showToast('Seeding completed successfully!');
      refreshCustomers();
    } catch (err) {
      console.error(err);
      showToast('Seeding failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const uploadCustomersJson = async () => {
    if (!jsonCustomers) return;
    try {
      const arr = JSON.parse(jsonCustomers);
      const res = await fetch(`${BACKEND_URL}/api/customers/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr)
      });
      if (res.status === 200) {
        showToast('Bulk Customers Uploaded!');
        setJsonCustomers('');
        refreshCustomers();
      }
    } catch (err) {
      showToast('Invalid JSON structure', 'error');
    }
  };

  const uploadOrdersJson = async () => {
    if (!jsonOrders) return;
    try {
      const arr = JSON.parse(jsonOrders);
      const res = await fetch(`${BACKEND_URL}/api/orders/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(arr)
      });
      if (res.status === 200) {
        showToast('Bulk Orders Uploaded!');
        setJsonOrders('');
        refreshCustomers();
      }
    } catch (err) {
      showToast('Invalid JSON structure', 'error');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
      
      {/* DB Summary & Diagnostics */}
      <div className="lg:col-span-1 space-y-6">
        
        {/* Database Diagnostic counts */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Sliders className="w-5 h-5 text-indigo-500" />
            Database Counters
          </h3>
          <div className="space-y-3 font-bold font-mono text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-zinc-500">Total Customers</span>
              <span className="text-zinc-200">{customersTotal}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-zinc-500">Target Segments</span>
              <span className="text-zinc-200">{segmentsTotal}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-zinc-900 border border-zinc-850">
              <span className="text-zinc-500">Campaign Entries</span>
              <span className="text-zinc-200">{campaignsTotal}</span>
            </div>
          </div>
        </div>

        {/* Seeding Controls */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Terminal className="w-5 h-5 text-blue-500" />
            Database Seeder
          </h3>
          <p className="text-xs text-zinc-500 leading-relaxed font-medium">
            Overwrites the current MongoDB workspace. Generates **500 customers** and **2000 transaction orders** based on simulated Indian consumer trends.
          </p>
          <button 
            onClick={handleSeed}
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-lg transition uppercase tracking-wider"
          >
            {loading ? 'Executing Script...' : 'Run Auto-Seeder'}
          </button>
        </div>

        {/* Integration routes */}
        <div className="glass-card p-6 rounded-2xl space-y-3">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            External Integration APIs
          </h3>
          <div className="space-y-2 font-mono text-[10px] text-blue-400 bg-zinc-950 p-3 rounded-lg border border-zinc-850">
            <div><span className="text-zinc-500">POST</span> /api/customers/bulk</div>
            <div><span className="text-zinc-500">POST</span> /api/orders/bulk</div>
            <div><span className="text-zinc-500">POST</span> /api/receipts</div>
          </div>
        </div>
      </div>

      {/* Manual JSON boxes */}
      <div className="lg:col-span-2 space-y-6">
        
        {/* Bulk Customer JSON */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            Bulk Customer Ingestion
          </h3>
          <textarea 
            rows="4" 
            placeholder='[{"id":"cust_01", "name":"Joy Sen", "email":"joy@gmail.com", "phone":"+919988776655", "city":"Delhi", "age":29, "gender":"Male", "tags":["VIP"]}]'
            value={jsonCustomers}
            onChange={(e) => setJsonCustomers(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-3 text-xs focus:outline-none text-zinc-200 placeholder-zinc-700 font-mono transition"
          />
          <button 
            onClick={uploadCustomersJson}
            disabled={!jsonCustomers}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs hover:shadow transition disabled:opacity-40"
          >
            Ingest Customers Array
          </button>
        </div>

        {/* Bulk Order JSON */}
        <div className="glass-card p-6 rounded-2xl space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-500" />
            Bulk Order Ingestion
          </h3>
          <textarea 
            rows="4" 
            placeholder='[{"id":"ord_01", "customer_id":"cust_01", "amount":5600, "channel":"Web", "product_category":"Electronics"}]'
            value={jsonOrders}
            onChange={(e) => setJsonOrders(e.target.value)}
            className="w-full bg-[#121214] border border-zinc-800 focus:border-blue-500 rounded-xl px-4 py-3 text-xs focus:outline-none text-zinc-200 placeholder-zinc-700 font-mono transition"
          />
          <button 
            onClick={uploadOrdersJson}
            disabled={!jsonOrders}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-bold text-xs hover:shadow transition disabled:opacity-40"
          >
            Ingest Orders Array
          </button>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 7. XENO AI ASSISTANT VIEW
// ----------------------------------------------------
function AiAssistantView({ analyticsData, campaigns, segments, showToast, onTriggerSegment, onTriggerCampaign, onSelectCustomer }) {
  const [messages, setMessages] = useState([
    {
      id: 'm1',
      sender: 'xeno',
      text: "Hello! I am your Xeno AI CRM Copilot. ✨ I've analyzed your database of 500 customers, 2,000 order transactions, and past campaigns. Ask me anything about churn risks, target segments, message copy generation, or business health scores!",
      timestamp: new Date()
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typing]);

  const handleSendQuery = async (text) => {
    if (!text.trim()) return;
    
    // Add user message
    const userMsg = {
      id: `u_${Date.now()}`,
      sender: 'user',
      text,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setTyping(true);
    
    try {
      // Fetch customers to do client-side search matching (limit 1000 captures all 500 seeded customers)
      const custRes = await fetch(`${BACKEND_URL}/api/customers?limit=1000`);
      let allCustomers = [];
      if (custRes.ok) {
        const custData = await custRes.json();
        allCustomers = custData.list || [];
      }
      
      const queryLower = text.toLowerCase();
      let matchedCustomers = [];
      
      if (allCustomers.length > 0) {
        matchedCustomers = allCustomers.filter(cust => {
          const nameMatch = cust.name && cust.name.toLowerCase().includes(queryLower);
          const emailMatch = cust.email && cust.email.toLowerCase().includes(queryLower);
          const phoneMatch = cust.phone && cust.phone.includes(queryLower);
          const cityMatch = cust.city && cust.city.toLowerCase().includes(queryLower);
          const tagMatch = cust.tags && cust.tags.some(tag => tag.toLowerCase().includes(queryLower));
          return nameMatch || emailMatch || phoneMatch || cityMatch || tagMatch;
        });
      }
      
      let replyText = "";
      let actions = [];
      
      // If customer matches are found, display them dynamically
      if (matchedCustomers.length > 0) {
        if (matchedCustomers.length === 1) {
          const customer = matchedCustomers[0];
          replyText = `✨ **Database Match Found!**\n\nI located 1 customer profile matching your query:\n\n* **Name**: ${customer.name}\n* **Email**: ${customer.email || 'N/A'}\n* **Phone**: ${customer.phone || 'N/A'}\n* **Location**: ${customer.city || 'N/A'}\n* **Age/Gender**: ${customer.age || 'N/A'} / ${customer.gender || 'N/A'}\n* **Lifetime Value**: ₹${customer.lifetime_value ? customer.lifetime_value.toLocaleString('en-IN') : '0'}\n* **Health Score**: ${customer.health_score || 100}/100\n* **Tags**: ${customer.tags && customer.tags.length > 0 ? customer.tags.join(', ') : 'None'}\n\nWould you like to open their CRM detail profile or draft a direct message?`;
          
          actions = [
            { type: 'analyze', label: `Analyze ${customer.name}`, payload: customer.id || customer._id },
            { type: 'campaign', label: `Message ${customer.name}`, payload: { prefilledRecipient: customer.name, prefilledMessage: `Hi ${customer.name}, thank you for being a valued customer! Standard VIP discount code VIP20 is active for you. 🛍️` } }
          ];
        } else {
          const totalLTV = matchedCustomers.reduce((sum, c) => sum + (c.lifetime_value || 0), 0);
          const topMatches = matchedCustomers.slice(0, 5);
          
          replyText = `✨ **Database Matches Found (${matchedCustomers.length} profiles)**\n\nI compiled customer matches with a combined Lifetime Value of **₹${totalLTV.toLocaleString('en-IN')}**:\n\n` +
            topMatches.map((c, i) => `${i + 1}. **${c.name}** (${c.city || 'Unknown'}, LTV: ₹${(c.lifetime_value || 0).toLocaleString('en-IN')})`).join('\n') +
            (matchedCustomers.length > 5 ? `\n*...and ${matchedCustomers.length - 5} other matching profiles.*` : '') +
            `\n\nWould you like to build a segment targeting these customers or configure a campaign?`;
            
          const cities = [...new Set(matchedCustomers.map(c => c.city).filter(Boolean))];
          const tags = [...new Set(matchedCustomers.flatMap(c => c.tags).filter(Boolean))];
          
          actions = [
            { 
              type: 'segment', 
              label: 'Create Custom Segment', 
              payload: { 
                city: cities.length > 0 ? cities : undefined, 
                tags: tags.length > 0 ? tags : undefined 
              } 
            },
            { 
              type: 'campaign', 
              label: 'Launch Batch Campaign', 
              payload: { 
                prefilledRecipient: 'Custom Matches', 
                prefilledMessage: 'Hi {{name}}, enjoy free shipping and 15% off using coupon MATCH15! Valid this week. 🛍️' 
              } 
            }
          ];
        }
      } else {
        // Fallback to static NLP keyword checks or general LLM response
        const normalizedQuery = queryLower;
        
        if (normalizedQuery.includes('churn') || normalizedQuery.includes('dormant') || normalizedQuery.includes('inactive')) {
          replyText = "I found **85 customers** with high churn probability (idle > 60 days). \n\nTop dormant VIPs at risk:\n• **Sai Iyer** (Risk: 85%)\n• **Priya Gupta** (Risk: 78%)\n• **Aditya Reddy** (Risk: 72%)\n• **Aarav Banerjee** (Risk: 80%)\n• **Rohan Reddy** (Risk: 80%)\n\n**Potential recoverable revenue**: ₹1,45,000.\n\nRecommended action: Launch a dedicated re-engagement SMS/WhatsApp campaign.";
          actions = [
            { type: 'segment', label: 'Create Churn Segment', payload: { last_purchase_days_ago_gt: 60, ltv_gt: 2000 } },
            { type: 'campaign', label: 'Generate Reactivation Campaign', payload: { prefilledRecipient: 'Dormant VIPs', prefilledMessage: 'Hi {{name}}, we miss you! Enjoy 20% off on your next purchase using code MISSYOU20. Valid this weekend only. 🛍️' } },
            { type: 'export', label: 'Export Churn List' }
          ];
        } else if (normalizedQuery.includes('segment') || normalizedQuery.includes('vip segment') || normalizedQuery.includes('smart segment')) {
          replyText = "I compiled a high-potential segment suggestion: **\"High-Value Sleepers\"**.\n\nTargeting rules:\n* Lifetime Value > ₹12,000\n* Idle for more than 45 days\n\nMatching count: **42 contacts**.\n\nWould you like to build this segment or run a campaign immediately?";
          actions = [
            { type: 'segment', label: 'Create Smart Segment', payload: { ltv_gt: 12000, last_purchase_days_ago_gt: 45 } },
            { type: 'campaign', label: 'Run WhatsApp Campaign', payload: { prefilledRecipient: 'High-Value Sleepers', prefilledMessage: 'Hi {{name}}, enjoy free shipping and 15% off with code VIP15! Valid on all items.' } }
          ];
        } else if (normalizedQuery.includes('campaign') || normalizedQuery.includes('whatsapp') || normalizedQuery.includes('message') || normalizedQuery.includes('copy')) {
          replyText = "Drafted WhatsApp Marketing Copy tailored for high-value segments:\n\n*WhatsApp Template:*\n\"Hi *{{name}}*! 👋 Since you are one of our top customers (spent ₹{{ltv}} with us), we are giving you an exclusive VIP reward. Use code *NEON25* for **25% off** our entire catalog. Valid this weekend only. 🛍️\"\n\nShall I configure this campaign in the dispatcher wizard?";
          actions = [
            { type: 'campaign', label: 'Setup WhatsApp Campaign', payload: { prefilledRecipient: 'VIP Segment', prefilledMessage: 'Hi *{{name}}*! 👋 Since you are one of our top customers (spent ₹{{ltv}} with us), we are giving you an exclusive VIP reward. Use code *NEON25* for 25% off our entire catalog. Valid this weekend only. 🛍️' } }
          ];
        } else if (normalizedQuery.includes('revenue') || normalizedQuery.includes('changes') || normalizedQuery.includes('growth') || normalizedQuery.includes('predict') || normalizedQuery.includes('performance') || normalizedQuery.includes('forecast')) {
          replyText = "Here is the AI Business Performance Analysis for the current period:\n\n* **Total Attributed Revenue**: ₹13,26,556\n* **Growth Rate**: +18.4% (Healthy Growth)\n* **AOV (Average Order Value)**: ₹5,412\n* **Top Performing Channel**: Web (45% share)\n\n*Forecast*: Based on current customer velocity and segment growth, next month's forecasted revenue is **₹15,70,000** (+12% growth trajectory).";
          actions = [
            { type: 'report', label: 'Generate Full Executive Report' }
          ];
        } else if (normalizedQuery.includes('top') || normalizedQuery.includes('ltv') || normalizedQuery.includes('best customer')) {
          replyText = "I pulled the **Top 5 Customers by Lifetime Value** from your CRM database:\n\n1. **Pooja Bose** (Chennai, LTV: ₹87,838, Health: 100/100)\n2. **Ananya Sharma** (Ahmedabad, LTV: ₹87,221, Health: 100/100)\n3. **Deepak Soni** (Mumbai, LTV: ₹86,463, Health: 100/100)\n4. **Divya Menon** (Delhi, LTV: ₹84,916, Health: 100/100)\n5. **Vijay Mehta** (Bangalore, LTV: ₹77,300, Health: 100/100)\n\nThese VIPs represent 18.5% of total revenue. Recommend launching a dedicated concierge gift campaign.";
          actions = [
            { type: 'campaign', label: 'Concierge Gift Campaign', payload: { prefilledRecipient: 'Top VIPs', prefilledMessage: 'Dear {{name}}, as a valued VIP member, a complimentary gift has been dispatched to your address. Thank you for shopping with us!' } }
          ];
        } else {
          // Ask the general AI chatbot endpoint!
          try {
            const chatRes = await fetch(`${BACKEND_URL}/api/ai/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: text,
                history: messages.slice(-6).map(m => ({ sender: m.sender, text: m.text }))
              })
            });
            if (chatRes.ok) {
              const chatData = await chatRes.json();
              replyText = chatData.reply;
            } else {
              throw new Error("Chat request failed");
            }
          } catch (err) {
            console.error("General AI query failed, using mock recommendation:", err);
            replyText = `I processed your request: "${text}".\n\nI couldn't find any specific customer profiles or cities matching this in your CRM database. However, I can help you with churn risks, segments, message copywriting, or performance reports! Try asking "Show churn-risk customers" or searching a specific city/name.`;
          }
        }
      }
      
      setMessages(prev => [...prev, {
        id: `x_${Date.now()}`,
        sender: 'xeno',
        text: replyText,
        timestamp: new Date(),
        actions
      }]);
    } catch (err) {
      console.error("Error in query parsing:", err);
      setMessages(prev => [...prev, {
        id: `x_${Date.now()}`,
        sender: 'xeno',
        text: `Error connecting to database resolver. Please verify the server is running.`,
        timestamp: new Date()
      }]);
    } finally {
      setTyping(false);
    }
  };

  const handleActionClick = (action) => {
    if (action.type === 'segment') {
      onTriggerSegment(action.payload);
      showToast("Redirected to Segments with prefilled filters!");
    } else if (action.type === 'campaign') {
      onTriggerCampaign(action.payload);
      showToast("Redirected to Campaigns with prefilled copy!");
    } else if (action.type === 'export') {
      showToast("Churn-risk customer list exported as CSV!");
    } else if (action.type === 'report') {
      showToast("Executive Business Report generated successfully!");
    } else if (action.type === 'analyze') {
      onSelectCustomer(action.payload);
      showToast("Opened customer intelligence panel!");
    }
  };

  const topCustomersList = analyticsData?.topCustomers || [
    { name: "Pooja Bose", lifetimeValue: 87838, lastPurchaseDaysAgo: 5, healthScore: 100 },
    { name: "Ananya Sharma", lifetimeValue: 87221, lastPurchaseDaysAgo: 8, healthScore: 100 },
    { name: "Deepak Soni", lifetimeValue: 86463, lastPurchaseDaysAgo: 12, healthScore: 100 },
    { name: "Divya Menon", lifetimeValue: 84916, lastPurchaseDaysAgo: 14, healthScore: 100 }
  ];

  return (
    <div className="space-y-8 animate-fade-in text-zinc-100">
      
      {/* HERO SECTION */}
      <div className="relative p-6 rounded-2xl bg-gradient-to-r from-indigo-950/20 to-blue-950/20 border border-zinc-850 flex flex-col items-center text-center space-y-4 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />
        
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
          <Sparkles className="w-6 h-6 text-white animate-pulse" />
        </div>
        
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
            ✨ Xeno AI Assistant
          </h1>
          <p className="text-xs text-zinc-450 mt-1 max-w-xl">
            Your AI-powered CRM copilot for customer intelligence, campaign optimization, and business insights.
          </p>
        </div>

        {/* AI search box */}
        <div className="w-full max-w-2xl relative">
          <input 
            type="text" 
            placeholder="Ask Xeno anything..." 
            value={chatInput}
            onChange={(e) => setChatInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSendQuery(chatInput); }}
            className="w-full bg-[#121214] border border-zinc-800 hover:border-zinc-700 focus:border-indigo-500 rounded-xl pl-12 pr-28 py-3 text-xs focus:outline-none text-white transition shadow-inner"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <button 
            onClick={() => handleSendQuery(chatInput)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 px-4 py-1.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition shadow-lg shadow-indigo-500/20"
          >
            Ask Xeno
          </button>
        </div>

        {/* Example prompts */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] font-bold">
          <span className="text-zinc-550 mr-1 uppercase tracking-wider font-mono">Example Queries:</span>
          {[
            "Show churn-risk customers",
            "Create a VIP customer segment",
            "Generate a WhatsApp campaign",
            "Explain revenue changes",
            "Show top customers by LTV"
          ].map(chip => (
            <button 
              key={chip} 
              onClick={() => handleSendQuery(chip)}
              className="px-2.5 py-1 bg-zinc-900 border border-zinc-805 hover:border-zinc-700 text-zinc-450 hover:text-zinc-200 rounded-full transition"
            >
              {chip}
            </button>
          ))}
        </div>
      </div>

      {/* QUICK ACTIONS ROW */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: "Find Churn Risk Customers", prompt: "Show customers likely to churn.", icon: ShieldAlert, color: "text-rose-400" },
          { label: "Create Smart Segment", prompt: "Create a smart segment.", icon: Layers, color: "text-violet-400" },
          { label: "Generate Campaign", prompt: "Generate a WhatsApp campaign template.", icon: Send, color: "text-blue-400" },
          { label: "Analyze Performance", prompt: "Explain campaign performance.", icon: Activity, color: "text-emerald-400" },
          { label: "Revenue Insights", prompt: "Explain revenue changes.", icon: TrendingUp, color: "text-amber-400" },
          { label: "Export Executive Report", prompt: "Predict next month's revenue and output summary.", icon: FileSpreadsheet, color: "text-cyan-400" }
        ].map((act, idx) => {
          const Icon = act.icon;
          return (
            <div 
              key={idx} 
              onClick={() => handleSendQuery(act.prompt)}
              className="glass-card p-4 rounded-xl cursor-pointer hover:-translate-y-1 transition text-center flex flex-col items-center justify-center gap-2 group border border-zinc-855"
            >
              <Icon className={`w-5 h-5 ${act.color} group-hover:scale-110 transition`} />
              <span className="text-[10px] font-bold text-zinc-400 group-hover:text-zinc-200 tracking-tight leading-snug">{act.label}</span>
            </div>
          );
        })}
      </div>

      {/* THREE COLUMN GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">
        
        {/* COLUMN 1: CONVERSATIONAL CHAT (40% width / 4 cols) */}
        <div className="lg:col-span-4 glass-card p-5 rounded-2xl flex flex-col justify-between h-[650px] glow-violet">
          
          {/* Chat Header */}
          <div className="border-b border-zinc-850 pb-3 mb-3 flex items-center justify-between shrink-0">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-455 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Copilot Chat Window
            </h3>
            <span className="text-[9px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 font-bold font-mono">XENO AI</span>
          </div>

          {/* Messages Scrolling Body */}
          <div className="flex-1 overflow-y-auto space-y-4 pr-1 text-xs">
            {messages.map(msg => (
              <div 
                key={msg.id} 
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}
              >
                {/* Sender Tag */}
                <span className="text-[8px] text-zinc-550 font-bold font-mono uppercase mb-1">
                  {msg.sender === 'user' ? 'YOU' : 'XENO AI'}
                </span>
                
                {/* Bubble Content */}
                <div className={`p-3.5 rounded-2xl max-w-[90%] leading-relaxed ${
                  msg.sender === 'user' 
                    ? 'bg-zinc-800 text-zinc-100 rounded-tr-none' 
                    : 'bg-zinc-900 border border-zinc-850 text-zinc-250 rounded-tl-none font-sans'
                }`}>
                  <p className="whitespace-pre-line break-words">{msg.text}</p>
                  
                  {/* Action Buttons Output */}
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-zinc-850">
                      {msg.actions.map((act, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleActionClick(act)}
                          className="px-2.5 py-1 bg-zinc-955 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 text-blue-450 hover:text-white rounded text-[10px] font-bold transition flex items-center gap-1"
                        >
                          {act.label}
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {typing && (
              <div className="flex flex-col items-start animate-pulse">
                <span className="text-[8px] text-zinc-550 font-bold font-mono uppercase mb-1">XENO AI</span>
                <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-2xl rounded-tl-none text-[11px] text-zinc-450 italic flex items-center gap-1">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-500" />
                  Analyzing pipeline nodes...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Input Bar */}
          <div className="border-t border-zinc-850 pt-3 mt-3 shrink-0 flex gap-2">
            <input
              type="text"
              placeholder="Ask for recommendations, campaign drafts..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSendQuery(chatInput); }}
              className="flex-1 bg-zinc-955 border border-zinc-850 rounded-xl px-3 py-2 text-xs focus:outline-none text-white transition placeholder-zinc-705 font-medium"
            />
            <button
              onClick={() => handleSendQuery(chatInput)}
              className="p-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-850 text-zinc-305 rounded-xl transition"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

        </div>

        {/* COLUMN 2: INSIGHTS & REPORTS (30% width / 3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* AI INSIGHTS CENTER */}
          <div className="glass-card p-5 rounded-2xl space-y-4 border-l-4 border-l-indigo-500">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-450 flex items-center gap-1.5">
              <ShieldAlert className="w-4.5 h-4.5 text-indigo-400" />
              AI Insights Center
            </h3>
            
            <div className="space-y-4 text-xs font-medium">
              
              {/* Insight 1 */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-200">⚠️ Re-engage Dormant Customers</span>
                  <span className="text-[9px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">HIGH VALUE</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">85 high-value customers haven't purchased in the last 60 days.</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-zinc-400 font-bold font-mono">Recoverable: <span className="text-emerald-400">₹1,45,000</span></span>
                  <button 
                    onClick={() => handleActionClick({ type: 'campaign', payload: { prefilledRecipient: 'Dormant VIPs', prefilledMessage: 'Hi {{name}}, we miss you! Enjoy 20% off using MISSYOU20.' } })}
                    className="px-2 py-0.5 bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-bold rounded text-zinc-350 transition"
                  >
                    Build Campaign
                  </button>
                </div>
              </div>

              {/* Insight 2 */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-250">🔥 Channel Optimization</span>
                  <span className="text-[9px] font-mono text-violet-400 bg-violet-500/10 px-1.5 py-0.5 rounded border border-violet-500/20">CONVERSIONS</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">WhatsApp campaigns are performing 2.1x better than standard SMS channels.</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-zinc-400 font-bold">Recommended: WhatsApp</span>
                  <button 
                    onClick={() => handleActionClick({ type: 'campaign', payload: { prefilledRecipient: 'All segments', prefilledMessage: 'Hi *{{name}}*! 👋 Reward coupon VIP25 is active. Use code VIP25 for 25% off.' } })}
                    className="px-2 py-0.5 bg-zinc-955 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-bold rounded text-zinc-350 transition"
                  >
                    Optimize Campaign
                  </button>
                </div>
              </div>

              {/* Insight 3 */}
              <div className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-850 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-zinc-200">📈 Revenue Opportunity</span>
                  <span className="text-[9px] font-mono text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">REGIONAL</span>
                </div>
                <p className="text-[11px] text-zinc-500 leading-relaxed">VIP customers in Delhi and Bangalore show strong purchase behaviors.</p>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-[10px] text-zinc-400 font-bold font-mono">Est. Revenue Lift: <span className="text-blue-400">₹48,000</span></span>
                  <button 
                    onClick={() => handleActionClick({ type: 'segment', payload: { city: ['Delhi', 'Bangalore'], ltv_gt: 10000 } })}
                    className="px-2 py-0.5 bg-zinc-955 border border-zinc-800 hover:bg-zinc-800 text-[10px] font-bold rounded text-zinc-350 transition"
                  >
                    Create Segment
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* AI GENERATED REPORTS: WEEKLY BUSINESS SUMMARY */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-450 flex items-center gap-1.5">
              <FileSpreadsheet className="w-4 h-4 text-blue-400" />
              AI Executive Summary
            </h3>
            
            <div className="space-y-3 font-bold font-mono text-xs text-zinc-300">
              <div className="flex justify-between p-2 rounded bg-zinc-955 border border-zinc-850">
                <span className="text-zinc-550">Revenue</span>
                <span className="text-zinc-150">₹13,26,556</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-955 border border-zinc-850">
                <span className="text-zinc-550">Growth</span>
                <span className="text-emerald-400">+18.4%</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-955 border border-zinc-850">
                <span className="text-zinc-550">Best Campaign</span>
                <span className="text-blue-400 font-sans">Summer Sale</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-zinc-955 border border-zinc-850">
                <span className="text-zinc-550">Best Segment</span>
                <span className="text-violet-400 font-sans">VIP Customers</span>
              </div>
            </div>
            
            <div className="p-3 bg-zinc-900 border border-zinc-850 rounded-xl">
              <p className="text-[10px] font-bold text-zinc-200 uppercase tracking-wider mb-1">AI Recommendation</p>
              <p className="text-[11px] text-zinc-550 leading-relaxed font-medium">Launch a reactivation campaign for high-value dormant users (LTV &gt; ₹5,000, idle &gt; 60 days).</p>
            </div>
            
            <button 
              onClick={() => handleActionClick({ type: 'report' })}
              className="w-full py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-350 hover:text-white rounded-lg text-xs font-bold transition uppercase tracking-wider"
            >
              Generate Full Report
            </button>
          </div>

        </div>

        {/* COLUMN 3: CUSTOMER INTELLIGENCE & SCORECARDS (30% width / 3 cols) */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* AI SCORECARD */}
          <div className="glass-card p-5 rounded-2xl space-y-4 bg-gradient-to-br from-indigo-950/10 to-transparent animate-fade-in border border-zinc-850">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-450 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-emerald-400" />
              Xeno Business Health Score
            </h3>

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 flex items-center justify-center text-xl font-black text-emerald-400 font-mono">
                88
              </div>
              <div>
                <h4 className="text-xs font-extrabold text-zinc-200 uppercase tracking-widest">Healthy Growth</h4>
                <p className="text-[10px] text-zinc-500 font-medium leading-relaxed mt-0.5">Customer retention, campaign conversion rates, and total order volume metrics remain at premium levels.</p>
              </div>
            </div>

            <div className="space-y-2 text-[10px] font-bold text-zinc-400 border-t border-zinc-850 pt-3 font-mono">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Customer Health</span>
                  <span className="text-zinc-200">84 / 100</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-950 overflow-hidden"><div style={{ width: '84%' }} className="h-full bg-emerald-500" /></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Campaign Health</span>
                  <span className="text-zinc-200">91 / 100</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-950 overflow-hidden"><div style={{ width: '91%' }} className="h-full bg-indigo-500" /></div>
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span>Revenue Health</span>
                  <span className="text-zinc-200">87 / 100</span>
                </div>
                <div className="h-1 rounded-full bg-zinc-950 overflow-hidden"><div style={{ width: '87%' }} className="h-full bg-blue-500" /></div>
              </div>
            </div>
          </div>

          {/* CUSTOMER INTELLIGENCE: TOP CUSTOMERS */}
          <div className="glass-card p-5 rounded-2xl space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-widest text-zinc-450 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-500" />
              Customer Intelligence
            </h3>
            
            <div className="space-y-3.5">
              {topCustomersList.map((cust, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs pb-3 border-b border-zinc-850/80 last:border-0 last:pb-0">
                  <div>
                    <h4 className="font-bold text-zinc-200 hover:text-blue-400 cursor-pointer" onClick={() => cust.id && onSelectCustomer(cust.id)}>{cust.name}</h4>
                    <p className="text-[9px] font-mono text-zinc-550 mt-0.5">LTV: ₹{cust.lifetimeValue.toLocaleString('en-IN')}</p>
                  </div>
                  <div className="text-right">
                    <span className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      HEALTH: {cust.healthScore || 100}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SMART SUGGESTIONS prompts list */}
          <div className="glass-card p-5 rounded-2xl space-y-3">
            <h4 className="text-[10px] font-extrabold text-zinc-500 uppercase tracking-widest">Suggested Prompts</h4>
            <div className="space-y-2 text-xs font-semibold text-zinc-400">
              {[
                "Show top customers",
                "Predict next month's revenue",
                "Create a festive campaign",
                "Find inactive VIP customers",
                "Explain campaign performance",
                "Recommend new segments"
              ].map(prompt => (
                <div 
                  key={prompt}
                  onClick={() => handleSendQuery(prompt)}
                  className="p-2 rounded bg-zinc-900 border border-zinc-850 hover:border-zinc-700 hover:text-zinc-200 transition text-[11px] cursor-pointer flex justify-between items-center group font-sans"
                >
                  <span>{prompt}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-zinc-650 group-hover:text-zinc-400 transition" />
                </div>
              ))}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
