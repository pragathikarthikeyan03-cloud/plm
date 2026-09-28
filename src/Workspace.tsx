import { createContext, useContext, useState, type FormEvent, type ReactNode } from 'react'
import {
  BrowserRouter,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from 'react-router-dom'
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowLeft,
  Bell,
  Boxes,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Clock3,
  Cpu,
  Gauge,
  LayoutDashboard,
  Menu,
  Moon,
  Network,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sun,
  Wrench,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { initialAlerts, initialPredictions, initialTools, trendData } from './data/demo'
import { predictTool, testWindchillConnection } from './services/api'
import type {
  AlertRecord,
  AlertStatus,
  MachiningParameters,
  PredictionInput,
  PredictionRecord,
  ToolCondition,
  ToolRecord,
} from './types'
import './Workspace.css'

type Appearance = 'light' | 'dark'
type AppContextValue = {
  tools: ToolRecord[]
  predictions: PredictionRecord[]
  alerts: AlertRecord[]
  alertClasses: string[]
  setAlertClasses: (classes: string[]) => void
  severityThreshold: number
  setSeverityThreshold: (threshold: number) => void
  appearance: Appearance
  setAppearance: (appearance: Appearance) => void
  addPrediction: (
    input: PredictionInput,
    result: Awaited<ReturnType<typeof predictTool>>,
  ) => PredictionRecord
  updateAlert: (id: string, status: AlertStatus) => void
}

const AppContext = createContext<AppContextValue | null>(null)
const storageKey = 'cnc-maintenance-demo'
const colors = ['#2d8c74', '#e2a13b', '#db7051', '#aa4945']
const conditionLabels = ['Healthy', 'Warning', 'Worn', 'Failed']

function useApp() {
  const context = useContext(AppContext)
  if (!context) throw new Error('App context is missing')
  return context
}

function useSavedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}:${key}`)
      return saved ? (JSON.parse(saved) as T) : initial
    } catch {
      return initial
    }
  })
  const save = (next: T) => {
    setValue(next)
    localStorage.setItem(`${storageKey}:${key}`, JSON.stringify(next))
  }
  return [value, save] as const
}

function AppProvider({ children }: { children: ReactNode }) {
  const [tools, setTools] = useSavedState<ToolRecord[]>('tools', initialTools)
  const [predictions, setPredictions] = useSavedState<PredictionRecord[]>(
    'predictions',
    initialPredictions,
  )
  const [alerts, setAlerts] = useSavedState<AlertRecord[]>('alerts', initialAlerts)
  const [alertClasses, setAlertClasses] = useSavedState<string[]>('alert-classes', [
    'Worn',
    'Failed',
  ])
  const [severityThreshold, setSeverityThreshold] = useSavedState<number>('severity-threshold', 70)
  const [appearance, setAppearance] = useSavedState<Appearance>('appearance', 'light')

  const addPrediction: AppContextValue['addPrediction'] = (input, result) => {
    const condition = result.predicted_condition as ToolCondition
    const alertRequired = result.alert_required || alertClasses.includes(condition)
    const prediction: PredictionRecord = {
      id: result.prediction_id,
      toolId: input.toolId,
      machineId: input.machineId,
      cadNumber: input.cadNumber,
      parameters: input.parameters,
      condition,
      probabilities: result.class_probabilities,
      timestamp: result.timestamp,
      alertStatus: alertRequired ? 'Open' : 'None',
      simulated:
        result.prediction_id.startsWith('MOCK-') || result.prediction_id.startsWith('DEMO-'),
    }
    setPredictions([prediction, ...predictions])
    setTools(
      tools.map((tool) =>
        tool.id === input.toolId
          ? {
              ...tool,
              condition,
              machineId: input.machineId,
              cadNumber: input.cadNumber,
              lastPrediction: result.timestamp,
              maintenance: alertRequired ? 'Service due' : 'In service',
            }
          : tool,
      ),
    )
    if (alertRequired) {
      const failureProbability =
        result.class_probabilities.Failed ?? result.class_probabilities[condition] ?? 0
      const severity =
        condition === 'Failed'
          ? 'Critical'
          : condition === 'Worn' || failureProbability * 100 >= severityThreshold
            ? 'High'
            : 'Medium'
      const nextAlert: AlertRecord = {
        id: `ALT-${Date.now().toString().slice(-5)}`,
        predictionId: prediction.id,
        toolId: input.toolId,
        machineId: input.machineId,
        cadNumber: input.cadNumber,
        condition,
        failureProbability,
        severity,
        timestamp: result.timestamp,
        recommendation:
          condition === 'Failed'
            ? 'Stop machine and replace the cutting tool before resuming production.'
            : 'Schedule a tool change and inspect holder runout at the next planned stop.',
        deliveryStatus: 'Simulated · administrator queue',
        status: 'Open',
      }
      setAlerts([nextAlert, ...alerts])
    }
    return prediction
  }

  const updateAlert = (id: string, status: AlertStatus) => {
    const alert = alerts.find((item) => item.id === id)
    setAlerts(
      alerts.map((item) =>
        item.id === id
          ? {
              ...item,
              status,
              deliveryStatus:
                status === 'Resolved'
                  ? 'Resolved by administrator'
                  : 'Acknowledged by administrator',
            }
          : item,
      ),
    )
    if (alert?.predictionId)
      setPredictions(
        predictions.map((item) =>
          item.id === alert.predictionId ? { ...item, alertStatus: status } : item,
        ),
      )
  }

  return (
    <AppContext.Provider
      value={{
        tools,
        predictions,
        alerts,
        alertClasses,
        setAlertClasses,
        severityThreshold,
        setSeverityThreshold,
        appearance,
        setAppearance,
        addPrediction,
        updateAlert,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/predict', label: 'Tool prediction', icon: Gauge },
  { to: '/tools', label: 'Tool management', icon: Boxes },
  { to: '/notifications', label: 'Notifications', icon: Bell },
  { to: '/history', label: 'Prediction history', icon: ClipboardList },
  { to: '/analytics', label: 'Analytics', icon: Activity },
  { to: '/windchill', label: 'Windchill PLM', icon: Network },
]

export default function Workspace() {
  return (
    <AppProvider>
      <BrowserRouter>
        <WorkspaceShell />
      </BrowserRouter>
    </AppProvider>
  )
}

function WorkspaceShell() {
  const { alerts, appearance } = useApp()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const title =
    navItems.find((item) => item.to === location.pathname)?.label ??
    (location.pathname.startsWith('/tools/') ? 'Tool detail' : 'Settings')
  const openAlerts = alerts.filter((alert) => alert.status === 'Open').length
  return (
    <div className="app-frame" data-theme={appearance}>
      <div className={`workspace ${collapsed ? 'sidebar-collapsed' : ''}`}>
        {mobileOpen && (
          <button
            aria-label="Close navigation"
            className="mobile-scrim"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <aside className={`sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
          <div className="brand-row">
            <div className="brand-mark">
              <Cpu size={20} strokeWidth={2.3} />
            </div>
            <div className="brand-copy">
              <strong>
                AXIOM<span> / </span>TOOLCARE
              </strong>
              <small>Manufacturing intelligence</small>
            </div>
            <button
              className="icon-button collapse-control"
              title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
              onClick={() => setCollapsed(!collapsed)}
            >
              <ChevronLeft size={17} />
            </button>
          </div>
          <div className="project-chip">
            <span className="project-dot" />
            <span className="project-copy">
              <b>MECH LAB · PROJECT 04</b>
              <small>Predictive maintenance</small>
            </span>
            <ChevronDown size={14} />
          </div>
          <div className="nav-caption">WORKSPACE</div>
          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="nav-label">{label}</span>
                {label === 'Notifications' && openAlerts > 0 && (
                  <span className="nav-count">{openAlerts}</span>
                )}
              </NavLink>
            ))}
          </nav>
          <div className="nav-bottom">
            <div className="windchill-mini">
              <div className="connection-icon">
                <Network size={16} />
              </div>
              <div className="connection-copy">
                <b>Windchill PLM</b>
                <small>
                  <i /> Not connected
                </small>
              </div>
              <span className="more-dots">···</span>
            </div>
            <NavLink
              to="/settings"
              title={collapsed ? 'Settings' : undefined}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => `nav-link settings-link ${isActive ? 'active' : ''}`}
            >
              <Settings size={18} />
              <span className="nav-label">Settings</span>
            </NavLink>
            <div className="user-row">
              <div className="user-avatar">AD</div>
              <div className="user-copy">
                <b>Project Admin</b>
                <small>Administrator</small>
              </div>
              <span className="more-dots">···</span>
            </div>
          </div>
        </aside>
        <main className="main-column">
          <header className="topbar">
            <div className="topbar-leading">
              <button
                className="icon-button mobile-menu"
                aria-label="Open navigation"
                onClick={() => setMobileOpen(true)}
              >
                <Menu size={20} />
              </button>
              <span className="crumb-root">Workspace</span>
              <ChevronRight size={14} className="crumb-chevron" />
              <span className="crumb-current">{title}</span>
            </div>
            <div className="topbar-actions">
              <div className="demo-indicator">
                <span /> SIMULATION MODE
              </div>
              <NavLink to="/notifications" className="icon-button top-alert" title="Notifications">
                <Bell size={18} />
                {openAlerts > 0 && <i>{openAlerts}</i>}
              </NavLink>
              <AppearanceButton />
              <NavLink to="/settings" className="icon-button help-button" title="Project settings">
                <CircleHelp size={18} />
              </NavLink>
              <div className="top-avatar">AD</div>
            </div>
          </header>
          <div className="page-scroll">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/predict" element={<PredictionPage />} />
              <Route path="/tools" element={<ToolsPage />} />
              <Route path="/tools/:toolId" element={<ToolDetail />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/analytics" element={<AnalyticsPage />} />
              <Route path="/windchill" element={<WindchillPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

function AppearanceButton() {
  const { appearance, setAppearance } = useApp()
  return (
    <button
      className="icon-button"
      onClick={() => setAppearance(appearance === 'light' ? 'dark' : 'light')}
      title={`Switch to ${appearance === 'light' ? 'dark' : 'light'} mode`}
      aria-label="Toggle appearance"
    >
      {appearance === 'light' ? <Moon size={17} /> : <Sun size={17} />}
    </button>
  )
}

function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="page-header">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action && <div className="header-action">{action}</div>}
    </div>
  )
}

function Panel({
  title,
  subtitle,
  action,
  children,
  className = '',
}: {
  title: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

function ConditionPill({ condition }: { condition: string }) {
  return (
    <span className={`condition-pill ${condition.toLowerCase().replace(/[^a-z]+/g, '-')}`}>
      <i />
      {condition}
    </span>
  )
}
function StatusPill({ status }: { status: string }) {
  return (
    <span className={`status-pill ${status.toLowerCase().replace(/[^a-z]+/g, '-')}`}>{status}</span>
  )
}
function formatTime(date: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}
function formatRelative(date: string) {
  const diff = Math.max(0, Date.now() - new Date(date).getTime())
  const hours = Math.floor(diff / 3_600_000)
  if (hours < 1) return `${Math.max(1, Math.floor(diff / 60_000))} min ago`
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
}

function Dashboard() {
  const { tools, predictions, alerts } = useApp()
  const navigate = useNavigate()
  const counts = conditionLabels.map((condition) => ({
    name: condition,
    value: tools.filter((tool) => tool.condition === condition).length,
  }))
  const openAlerts = alerts.filter((alert) => alert.status === 'Open')
  const stats = [
    {
      label: 'Tools monitored',
      value: tools.length.toString().padStart(2, '0'),
      meta: 'Across 8 CNC machines',
      icon: Boxes,
      tone: 'blue',
    },
    {
      label: 'Healthy',
      value: tools
        .filter((tool) => tool.condition === 'Healthy')
        .length.toString()
        .padStart(2, '0'),
      meta: 'Within operating range',
      icon: ShieldCheck,
      tone: 'green',
    },
    {
      label: 'Needs attention',
      value: tools
        .filter((tool) => tool.condition === 'Warning' || tool.condition === 'Worn')
        .length.toString()
        .padStart(2, '0'),
      meta: 'Warning or worn status',
      icon: AlertTriangle,
      tone: 'amber',
    },
    {
      label: 'Active alerts',
      value: openAlerts.length.toString().padStart(2, '0'),
      meta: 'Awaiting administrator',
      icon: Bell,
      tone: 'red',
    },
  ]
  return (
    <div className="page-content dashboard-page">
      <PageHeader
        eyebrow="MONDAY, 28 SEPTEMBER 2026 · SHIFT A"
        title="Operations overview"
        description="A live view of CNC tool health, predictive signals and maintenance activity."
        action={
          <button className="button button-primary" onClick={() => navigate('/predict')}>
            <Plus size={16} /> New prediction
          </button>
        }
      />
      <div className="demo-notice">
        <span className="demo-tag">DEMO DATA</span>
        <span>
          Predictions, alerts and Windchill status are simulated until connected services are
          configured.
        </span>
        <NavLink to="/settings">
          Integration settings <ChevronRight size={14} />
        </NavLink>
      </div>
      <div className="stat-grid">
        {stats.map(({ label, value, meta, icon: Icon, tone }) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <div className="stat-meta">
              <span>{label}</span>
              <small>{meta}</small>
            </div>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Tool health trend"
          subtitle="Condition distribution · last 7 days"
          className="trend-panel"
          action={
            <span className="select-like">
              Last 7 days <ChevronDown size={14} />
            </span>
          }
        >
          <div className="chart-legend">
            <span>
              <i className="legend-healthy" />
              Healthy
            </span>
            <span>
              <i className="legend-warning" />
              Warning
            </span>
            <span>
              <i className="legend-worn" />
              At risk
            </span>
          </div>
          <div className="chart-area trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 12, right: 6, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="healthyFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3e9d83" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#3e9d83" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  dy={9}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  domain={[0, 100]}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="healthy"
                  name="Healthy"
                  stroke="#328c73"
                  strokeWidth={2.3}
                  fill="url(#healthyFill)"
                />
                <Line
                  type="monotone"
                  dataKey="warning"
                  name="Warning"
                  stroke="#e2a13b"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-footnote">
            <span>
              <Activity size={14} /> Health index
            </span>
            <b>
              88.4% <em>+2.1% vs previous week</em>
            </b>
          </div>
        </Panel>
        <Panel
          title="Condition mix"
          subtitle="Registered tools by latest condition"
          className="condition-panel"
          action={<span className="quiet-dots">···</span>}
        >
          <div className="condition-chart-wrap">
            <div className="chart-area donut-chart">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={counts}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="66%"
                    outerRadius="88%"
                    paddingAngle={3}
                    stroke="none"
                  >
                    {counts.map((entry, index) => (
                      <Cell key={entry.name} fill={colors[index]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: 'var(--surface)',
                      border: '1px solid var(--line)',
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="donut-label">
                <strong>{tools.length}</strong>
                <small>Total tools</small>
              </div>
            </div>
            <div className="condition-legend">
              {counts.map((item, index) => (
                <div key={item.name}>
                  <span>
                    <i style={{ background: colors[index] }} />
                    {item.name}
                  </span>
                  <b>{item.value}</b>
                </div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel
          title="Recent predictions"
          subtitle={`${predictions.length} records · newest first`}
          className="recent-panel"
          action={
            <NavLink className="text-link" to="/history">
              View history <ChevronRight size={14} />
            </NavLink>
          }
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TOOL / MACHINE</th>
                  <th>CONDITION</th>
                  <th>CONFIDENCE</th>
                  <th>WHEN</th>
                </tr>
              </thead>
              <tbody>
                {predictions.slice(0, 5).map((prediction) => (
                  <tr key={prediction.id} onClick={() => navigate(`/tools/${prediction.toolId}`)}>
                    <td>
                      <b>{prediction.toolId}</b>
                      <small>{prediction.machineId}</small>
                    </td>
                    <td>
                      <ConditionPill condition={prediction.condition} />
                    </td>
                    <td>
                      <div className="confidence">
                        <span>
                          <i
                            style={{
                              width: `${Math.round((prediction.probabilities[prediction.condition] ?? 0) * 100)}%`,
                            }}
                          />
                        </span>
                        <b>
                          {Math.round((prediction.probabilities[prediction.condition] ?? 0) * 100)}%
                        </b>
                      </div>
                    </td>
                    <td className="time-cell">{formatRelative(prediction.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel
          title="Administrator notifications"
          subtitle="Items requiring review"
          className="admin-panel"
          action={
            <NavLink className="text-link" to="/notifications">
              Notification center <ChevronRight size={14} />
            </NavLink>
          }
        >
          <div className="alert-list">
            {alerts.slice(0, 3).map((alert) => (
              <div className="alert-row" key={alert.id}>
                <div className={`alert-mark ${alert.severity.toLowerCase()}`}>
                  <AlertTriangle size={16} />
                </div>
                <div className="alert-copy">
                  <div>
                    <b>{alert.toolId}</b>
                    <span className={`severity-text ${alert.severity.toLowerCase()}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p>
                    {alert.condition} condition predicted on {alert.machineId}
                  </p>
                  <small>
                    {formatRelative(alert.timestamp)} · {alert.deliveryStatus}
                  </small>
                </div>
                <StatusPill status={alert.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="bottom-strip">
        <div className="windchill-status">
          <span className="windchill-logo">
            <Network size={17} />
          </span>
          <div>
            <b>PTC Windchill PLM</b>
            <small>Project container · MECH-LAB-04</small>
          </div>
          <StatusPill status="Not connected" />
        </div>
        <span className="separator" />
        <div className="sync-state">
          <Clock3 size={15} />
          <span>Last sync</span>
          <b>Not synchronized</b>
        </div>
        <NavLink to="/windchill" className="text-link">
          Configure connection <ChevronRight size={14} />
        </NavLink>
      </div>
    </div>
  )
}

const defaultParameters: MachiningParameters = {
  cuttingSpeed: 180,
  feedRate: 0.25,
  depthOfCut: 2.5,
  spindleLoad: 72,
  toolVibration: 4.3,
}
const parameterFields: {
  key: keyof MachiningParameters
  label: string
  unit: string
  step: string
  max?: number
}[] = [
  { key: 'cuttingSpeed', label: 'Cutting speed', unit: 'm/min', step: '1' },
  { key: 'feedRate', label: 'Feed rate', unit: 'mm/rev', step: '0.01' },
  { key: 'depthOfCut', label: 'Depth of cut', unit: 'mm', step: '0.1' },
  { key: 'spindleLoad', label: 'Spindle load', unit: '%', step: '1', max: 100 },
  { key: 'toolVibration', label: 'Tool vibration', unit: 'mm/s', step: '0.1' },
]

function PredictionPage() {
  const { tools, addPrediction } = useApp()
  const navigate = useNavigate()
  const [toolId, setToolId] = useState('T-2048')
  const selectedTool = tools.find((tool) => tool.id === toolId)
  const [machineId, setMachineId] = useState(selectedTool?.machineId ?? 'CNC-04')
  const [cadNumber, setCadNumber] = useState(selectedTool?.cadNumber ?? 'WT-0001842')
  const [parameters, setParameters] = useState(defaultParameters)
  const [result, setResult] = useState<PredictionRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const chooseTool = (id: string) => {
    setToolId(id)
    const tool = tools.find((item) => item.id === id)
    if (tool) {
      setMachineId(tool.machineId)
      setCadNumber(tool.cadNumber)
    }
  }
  const submitPrediction = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setNotice('')
    if (!toolId.trim() || !machineId.trim() || !cadNumber.trim()) {
      setError('Tool ID, machine ID and CAD document number are required.')
      return
    }
    if (Object.values(parameters).some((value) => !Number.isFinite(value) || value < 0)) {
      setError('Machining parameters must be valid non-negative numbers.')
      return
    }
    if (parameters.spindleLoad > 100) {
      setError('Spindle load cannot exceed 100%.')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const response = await predictTool({ toolId, machineId, cadNumber, parameters })
      const prediction = addPrediction({ toolId, machineId, cadNumber, parameters }, response)
      setResult(prediction)
      setNotice(
        prediction.alertStatus === 'Open'
          ? 'Simulated administrator notification queued.'
          : 'Prediction saved to demo history.',
      )
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Prediction request failed. Check the API connection and retry.',
      )
    } finally {
      setLoading(false)
    }
  }
  return (
    <div className="page-content prediction-page">
      <PageHeader
        eyebrow="PREDICTIVE MAINTENANCE"
        title="CNC tool prediction"
        description="Evaluate a tool from its current machining conditions and review the predicted maintenance risk."
        action={
          <span className="service-state">
            <i /> Python API · not connected
          </span>
        }
      />
      <div className="simulation-callout">
        <div className="callout-icon">
          <Activity size={18} />
        </div>
        <div>
          <b>Simulation mode is active</b>
          <p>
            Results on this page are mock estimates, not predictions from your trained Random Forest
            model.
          </p>
        </div>
        <span className="simulation-stamp">DEMO</span>
      </div>
      <div className="prediction-layout">
        <form className="panel prediction-form" onSubmit={submitPrediction} noValidate>
          <div className="panel-heading">
            <div>
              <h2>Prediction inputs</h2>
              <p>Identify the tool, machine and cutting conditions.</p>
            </div>
            <span className="step-number">01</span>
          </div>
          <div className="input-section">
            <div className="section-label">TOOL & PLM REFERENCE</div>
            <div className="field-grid field-grid-three">
              <label className="field">
                <span>
                  Tool ID <i>*</i>
                </span>
                <select value={toolId} onChange={(event) => chooseTool(event.target.value)}>
                  {tools.map((tool) => (
                    <option key={tool.id} value={tool.id}>
                      {tool.id} · {tool.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>
                  Machine ID <i>*</i>
                </span>
                <input
                  required
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                  placeholder="CNC-04"
                />
              </label>
              <label className="field">
                <span>
                  Windchill CAD document <i>*</i>
                </span>
                <input
                  required
                  value={cadNumber}
                  onChange={(event) => setCadNumber(event.target.value)}
                  placeholder="WT-0001842"
                />
              </label>
            </div>
          </div>
          <div className="input-section">
            <div className="section-label">
              MACHINING PARAMETERS <span>UNITS SHOWN PER INPUT</span>
            </div>
            <div className="field-grid field-grid-parameters">
              {parameterFields.map(({ key, label, unit, step, max }) => (
                <label className="field" key={key}>
                  <span>{label}</span>
                  <div className="number-input">
                    <input
                      type="number"
                      min="0"
                      max={max}
                      step={step}
                      required
                      value={parameters[key]}
                      onChange={(event) =>
                        setParameters({ ...parameters, [key]: Number(event.target.value) })
                      }
                    />
                    <span>{unit}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
          {error && (
            <div className="form-feedback error">
              <AlertTriangle size={16} />
              {error}
            </div>
          )}
          <div className="form-footer">
            <span>
              <ShieldCheck size={15} /> Input validation enabled
            </span>
            <button className="button button-primary button-large" disabled={loading}>
              {loading ? (
                <>
                  <span className="spinner" /> Analyzing parameters
                </>
              ) : (
                <>
                  PREDICT TOOL CONDITION <ChevronRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
        <section className={`panel result-panel ${result ? 'has-result' : ''}`}>
          <div className="panel-heading">
            <div>
              <h2>Prediction result</h2>
              <p>Outcome and next recommended action.</p>
            </div>
            <span className="step-number">02</span>
          </div>
          {!result ? (
            <div className="empty-result">
              <div className="empty-orbit">
                <Gauge size={26} />
              </div>
              <b>Ready for analysis</b>
              <p>Enter valid operating parameters and run a prediction to view the result.</p>
              <span>MOCK MODEL · NOT CONNECTED</span>
            </div>
          ) : (
            <div className="result-content">
              <div className="result-topline">
                <span className="demo-tag">SIMULATED RESULT</span>
                <span>{formatTime(result.timestamp)}</span>
              </div>
              <div className="result-condition">
                <div className={`condition-emblem ${result.condition.toLowerCase()}`}>
                  <Activity size={21} />
                </div>
                <div>
                  <small>PREDICTED CONDITION</small>
                  <h3>{result.condition}</h3>
                </div>
                <ConditionPill condition={result.condition} />
              </div>
              <div className="probability-block">
                <div className="block-title">
                  <b>Condition probability</b>
                  <span>Mock class scores</span>
                </div>
                {Object.entries(result.probabilities).map(([label, probability]) => (
                  <div className="probability-row" key={label}>
                    <span>{label}</span>
                    <div className="probability-track">
                      <i
                        className={label.toLowerCase()}
                        style={{ width: `${Math.max(1, probability * 100)}%` }}
                      />
                    </div>
                    <b>{(probability * 100).toFixed(1)}%</b>
                  </div>
                ))}
              </div>
              <div
                className={`recommendation-box ${result.alertStatus === 'Open' ? 'attention' : 'normal'}`}
              >
                <div className="recommendation-icon">
                  {result.alertStatus === 'Open' ? <Wrench size={17} /> : <Check size={17} />}
                </div>
                <div>
                  <b>
                    {result.alertStatus === 'Open'
                      ? 'Maintenance review recommended'
                      : 'Continue normal operation'}
                  </b>
                  <p>
                    {result.alertStatus === 'Open'
                      ? 'Review the generated alert and schedule an inspection.'
                      : 'No maintenance alert was generated for this demo result.'}
                  </p>
                </div>
              </div>
              <div className="result-meta">
                <span>Notification status</span>
                <b>{result.alertStatus === 'Open' ? 'Simulated · queued' : 'No alert required'}</b>
              </div>
              <button
                className="button button-secondary full-button"
                onClick={() => navigate('/history')}
              >
                Open prediction history <ChevronRight size={15} />
              </button>
              {notice && (
                <div className="success-message">
                  <Check size={15} />
                  {notice}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

function NotificationsPage() {
  const { alerts, updateAlert } = useApp()
  const [filter, setFilter] = useState('All alerts')
  const filtered = alerts.filter(
    (alert) => filter === 'All alerts' || alert.status === filter.replace(' alerts', ''),
  )
  const openCount = alerts.filter((alert) => alert.status === 'Open').length
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="ADMINISTRATOR WORKSPACE"
        title="Notification center"
        description="Review simulated maintenance alerts and track administrator response."
        action={
          <div className="unread-summary">
            <span className="unread-dot" />
            {openCount} awaiting review
          </div>
        }
      />
      <div className="demo-notice">
        <span className="demo-tag">SIMULATED DELIVERY</span>
        <span>No email or Windchill workflow notification is sent from this demo.</span>
        <NavLink to="/settings">
          Notification rules <ChevronRight size={14} />
        </NavLink>
      </div>
      <div className="toolbar-row">
        <div className="segmented-control">
          {['All alerts', 'Open alerts', 'Acknowledged alerts', 'Resolved alerts'].map((item) => (
            <button
              key={item}
              className={filter === item ? 'selected' : ''}
              onClick={() => setFilter(item)}
            >
              {item}
              <span>
                {item === 'All alerts'
                  ? alerts.length
                  : alerts.filter((alert) => alert.status === item.replace(' alerts', '')).length}
              </span>
            </button>
          ))}
        </div>
        <button
          className="button button-secondary"
          onClick={() =>
            alerts
              .filter((alert) => alert.status === 'Open')
              .forEach((alert) => updateAlert(alert.id, 'Acknowledged'))
          }
        >
          <CheckCheck size={15} /> Acknowledge all open
        </button>
      </div>
      <div className="alert-stack">
        {filtered.map((alert) => (
          <article className={`alert-card ${alert.severity.toLowerCase()}`} key={alert.id}>
            <div className={`alert-symbol ${alert.severity.toLowerCase()}`}>
              <AlertTriangle size={20} />
            </div>
            <div className="alert-main">
              <div className="alert-card-title">
                <div>
                  <span className="alert-id">{alert.id}</span>
                  <ConditionPill condition={alert.condition} />
                </div>
                <StatusPill status={alert.status} />
              </div>
              <h2>{alert.condition} tool condition detected</h2>
              <p className="alert-desc">
                Tool <b>{alert.toolId}</b> on <b>{alert.machineId}</b> · CAD{' '}
                <b>{alert.cadNumber}</b>
              </p>
              <div className="alert-details">
                <div>
                  <small>FAILURE CLASS PROBABILITY</small>
                  <b>{(alert.failureProbability * 100).toFixed(1)}%</b>
                </div>
                <div>
                  <small>SEVERITY</small>
                  <b className={`severity-text ${alert.severity.toLowerCase()}`}>
                    {alert.severity}
                  </b>
                </div>
                <div>
                  <small>PREDICTION TIME</small>
                  <b>{formatTime(alert.timestamp)}</b>
                </div>
                <div>
                  <small>DELIVERY</small>
                  <b className="delivery-label">{alert.deliveryStatus}</b>
                </div>
              </div>
              <div className="alert-recommendation">
                <Wrench size={15} />
                <span>
                  <b>Recommended action</b>
                  {alert.recommendation}
                </span>
              </div>
              <div className="alert-actions">
                {alert.status === 'Open' && (
                  <button
                    className="button button-secondary"
                    onClick={() => updateAlert(alert.id, 'Acknowledged')}
                  >
                    <Check size={15} /> Acknowledge
                  </button>
                )}
                {alert.status !== 'Resolved' && (
                  <button
                    className="button button-primary"
                    onClick={() => updateAlert(alert.id, 'Resolved')}
                  >
                    <CheckCheck size={15} /> Resolve alert
                  </button>
                )}
                {alert.status === 'Resolved' && (
                  <span className="resolved-note">
                    <Check size={15} /> Resolved by administrator
                  </span>
                )}
                <span className="alert-created">Alert ID · {alert.id}</span>
              </div>
            </div>
          </article>
        ))}
        {filtered.length === 0 && (
          <EmptyState
            title="No alerts in this view"
            detail="New maintenance alerts will appear here when a configured condition class is detected."
            icon={<Bell size={21} />}
          />
        )}
      </div>
    </div>
  )
}

function ToolsPage() {
  const { tools } = useApp()
  const [search, setSearch] = useState('')
  const [condition, setCondition] = useState('All conditions')
  const navigate = useNavigate()
  const filtered = tools.filter(
    (tool) =>
      `${tool.id} ${tool.name} ${tool.machineId} ${tool.cadNumber}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (condition === 'All conditions' || tool.condition === condition),
  )
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="ASSET REGISTER"
        title="CNC tool management"
        description="Registered cutting tools linked to their machine, current condition and Windchill reference."
        action={
          <button className="button button-primary" onClick={() => navigate('/predict')}>
            <Plus size={16} /> Run prediction
          </button>
        }
      />
      <div className="demo-notice">
        <span className="demo-tag">DEMO REGISTER</span>
        <span>Sample tool records are stored in this browser for the project demonstration.</span>
      </div>
      <div className="panel table-panel">
        <div className="table-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tool, machine or CAD number"
            />
          </div>
          <label className="select-filter">
            <span>Condition</span>
            <select value={condition} onChange={(event) => setCondition(event.target.value)}>
              <option>All conditions</option>
              {conditionLabels.map((label) => (
                <option key={label}>{label}</option>
              ))}
            </select>
          </label>
          <span className="record-count">{filtered.length} tools</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>TOOL</th>
                <th>MACHINE</th>
                <th>WINDCHILL CAD DOCUMENT</th>
                <th>CONDITION</th>
                <th>LAST INSPECTION</th>
                <th>MAINTENANCE</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((tool) => (
                <tr
                  key={tool.id}
                  className="clickable-row"
                  onClick={() => navigate(`/tools/${tool.id}`)}
                >
                  <td>
                    <b>{tool.id}</b>
                    <small>{tool.name}</small>
                  </td>
                  <td>{tool.machineId}</td>
                  <td className="mono-text">{tool.cadNumber}</td>
                  <td>
                    <ConditionPill condition={tool.condition} />
                  </td>
                  <td>{formatTime(tool.inspectedAt)}</td>
                  <td>
                    <StatusPill status={tool.maintenance} />
                  </td>
                  <td>
                    <ChevronRight size={16} className="row-arrow" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              title="No matching tools"
              detail="Try changing the search or condition filter."
              icon={<Search size={20} />}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ToolDetail() {
  const { toolId } = useParams()
  const { tools, predictions } = useApp()
  const navigate = useNavigate()
  const tool = tools.find((item) => item.id === toolId)
  if (!tool)
    return (
      <div className="page-content">
        <EmptyState
          title="Tool not found"
          detail="This tool is not in the current demonstration register."
          icon={<Boxes size={20} />}
        />
        <button className="button button-secondary" onClick={() => navigate('/tools')}>
          <ArrowLeft size={15} /> Back to tool register
        </button>
      </div>
    )
  const related = predictions.filter((prediction) => prediction.toolId === tool.id)
  return (
    <div className="page-content">
      <button className="back-link" onClick={() => navigate('/tools')}>
        <ArrowLeft size={15} /> Tool register
      </button>
      <PageHeader
        eyebrow="TOOL DETAIL"
        title={tool.id}
        description={tool.name}
        action={<ConditionPill condition={tool.condition} />}
      />
      <div className="detail-grid">
        <Panel title="Asset information" subtitle="Demo tool record">
          <dl className="detail-list">
            <dt>Machine ID</dt>
            <dd>{tool.machineId}</dd>
            <dt>CAD document</dt>
            <dd className="mono-text">{tool.cadNumber}</dd>
            <dt>Material</dt>
            <dd>{tool.material}</dd>
            <dt>Location</dt>
            <dd>{tool.location}</dd>
            <dt>Last inspection</dt>
            <dd>{formatTime(tool.inspectedAt)}</dd>
            <dt>Maintenance status</dt>
            <dd>
              <StatusPill status={tool.maintenance} />
            </dd>
          </dl>
          <div className="unconnected-note">
            <Network size={16} /> CAD model preview will be available after Windchill is connected.
          </div>
        </Panel>
        <Panel title="Prediction history" subtitle={`${related.length} recorded predictions`}>
          <div className="compact-history">
            {related.length ? (
              related.map((prediction) => (
                <div key={prediction.id}>
                  <ConditionPill condition={prediction.condition} />
                  <span>
                    {prediction.id}
                    <small>{formatTime(prediction.timestamp)}</small>
                  </span>
                  <b>{Math.round((prediction.probabilities[prediction.condition] ?? 0) * 100)}%</b>
                </div>
              ))
            ) : (
              <p className="muted-copy">No prediction records for this tool.</p>
            )}
          </div>
          <NavLink className="text-link detail-history-link" to="/history">
            View all prediction history <ChevronRight size={14} />
          </NavLink>
        </Panel>
      </div>
    </div>
  )
}

function HistoryPage() {
  const { predictions } = useApp()
  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const filtered = predictions.filter((prediction) => {
    const queryMatch =
      `${prediction.toolId} ${prediction.machineId} ${prediction.cadNumber} ${prediction.condition}`
        .toLowerCase()
        .includes(search.toLowerCase())
    const day = prediction.timestamp.slice(0, 10)
    return queryMatch && (!fromDate || day >= fromDate) && (!toDate || day <= toDate)
  })
  const exportCsv = () => {
    const headers = [
      'prediction_id',
      'tool_id',
      'machine_id',
      'cad_document_number',
      'condition',
      'timestamp',
      'alert_status',
      'cutting_speed_m_min',
      'feed_rate_mm_rev',
      'depth_of_cut_mm',
      'spindle_load_pct',
      'tool_vibration_mm_s',
      ...conditionLabels.map((label) => `probability_${label.toLowerCase()}`),
    ]
    const rows = filtered.map((item) => [
      item.id,
      item.toolId,
      item.machineId,
      item.cadNumber,
      item.condition,
      item.timestamp,
      item.alertStatus,
      item.parameters.cuttingSpeed,
      item.parameters.feedRate,
      item.parameters.depthOfCut,
      item.parameters.spindleLoad,
      item.parameters.toolVibration,
      ...conditionLabels.map((label) => item.probabilities[label] ?? ''),
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\r\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `cnc-prediction-history-${new Date().toISOString().slice(0, 10)}.csv`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="AUDIT TRAIL"
        title="Prediction history"
        description="Search, filter and export previous tool condition assessments."
        action={
          <button
            className="button button-secondary"
            onClick={exportCsv}
            disabled={!filtered.length}
          >
            <ArrowDownToLine size={16} /> Export CSV
          </button>
        }
      />
      <div className="panel table-panel">
        <div className="table-toolbar history-toolbar">
          <div className="search-field">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tool, machine, condition"
            />
          </div>
          <label className="date-filter">
            <span>From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label className="date-filter">
            <span>To</span>
            <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
          </label>
          <span className="record-count">{filtered.length} records</span>
        </div>
        <div className="table-scroll">
          <table className="history-table">
            <thead>
              <tr>
                <th>TOOL / MACHINE</th>
                <th>MACHINING PARAMETERS</th>
                <th>CONDITION</th>
                <th>PROBABILITIES</th>
                <th>TIMESTAMP</th>
                <th>ALERT</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((prediction) => (
                <tr key={prediction.id}>
                  <td>
                    <b>{prediction.toolId}</b>
                    <small>
                      {prediction.machineId} · {prediction.cadNumber}
                    </small>
                  </td>
                  <td className="parameter-cell">
                    S {prediction.parameters.cuttingSpeed} · F {prediction.parameters.feedRate} · D{' '}
                    {prediction.parameters.depthOfCut}
                    <small>
                      Load {prediction.parameters.spindleLoad}% · Vib{' '}
                      {prediction.parameters.toolVibration} mm/s
                    </small>
                  </td>
                  <td>
                    <ConditionPill condition={prediction.condition} />
                    {prediction.simulated && <small className="simulated-hint">Simulated</small>}
                  </td>
                  <td>
                    <div className="probability-chips">
                      {Object.entries(prediction.probabilities).map(([label, probability]) => (
                        <span key={label} title={`${label}: ${(probability * 100).toFixed(1)}%`}>
                          {label.slice(0, 1)} {Math.round(probability * 100)}%
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>{formatTime(prediction.timestamp)}</td>
                  <td>
                    <StatusPill
                      status={
                        prediction.alertStatus === 'None' ? 'No alert' : prediction.alertStatus
                      }
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <EmptyState
              title="No predictions found"
              detail="Adjust the date range or search terms."
              icon={<ClipboardList size={20} />}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function AnalyticsPage() {
  const { predictions, tools } = useApp()
  const [range, setRange] = useState('7 days')
  const displayTrend =
    range === '7 days'
      ? trendData.map((item, index) => ({ ...item, dayCount: [8, 11, 9, 13, 15, 10, 12][index], maintenanceEvents: [2, 1, 3, 2, 4, 1, 3][index] }))
      : [...trendData, ...trendData].map((item, index) => ({ ...item, day: `D${index + 1}`, dayCount: [8, 11, 9, 13, 15, 10, 12][index % 7], maintenanceEvents: [2, 1, 3, 2, 4, 1, 3][index % 7] }))
  const scatterData = predictions.map((prediction) => ({
    speed: prediction.parameters.cuttingSpeed,
    load: prediction.parameters.spindleLoad,
    condition: prediction.condition,
  }))
  const distribution = conditionLabels.map((condition) => ({
    condition,
    count: tools.filter((tool) => tool.condition === condition).length,
  }))
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="OPERATIONAL INSIGHT"
        title="Analytics"
        description="Simulated condition trends and machining signals from the demonstration dataset."
        action={
          <div className="range-control">
            {['7 days', '30 days'].map((item) => (
              <button
                key={item}
                className={range === item ? 'selected' : ''}
                onClick={() => setRange(item)}
              >
                {item}
              </button>
            ))}
          </div>
        }
      />
      <div className="analytics-notice">
        <Activity size={16} />
        <span>
          Visualizations use sample data. Model accuracy and feature importance are intentionally
          unavailable until supplied by the Python backend.
        </span>
      </div>
      <div className="analytics-grid">
        <Panel
          title="Vibration & spindle load"
          subtitle={`${range} · simulated operating averages`}
          className="analytics-wide"
        >
          <div className="chart-area analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={displayTrend} margin={{ top: 12, right: 10, left: -17, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis
                  dataKey="day"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="vib"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <YAxis
                  yAxisId="load"
                  orientation="right"
                  domain={[0, 100]}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Legend />
                <Line
                  yAxisId="vib"
                  type="monotone"
                  dataKey="vibration"
                  name="Vibration · mm/s"
                  stroke="#287ea1"
                  strokeWidth={2.2}
                  dot={false}
                />
                <Line
                  yAxisId="load"
                  type="monotone"
                  dataKey="spindle"
                  name="Spindle load · %"
                  stroke="#d99c32"
                  strokeWidth={2.2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Condition distribution" subtitle="Latest tool status">
          <div className="chart-area bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution} margin={{ top: 12, right: 10, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis
                  dataKey="condition"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 10 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" name="Tools" radius={[4, 4, 0, 0]}>
                  {distribution.map((entry, index) => (
                    <Cell key={entry.condition} fill={colors[index]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Cutting speed by tool condition" subtitle="Simulated records · series indicate condition" className="analytics-wide">
          <div className="chart-area analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis
                  type="number"
                  dataKey="speed"
                  name="Cutting speed"
                  unit=" m/min"
                  domain={[120, 205]}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="number"
                  dataKey="load"
                  name="Spindle load"
                  unit="%"
                  domain={[40, 105]}
                  tick={{ fill: 'var(--muted)', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ strokeDasharray: '3 3' }}
                  contentStyle={{
                    background: 'var(--surface)',
                    border: '1px solid var(--line)',
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Scatter
                  name="Healthy"
                  data={scatterData.filter((item) => item.condition === 'Healthy')}
                  fill="#2d8c74"
                />
                <Scatter
                  name="Warning"
                  data={scatterData.filter((item) => item.condition === 'Warning')}
                  fill="#d39a34"
                />
                <Scatter
                  name="Worn"
                  data={scatterData.filter((item) => item.condition === 'Worn')}
                  fill="#d47e4d"
                />
                <Scatter
                  name="Failed"
                  data={scatterData.filter((item) => item.condition === 'Failed')}
                  fill="#bd514b"
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Prediction history" subtitle={`${range} · simulated class activity`} className="analytics-wide">
          <div className="chart-area analytics-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={displayTrend} margin={{ top: 12, right: 10, left: -17, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }} />
                <Legend />
                <Area type="monotone" dataKey="dayCount" name="Predictions" stroke="#397fa3" fill="#397fa3" fillOpacity={0.12} />
                <Area type="monotone" dataKey="warning" name="Warning index · sample" stroke="#d39a34" fill="#d39a34" fillOpacity={0.08} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Maintenance activity" subtitle="Simulated service events by day">
          <div className="chart-area bar-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={displayTrend} margin={{ top: 12, right: 8, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--line)" strokeDasharray="4 5" />
                <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 10 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: 'var(--muted)', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 6, fontSize: 12 }} />
                <Bar dataKey="maintenanceEvents" name="Maintenance events" fill="#4b9a81" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Model validation" subtitle="Backend-provided metrics only">
          <div className="metric-unavailable">
            <div className="metric-lock">
              <ShieldCheck size={19} />
            </div>
            <b>Awaiting Python API</b>
            <p>
              Accuracy, validated feature importance and model version will appear when the backend
              supplies them.
            </p>
            <span>NO MODEL METRICS REPORTED</span>
          </div>
        </Panel>
        <Panel title="Feature importance" subtitle="Actual model values only">
          <div className="metric-unavailable">
            <div className="metric-lock"><Gauge size={19} /></div>
            <b>Feature values not supplied</b>
            <p>Feature importance will appear here only after the Python API provides validated model metrics.</p>
            <span>NO SIMULATED IMPORTANCE SHOWN</span>
          </div>
        </Panel>
      </div>
    </div>
  )
}

function WindchillPage() {
  const [serverUrl, setServerUrl] = useSavedState(
    'windchill-url',
    'https://windchill.college.edu/Windchill',
  )
  const [container, setContainer] = useSavedState(
    'windchill-container',
    'MECH-LAB-04 · Predictive Maintenance',
  )
  const [workspace, setWorkspace] = useSavedState(
    'windchill-workspace',
    'cnc-toolcare-student-workspace',
  )
  const [connectionMessage, setConnectionMessage] = useState(
    'Connection has not been tested in this browser session.',
  )
  const [testing, setTesting] = useState(false)
  const [saved, setSaved] = useState(false)
  const { tools, alerts } = useApp()
  const sync = async () => {
    setTesting(true)
    setSaved(false)
    try {
      const parsedUrl = new URL(serverUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      setConnectionMessage('Enter a valid HTTP or HTTPS server URL.')
      setTesting(false)
      return
    }
    if (!container.trim() || !workspace.trim()) {
      setConnectionMessage('Project container and workspace names are required.')
      setTesting(false)
      return
    }
    const response = await testWindchillConnection(serverUrl)
    setConnectionMessage(response.message)
    setTesting(false)
  }
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="PRODUCT LIFECYCLE MANAGEMENT"
        title="Windchill PLM integration"
        description="Project container, student workspace and linked cutting-tool CAD references."
        action={
          <span className="service-state">
            <i className="offline" /> Not connected
          </span>
        }
      />
      <div className="integration-banner">
        <div className="integration-symbol">
          <Network size={22} />
        </div>
        <div>
          <b>Windchill connection is not configured</b>
          <p>
            These settings prepare the client for your authorized campus REST integration. No
            credentials are collected here.
          </p>
        </div>
        <span className="demo-tag">UNCONNECTED</span>
      </div>
      <div className="integration-grid">
        <Panel
          title="Server & project configuration"
          subtitle="Connection details are stored locally in this browser."
          className="configuration-panel"
        >
          <label className="field">
            <span>Windchill server URL</span>
            <input
              type="url"
              value={serverUrl}
              onChange={(event) => setServerUrl(event.target.value)}
              placeholder="https://windchill.example.edu/Windchill"
            />
          </label>
          <label className="field">
            <span>Project / product container</span>
            <input value={container} onChange={(event) => setContainer(event.target.value)} />
          </label>
          <label className="field">
            <span>Shared-login project workspace</span>
            <input value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
          </label>
          <div className="security-note">
            <ShieldCheck size={16} />
            <span>
              <b>Credential security</b> · Passwords and session tokens must be handled by an
              authorized backend, never stored in this frontend.
            </span>
          </div>
          <div className="form-feedback info">{connectionMessage}</div>
          <div className="form-footer">
            <span>REST API · OAuth / SSO pending</span>
            <div>
              <button
                className="button button-secondary"
                onClick={() => {
                  setSaved(true)
                  window.setTimeout(() => setSaved(false), 2500)
                }}
              >
                <Check size={15} /> {saved ? 'Configuration saved' : 'Save configuration'}
              </button>
              <button className="button button-primary" onClick={sync} disabled={testing}>
                {testing ? (
                  <>
                    <span className="spinner" /> Testing
                  </>
                ) : (
                  <>
                    <Network size={15} /> Test connection
                  </>
                )}
              </button>
            </div>
          </div>
        </Panel>
        <Panel title="Connection status" subtitle="Current demo environment">
          <div className="connection-status-card">
            <div className="connection-status-head">
              <div className="connection-icon large">
                <Network size={20} />
              </div>
              <div>
                <b>PTC Windchill</b>
                <small>{serverUrl}</small>
              </div>
              <StatusPill status="Not connected" />
            </div>
            <div className="connection-checks">
              <div>
                <span>
                  <i className="check-off" /> Authentication
                </span>
                <b>Not configured</b>
              </div>
              <div>
                <span>
                  <i className="check-off" /> Project container
                </span>
                <b>Pending connection</b>
              </div>
              <div>
                <span>
                  <i className="check-off" /> Workspace sync
                </span>
                <b>Never synchronized</b>
              </div>
            </div>
            <div className="sync-footer">
              <Clock3 size={15} /> Last synchronization <b>Not available</b>
            </div>
          </div>
        </Panel>
        <Panel
          title="Linked CNC tool CAD models"
          subtitle={`${tools.length} local document references · live CAD metadata unavailable`}
          className="linked-tools-panel"
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>TOOL ID</th>
                  <th>CAD DOCUMENT</th>
                  <th>PROJECT WORKSPACE</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {tools.slice(0, 6).map((tool) => (
                  <tr key={tool.id}>
                    <td>
                      <b>{tool.id}</b>
                      <small>{tool.name}</small>
                    </td>
                    <td className="mono-text">{tool.cadNumber}</td>
                    <td>{workspace}</td>
                    <td>
                      <StatusPill status="Local reference" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Maintenance records" subtitle="Alert-linked records · local demo references">
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>TOOL / MACHINE</th><th>CAD DOCUMENT</th><th>RECOMMENDED ACTION</th><th>STATUS</th></tr>
              </thead>
              <tbody>
                {alerts.slice(0, 4).map((alert) => (
                  <tr key={alert.id}>
                    <td><b>{alert.toolId}</b><small>{alert.machineId}</small></td>
                    <td className="mono-text">{alert.cadNumber}</td>
                    <td>{alert.recommendation}</td>
                    <td><StatusPill status={alert.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
        <Panel title="Synchronization history" subtitle="Windchill REST synchronization events">
          <EmptyState
            title="No completed synchronizations"
            detail="Sync history will be recorded after the authorized Windchill backend is connected."
            icon={<Clock3 size={20} />}
          />
        </Panel>
      </div>
    </div>
  )
}

function SettingsPage() {
  const {
    alertClasses,
    setAlertClasses,
    severityThreshold,
    setSeverityThreshold,
    appearance,
    setAppearance,
    alerts,
  } = useApp()
  const [emailEnabled, setEmailEnabled] = useSavedState('email-enabled', false)
  const [workflowEnabled, setWorkflowEnabled] = useSavedState('workflow-enabled', false)
  const [saved, setSaved] = useState(false)
  const toggleAlertClass = (label: string) =>
    setAlertClasses(
      alertClasses.includes(label)
        ? alertClasses.filter((item) => item !== label)
        : [...alertClasses, label],
    )
  return (
    <div className="page-content">
      <PageHeader
        eyebrow="SYSTEM CONFIGURATION"
        title="Settings"
        description="Configure demo alert rules, administrator preferences and application appearance."
        action={
          saved ? (
            <span className="save-confirm">
              <Check size={15} /> Settings saved
            </span>
          ) : null
        }
      />
      <div className="settings-layout">
        <div className="settings-main">
          <Panel
            title="Maintenance alert rules"
            subtitle="Generate a maintenance alert when prediction classes match these conditions."
          >
            <div className="settings-options">
              {['Warning', 'Worn', 'Failed'].map((label) => (
                <label className="check-setting" key={label}>
                  <span className={`condition-swatch ${label.toLowerCase()}`} />
                  <span>
                    <b>{label} condition</b>
                    <small>Queue an administrator review for this predicted class.</small>
                  </span>
                  <input
                    type="checkbox"
                    checked={alertClasses.includes(label)}
                    onChange={() => toggleAlertClass(label)}
                  />
                </label>
              ))}
            </div>
            <label className="field threshold-field">
              <span>Minimum failure probability for high severity</span>
              <div className="threshold-input">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={severityThreshold}
                  onChange={(event) =>
                    setSeverityThreshold(Math.max(1, Math.min(100, Number(event.target.value))))
                  }
                />
                <span>%</span>
              </div>
            </label>
          </Panel>
          <Panel
            title="Administrator notification preferences"
            subtitle="Delivery is simulated until an authorized backend is connected."
          >
            <div className="settings-options">
              <ToggleRow
                title="Email notification preparation"
                detail="Prepare alert payloads for backend email delivery."
                checked={emailEnabled}
                onChange={() => setEmailEnabled(!emailEnabled)}
              />
              <ToggleRow
                title="Windchill workflow preparation"
                detail="Prepare maintenance workflow payloads for linked CAD records."
                checked={workflowEnabled}
                onChange={() => setWorkflowEnabled(!workflowEnabled)}
              />
            </div>
            <div className="settings-callout">
              <Bell size={16} />
              <span>No email messages or Windchill workflows are sent from this app.</span>
            </div>
          </Panel>
          <Panel
            title="Application appearance"
            subtitle="Choose a workspace appearance for this browser."
          >
            <div className="appearance-options">
              <button
                className={
                  appearance === 'light' ? 'appearance-choice selected' : 'appearance-choice'
                }
                onClick={() => setAppearance('light')}
              >
                <Sun size={19} />
                <span>
                  <b>Light workspace</b>
                  <small>White surfaces and soft grey canvas</small>
                </span>
                {appearance === 'light' && <Check size={16} />}
              </button>
              <button
                className={
                  appearance === 'dark' ? 'appearance-choice selected' : 'appearance-choice'
                }
                onClick={() => setAppearance('dark')}
              >
                <Moon size={19} />
                <span>
                  <b>Dark workspace</b>
                  <small>Low-light dashboard surfaces</small>
                </span>
                {appearance === 'dark' && <Check size={16} />}
              </button>
            </div>
          </Panel>
          <button
            className="button button-primary save-button"
            onClick={() => {
              setSaved(true)
              window.setTimeout(() => setSaved(false), 2500)
            }}
          >
            <Check size={16} /> Save settings
          </button>
        </div>
        <aside className="settings-side">
          <Panel title="API connections" subtitle="Local development configuration">
            <div className="api-status-item">
              <div className="api-icon">
                <Cpu size={17} />
              </div>
              <div>
                <b>Python prediction API</b>
                <small>POST /api/predict</small>
              </div>
              <StatusPill status="Not connected" />
            </div>
            <div className="api-status-item">
              <div className="api-icon wind">
                <Network size={17} />
              </div>
              <div>
                <b>Windchill REST API</b>
                <small>Authorized integration pending</small>
              </div>
              <StatusPill status="Not connected" />
            </div>
            <NavLink to="/windchill" className="text-link settings-connection-link">
              Integration configuration <ChevronRight size={14} />
            </NavLink>
          </Panel>
          <Panel title="Recent notification activity" subtitle="Latest alert delivery status">
            <div className="notification-history">
              {alerts.slice(0, 4).map((alert) => (
                <div key={alert.id}>
                  <span className={`history-dot ${alert.status.toLowerCase()}`} />
                  <span>
                    <b>{alert.id}</b>
                    <small>{alert.deliveryStatus}</small>
                  </span>
                  <time>{formatRelative(alert.timestamp)}</time>
                </div>
              ))}
            </div>
          </Panel>
          <div className="security-card">
            <ShieldCheck size={18} />
            <div>
              <b>No secrets stored</b>
              <p>
                Windchill passwords and access tokens are not requested or saved by this frontend.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function ToggleRow({
  title,
  detail,
  checked,
  onChange,
}: {
  title: string
  detail: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="toggle-setting">
      <span>
        <b>{title}</b>
        <small>{detail}</small>
      </span>
      <input type="checkbox" checked={checked} onChange={onChange} />
      <i />
    </label>
  )
}
function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="page-content">
      <EmptyState
        title="Page not found"
        detail="That workspace route does not exist."
        icon={<CircleHelp size={20} />}
      />
      <button className="button button-secondary" onClick={() => navigate('/')}>
        <ArrowLeft size={15} /> Return to overview
      </button>
    </div>
  )
}
function EmptyState({ title, detail, icon }: { title: string; detail: string; icon: ReactNode }) {
  return (
    <div className="empty-state">
      <div>{icon}</div>
      <b>{title}</b>
      <p>{detail}</p>
    </div>
  )
}
