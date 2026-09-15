import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  DashboardIcon,
  BotIcon,
  ImportIcon,
  CommandsIcon,
  LogsIcon,
  StorageIcon,
  UsersIcon,
  BackupsIcon,
  SettingsIcon,
  GlobeIcon,
  ActivityIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  XIcon,
  PlusIcon,
  SearchIcon,
  RefreshIcon,
  PlayIcon,
  CircleStopIcon,
  RotateIcon,
  DownloadIcon,
  UploadIcon,
  TrashIcon,
  LockIcon,
  SunIcon,
  MoonIcon,
  LogOutIcon,
  UserPlusIcon,
  ShieldIcon,
  GaugeIcon,
  DatabaseIcon,
  ImageIcon,
  ArchiveIcon,
  HardDriveIcon,
  FileCodeIcon,
  TerminalIcon,
  ImagePlusIcon,
  InfoIcon,
  ListFilterIcon,
  LoaderIcon
} from "./lib/icons.jsx";
import { Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "./context/AuthContext.jsx";
import { api, downloadFromApi, formatBytes, formatDuration } from "./lib/api.js";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: DashboardIcon },
  { id: "bots", label: "Bots", icon: BotIcon },
  { id: "guilds", label: "Serveurs", icon: GlobeIcon },
  { id: "import", label: "Import ZIP", icon: ImportIcon },
  { id: "commands", label: "Commandes", icon: CommandsIcon },
  { id: "logs", label: "Logs", icon: LogsIcon },
  { id: "storage", label: "Stockage", icon: StorageIcon },
  { id: "users", label: "Utilisateurs", icon: UsersIcon },
  { id: "backups", label: "Sauvegardes", icon: BackupsIcon },
  { id: "settings", label: "Parametres", icon: SettingsIcon }
];

export default function App() {
  const auth = useAuth();
  if (auth.loading) return <Splash />;
  if (auth.needsSetup) return <SetupScreen onSetupComplete={() => auth.checkSetup()} />;
  if (!auth.user) return <Login />;
  return <Panel />;
}

function Panel() {
  const { token, user, logout } = useAuth();
  const [view, setView] = useState("dashboard");
  const [bots, setBots] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [metricHistory, setMetricHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [storage, setStorage] = useState(null);
  const [users, setUsers] = useState([]);
  const [backups, setBackups] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem("myos-darkMode");
    return saved === "true";
  });
  const [wallpaper, setWallpaper] = useState(() => localStorage.getItem("myos-wallpaper") || null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    localStorage.setItem("myos-darkMode", String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    if (wallpaper) {
      localStorage.setItem("myos-wallpaper", wallpaper);
    } else {
      localStorage.removeItem("myos-wallpaper");
    }
  }, [wallpaper]);

  useEffect(() => {
    api.get("/settings").then((res) => {
      if (res.data.darkMode === "true") setDarkMode(true);
      if (res.data.wallpaper) setWallpaper(res.data.wallpaper);
    }).catch(() => null);
  }, []);

  const toggleDarkMode = async () => {
    const next = !darkMode;
    setDarkMode(next);
    await api.put("/settings/dark-mode", { darkMode: next }).catch(() => null);
  };

  const saveWallpaper = (base64) => {
    setWallpaper(base64);
  };

  const removeWallpaper = async () => {
    setWallpaper(null);
    await api.delete("/settings/wallpaper").catch(() => null);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    const requests = [
      api.get("/bots").then((res) => setBots(res.data.bots)),
      api.get("/system/metrics").then((res) => {
        setMetrics(res.data.metrics);
        setMetricHistory((history) => pushMetric(history, res.data.metrics));
      }),
      api.get("/logs?limit=80").then((res) => setLogs(res.data.logs)),
      api.get("/storage").then((res) => setStorage(res.data.storage)),
      api.get("/backups").then((res) => setBackups(res.data.backups))
    ];
    if (user.role === "admin") {
      requests.push(api.get("/users").then((res) => setUsers(res.data.users)).catch(() => setUsers([])));
    }
    await Promise.allSettled(requests);
    setLoading(false);
  }, [user.role]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const socket = io("/", { auth: { token } });
    socket.on("system:metrics", (payload) => {
      if (!payload?.error) {
        setMetrics(payload);
        setMetricHistory((history) => pushMetric(history, payload));
      }
    });
    socket.on("bots:status", setBots);
    socket.on("bot:logs", (payload) => {
      if (payload.botId === selectedBotId) setLogs(payload.logs);
    });
    if (selectedBotId) socket.emit("bot:subscribe", selectedBotId);
    return () => socket.disconnect();
  }, [token, selectedBotId]);

  const selectedBot = useMemo(
    () => bots.find((bot) => bot.id === selectedBotId) || bots[0],
    [bots, selectedBotId]
  );

  const context = {
    bots,
    metrics,
    metricHistory,
    logs,
    storage,
    users,
    backups,
    selectedBot,
    selectedBotId,
    setSelectedBotId,
    refresh,
    addToast,
    darkMode,
    toggleDarkMode,
    wallpaper,
    saveWallpaper,
    removeWallpaper
  };

  return (
    <div
      className={`relative min-h-screen overflow-x-hidden transition-colors duration-500 ${wallpaper ? "" : "bg-snow dark:bg-smoke"}`}
      style={wallpaper ? {
        backgroundImage: `url(${wallpaper})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundAttachment: "fixed"
      } : undefined}
    >
      {wallpaper && <div className="pointer-events-none fixed inset-0 z-0 bg-snow/75 backdrop-blur-sm dark:bg-smoke/85" />}
      <aside className="fixed inset-y-0 left-0 hidden w-72 sidebar border-r px-5 py-6 backdrop-blur-xl z-20 lg:block shadow-sm">
        <Brand />
        <nav className="mt-8 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setView(item.id)}
              className={`nav-button ${view === item.id ? "nav-button-active" : ""}`}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="relative z-10 min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 topbar border-b px-5 py-3.5 backdrop-blur-xl sm:px-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="lg:hidden"><Brand compact /></div>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-smoke dark:text-mist-100">LAN panel</p>
                <h1 className="text-xl font-semibold text-smoke dark:text-mist-100">{titleFor(view)}</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <a
                href="https://discord.gg/ZKP8VjxCfC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/20 bg-[#5865F2]/10 px-3 py-2 text-sm font-medium text-[#5865F2] transition-all duration-200 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/30 hover:shadow-md dark:border-[#5865F2]/30 dark:bg-[#5865F2]/15 dark:text-[#7983F5] dark:hover:bg-[#5865F2]/25"
                title="Rejoindre le Discord"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                <span className="hidden sm:inline">Discord</span>
              </a>
              <a
                href="https://github.com/7Myo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#333]/15 bg-[#333]/5 px-3 py-2 text-sm font-medium text-[#333] transition-all duration-200 hover:bg-[#333]/10 hover:border-[#333]/25 hover:shadow-md dark:border-[#EEE]/20 dark:bg-[#EEE]/10 dark:text-[#DDD] dark:hover:bg-[#EEE]/20"
                title="Voir sur GitHub"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" className="opacity-90">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                <span className="hidden sm:inline">GitHub</span>
              </a>
              <DarkToggle darkMode={darkMode} onToggle={toggleDarkMode} />
              <StatusPill status="online" label="Acces LAN" />
              <IconButton title="Rafraichir" onClick={refresh}><RefreshIcon size={18} /></IconButton>
              <button className="inline-flex items-center gap-2 rounded-xl border border-mist-200/60 px-3 py-2 text-sm font-medium transition-all duration-200 hover:bg-mist-100 hover:shadow-md dark:border-mist-800 dark:hover:bg-mist-800/60" onClick={logout}>
                <LogOutIcon size={16} />
                <span className="hidden sm:inline">Sortir</span>
              </button>
            </div>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {navItems.map((item) => (
              <button key={item.id} className={`mobile-tab ${view === item.id ? "mobile-tab-active" : ""}`} onClick={() => setView(item.id)}>
                <item.icon size={16} />
                {item.label}
              </button>
            ))}
          </div>
        </header>

        <section className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <ToastContainer toasts={toasts} onRemove={removeToast} />
          {loading && <div className="mb-5 flex items-center gap-2 text-sm text-mist-500 dark:text-mist-400"><LoaderIcon size={16} /> Synchronisation du panel</div>}
          {view === "dashboard" && <Dashboard {...context} />}
          {view === "bots" && <BotsView {...context} />}
          {view === "guilds" && <GuildsView {...context} />}
          {view === "import" && <ImportView {...context} />}
          {view === "commands" && <CommandsView {...context} />}
          {view === "logs" && <LogsView {...context} />}
          {view === "storage" && <StorageView {...context} />}
          {view === "users" && <UsersView {...context} currentUser={user} />}
          {view === "backups" && <BackupsView {...context} />}
          {view === "settings" && <SettingsView {...context} />}
          <Footer />
        </section>
      </main>
    </div>
  );
}

function SetupScreen({ onSetupComplete }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const res = await api.post("/settings/setup", { name, username, password, confirmPassword });
      if (res.data.token) {
        localStorage.setItem("myos-token", res.data.token);
        window.location.reload();
      } else {
        onSetupComplete();
      }
    } catch (err) {
      setError(err.response?.data?.error?.message || "Configuration impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-snow dark:bg-smoke p-6">
      <div className="w-full max-w-md animate-fadeIn">
        <div className="text-center mb-8">
          <div className="brand-mark inline-flex mx-auto mb-4">
            <ShieldIcon size={28} />
          </div>
          <h1 className="text-2xl font-bold text-smoke dark:text-mist-100">Configuration initiale</h1>
          <p className="mt-2 text-sm text-mist-500 dark:text-mist-400">
            Aucun compte administrateur n&apos;a ete detecte. Creez le premier compte.
          </p>
        </div>
        <div className="rounded-2xl border border-mist-200/60 bg-snow p-6 shadow-card dark:border-mist-800/60 dark:bg-[#1A1612]">
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <div className="rounded-xl border border-clay-200 bg-clay-50 px-4 py-3 text-sm text-clay-700 dark:border-clay-800 dark:bg-clay-950 dark:text-clay-300">
                {error}
              </div>
            )}
            <label className="field-label">
              Nom affiche
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Administrateur" required autoFocus />
            </label>
            <label className="field-label">
              Nom d&apos;utilisateur
              <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="admin" required />
            </label>
            <label className="field-label">
              Mot de passe
              <input className="input" value={password} onChange={(e) => setPassword(e.target.value)} type="password" placeholder="Minimum 8 caracteres" required minLength={8} />
            </label>
            <label className="field-label">
              Confirmation du mot de passe
              <input className="input" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} type="password" placeholder="Repetez le mot de passe" required />
            </label>
            <button className="primary-button w-full" disabled={submitting}>
              {submitting && <LoaderIcon size={18} />}
              <UserPlusIcon size={18} />
              Configurer
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await login(username, password);
    } catch (err) {
      setError(err.response?.data?.error?.message || "Connexion impossible.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-snow text-smoke dark:bg-smoke dark:text-mist-100 lg:grid-cols-[1fr_460px]">
      <section className="flex items-center px-8 py-10 sm:px-12">
        <div className="max-w-3xl animate-fadeIn">
          <Brand />
          <h1 className="mt-10 max-w-2xl text-4xl font-bold leading-tight sm:text-6xl text-smoke dark:text-mist-100">
            Panel LAN pour piloter tes bots Discord.
          </h1>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <LoginStat icon={ShieldIcon} label="JWT + roles" />
            <LoginStat icon={BotIcon} label="PM2 multi-bots" />
            <LoginStat icon={GaugeIcon} label="Linux temps reel" />
          </div>
          <p className="mt-8 text-sm text-mist-400 dark:text-mist-600">
            Created by &copy; 2026 Myo&apos;s Development. Tous droits reserves.
          </p>
        </div>
      </section>
      <section className="flex items-center border-l border-mist-200 bg-snow px-6 py-10 dark:border-mist-800 dark:bg-[#1A1612]">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm space-y-5 animate-fadeIn">
          <div>
            <div className="brand-mark mb-4">
              <LockIcon size={22} />
            </div>
            <h2 className="text-2xl font-semibold text-smoke dark:text-mist-100">Connexion</h2>
            <p className="mt-1 text-sm text-mist-500 dark:text-mist-400">Acces reserve aux comptes du panel.</p>
          </div>
          {error && <div className="rounded-xl border border-clay-200 bg-clay-50 px-3 py-2 text-sm text-clay-700 dark:border-clay-800 dark:bg-clay-950 dark:text-clay-300">{error}</div>}
          <label className="field-label">
            Nom d&apos;utilisateur
            <input className="input" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
          </label>
          <label className="field-label">
            Mot de passe
            <input className="input" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" />
          </label>
          <button className="primary-button w-full" disabled={submitting}>
            {submitting && <LoaderIcon size={18} />}
            Se connecter
          </button>
        </form>
      </section>
    </div>
  );
}

function DarkToggle({ darkMode, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-mist-200/60 bg-snow transition-all duration-300 hover:shadow-md dark:border-mist-800 dark:bg-[#1A1612]"
      title={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
      aria-label={darkMode ? "Passer en mode clair" : "Passer en mode sombre"}
    >
      {darkMode ? <SunIcon size={17} className="text-earth-400" /> : <MoonIcon size={17} className="text-mist-600" />}
    </button>
  );
}

function Footer() {
  return (
    <div className="mt-10 pt-6 border-t border-mist-200/60 dark:border-mist-800/60 text-center">
      <p className="text-xs text-mist-400 dark:text-mist-600">
        Created by &copy; 2026 Myo&apos;s Development. Tous droits reserves.
      </p>
    </div>
  );
}

function Dashboard({ bots, metrics, metricHistory, logs, storage, setSelectedBotId }) {
  const online = bots.filter((bot) => bot.status === "online").length;
  const errors = bots.reduce((sum, bot) => sum + (bot.errorsCount || 0), 0);
  const commands = bots.reduce((sum, bot) => sum + (bot.commandsCount || 0), 0);

  return (
    <div className="space-y-6 animate-fadeIn">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard icon={BotIcon} label="Bots totaux" value={bots.length} detail={`${online} en ligne`} />
        <MetricCard icon={FileCodeIcon} label="Commandes" value={commands} detail="Detectees automatiquement" />
        <MetricCard icon={ActivityIcon} label="CPU" value={`${metrics?.cpu?.load ?? 0}%`} detail={`${metrics?.cpu?.cores ?? 0} coeurs`} />
        <MetricCard icon={HardDriveIcon} label="Stockage bots" value={formatBytes(storage?.breakdown?.bots || 0)} detail={`${errors} erreurs`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <PanelCard title="Ressources Linux" action={<StatusPill status="online" label={metrics?.hostname || "serveur"} />}>
          <div className="h-72 chart-area">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={metricHistory}>
                <XAxis dataKey="time" tickLine={false} axisLine={false} />
                <YAxis tickLine={false} axisLine={false} width={34} domain={[0, 100]} />
                <Tooltip />
                <ReferenceLine y={25} stroke="rgba(156,150,136,0.18)" strokeDasharray="4 4" />
                <ReferenceLine y={50} stroke="rgba(156,150,136,0.18)" strokeDasharray="4 4" />
                <ReferenceLine y={75} stroke="rgba(156,150,136,0.18)" strokeDasharray="4 4" />
                <ReferenceLine y={100} stroke="rgba(156,150,136,0.10)" strokeDasharray="2 4" />
                <Line type="monotone" dataKey="cpu" stroke="#5B8C6F" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="memory" stroke="#C4645A" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PanelCard>
        <PanelCard title="Systeme">
          <InfoGrid rows={[
            ["Uptime serveur", formatDuration(metrics?.uptimeSeconds, "seconds")],
            ["Uptime panel", formatDuration(metrics?.panelUptimeSeconds, "seconds")],
            ["RAM utilisee", `${formatBytes(metrics?.memory?.used || 0)} / ${formatBytes(metrics?.memory?.total || 0)}`],
            ["Temperature", metrics?.temperature?.main ? `${metrics.temperature.main} deg C` : "N/A"],
            ["Processus", metrics?.processes?.all || 0]
          ]} />
        </PanelCard>
      </div>

      <PanelCard title="Bots heberges">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {bots.map((bot) => (
            <button key={bot.id} className="bot-card text-left" onClick={() => setSelectedBotId(bot.id)}>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-smoke dark:text-mist-100">{bot.name}</span>
                <StatusPill status={bot.status} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-mist-500 dark:text-mist-400">
                <span>CPU {bot.pm2?.cpu || 0}%</span>
                <span>RAM {formatBytes(bot.pm2?.memory || 0)}</span>
                <span>{bot.commandsCount || 0} cmds</span>
                <span>{formatDuration(bot.pm2?.uptime || 0)}</span>
              </div>
            </button>
          ))}
          {!bots.length && <EmptyState icon={BotIcon} title="Aucun bot" text="Importe un ZIP pour commencer." />}
        </div>
      </PanelCard>

      <PanelCard title="Activite recente">
        <LogList logs={logs.slice(0, 8)} />
      </PanelCard>
    </div>
  );
}

function BotsView({ bots, selectedBot, setSelectedBotId, refresh, addToast }) {
  const [busy, setBusy] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const runAction = async (bot, action) => {
    setBusy(`${bot.id}:${action}`);
    try {
      await api.post(`/bots/${bot.id}/actions/${action}`);
      addToast(`Action ${action} envoyee a ${bot.name}.`, "success");
      await refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Action impossible.", "error");
    } finally {
      setBusy("");
    }
  };

  const handleDelete = async () => {
    if (!selectedBot) return;
    setDeleting(true);
    try {
      await api.delete(`/bots/${selectedBot.id}?removeFiles=true`);
      addToast(`Bot ${selectedBot.name} supprime avec tous ses fichiers.`, "success");
      setSelectedBotId(null);
      setShowDelete(false);
      await refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Suppression impossible.", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr] animate-fadeIn">
      <PanelCard title="Tous les bots">
        <div className="space-y-3">
          {bots.map((bot) => (
            <button key={bot.id} onClick={() => setSelectedBotId(bot.id)} className={`bot-row ${selectedBot?.id === bot.id ? "bot-row-active" : ""}`}>
              <span className="font-medium">{bot.name}</span>
              <StatusPill status={bot.status} />
            </button>
          ))}
          {!bots.length && <EmptyState icon={BotIcon} title="Aucun bot" text="La liste est vide." />}
        </div>
      </PanelCard>
      <PanelCard title={selectedBot?.name || "Bot"} action={selectedBot && <StatusPill status={selectedBot.status} />}>
        {selectedBot ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MiniStat label="CPU" value={`${selectedBot.pm2?.cpu || 0}%`} />
              <MiniStat label="RAM" value={formatBytes(selectedBot.pm2?.memory || 0)} />
              <MiniStat label="Uptime" value={formatDuration(selectedBot.pm2?.uptime || 0)} />
              <MiniStat label="Restarts" value={selectedBot.pm2?.restarts || 0} />
            </div>
            <InfoGrid rows={[
              ["Processus PM2", selectedBot.pm2Name],
              ["Projet", selectedBot.projectPath],
              ["Entree", selectedBot.entrypoint],
              ["Commandes", selectedBot.commandsCount || 0]
            ]} />
            <div className="flex flex-wrap gap-2">
              <ActionButton icon={PlayIcon} label="Demarrer" loading={busy === `${selectedBot.id}:start`} onClick={() => runAction(selectedBot, "start")} />
              <ActionButton icon={CircleStopIcon} label="Arreter" loading={busy === `${selectedBot.id}:stop`} onClick={() => runAction(selectedBot, "stop")} />
              <ActionButton icon={RotateIcon} label="Redemarrer" loading={busy === `${selectedBot.id}:restart`} onClick={() => runAction(selectedBot, "restart")} />
              <ActionButton icon={FileCodeIcon} label="Scanner commandes" loading={busy === `${selectedBot.id}:refresh-commands`} onClick={() => runAction(selectedBot, "refresh-commands")} />
              <ActionButton
                icon={ArchiveIcon}
                label="Sauvegarder"
                onClick={async () => {
                  try {
                    await api.post(`/bots/${selectedBot.id}/backups`);
                    addToast("Sauvegarde creee.", "success");
                    await refresh();
                  } catch (err) {
                    addToast(err.response?.data?.error?.message || "Sauvegarde impossible.", "error");
                  }
                }}
              />
              <ActionButton icon={TrashIcon} label="Supprimer" tone="danger" onClick={() => setShowDelete(true)} />
            </div>

            {showDelete && (
              <div className="rounded-2xl border-2 border-clay-200 bg-clay-50 p-5 dark:border-clay-800 dark:bg-clay-950/50 animate-fadeIn">
                <div className="flex items-start gap-3">
                  <AlertTriangleIcon className="text-clay-500 shrink-0 mt-0.5" size={20} />
                  <div className="flex-1">
                    <h3 className="font-semibold text-clay-800 dark:text-clay-300">Confirmer la suppression</h3>
                    <p className="mt-1 text-sm text-clay-600 dark:text-clay-400">
                      Cette action est <strong>irreversible</strong>. Tous les fichiers, la configuration PM2, les logs et les sauvegardes du bot <strong>{selectedBot.name}</strong> seront supprimes definitivement.
                    </p>
                    <div className="mt-4 flex gap-2">
                      <button className="primary-button !bg-clay-500 hover:!bg-clay-600 dark:!bg-clay-600 dark:hover:!bg-clay-500" onClick={handleDelete} disabled={deleting}>
                        {deleting ? <LoaderIcon size={16} /> : <TrashIcon size={16} />}
                        Supprimer definitivement
                      </button>
                      <button className="secondary-button" onClick={() => setShowDelete(false)} disabled={deleting}>
                        Annuler
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <EmptyState icon={BotIcon} title="Selectionne un bot" text="Les details apparaitront ici." />
        )}
      </PanelCard>
    </div>
  );
}

function GuildsView({ bots, selectedBotId, setSelectedBotId, refresh, addToast }) {
  const [guilds, setGuilds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);

  const loadGuilds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/guilds");
      setGuilds(res.data.guilds);
    } catch {
      addToast("Impossible de charger les serveurs Discord.", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    loadGuilds();
  }, [loadGuilds]);

  const byBot = guilds.reduce((acc, guild) => {
    const key = guild.botId;
    if (!acc[key]) acc[key] = { botId: guild.botId, botName: guild.botName, botSlug: guild.botSlug, botStatus: guild.botStatus, guilds: [] };
    acc[key].guilds.push(guild);
    return acc;
  }, {});

  const botGroups = Object.values(byBot);
  const totalGuilds = guilds.length;
  const totalMembers = guilds.reduce((sum, g) => sum + (g.memberCount || 0), 0);
  const botsWithGuilds = botGroups.length;

  const botIdsWithGuilds = new Set(botGroups.map((g) => g.botId));
  const botsWithoutGuilds = bots.filter((b) => !botIdsWithGuilds.has(b.id));

  const allBots = [
    ...botGroups.map((g) => ({
      ...g,
      hasGuilds: true,
      status: g.botStatus,
      botToken: bots.find((b) => b.id === g.botId)?.botToken
    })),
    ...botsWithoutGuilds.map((b) => ({ botId: b.id, botName: b.name, botStatus: b.status, guilds: [], hasGuilds: false, botToken: b.botToken }))
  ];

  const selectedGroup = allBots.find((g) => g.botId === selectedBotId) || allBots[0];

  if (loading) {
    return <div className="flex items-center justify-center py-20 animate-fadeIn"><LoaderIcon size={28} /></div>;
  }

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={GlobeIcon} label="Serveurs Discord" value={totalGuilds} detail={`Sur ${botsWithGuilds} bots`} />
        <MetricCard icon={UsersIcon} label="Membres totaux" value={totalMembers.toLocaleString()} detail="Cumul de tous les serveurs" />
        <MetricCard icon={BotIcon} label="Bots avec serveurs" value={botsWithGuilds} detail={`Sur ${bots.length} bot(s) au total`} />
      </div>

      {!botGroups.length && !botsWithoutGuilds.length && (
        <EmptyState icon={GlobeIcon} title="Aucun bot" text="Importe un ZIP pour commencer." />
      )}

      {(botGroups.length > 0 || botsWithoutGuilds.length > 0) && (
        <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
          <PanelCard title="Bots" action={<IconButton title="Rafraichir" onClick={loadGuilds}><RefreshIcon size={16} /></IconButton>}>
            <div className="space-y-2">
              {allBots.map((group) => (
                <button
                  key={group.botId}
                  onClick={() => setSelectedBotId(group.botId)}
                  className={`bot-row ${selectedGroup?.botId === group.botId ? "bot-row-active" : ""}`}
                >
                  <div className="flex-1 min-w-0">
                    <span className="font-medium block truncate">{group.botName}</span>
                    <span className="text-xs text-mist-500 dark:text-mist-400">
                      {group.hasGuilds ? `${group.guilds.length} serveur(s) · ${group.guilds.reduce((s, g) => s + (g.memberCount || 0), 0).toLocaleString()} membres` : "Aucun serveur"}
                    </span>
                  </div>
                  <StatusPill status={group.botStatus} />
                </button>
              ))}
            </div>
          </PanelCard>

          <PanelCard
            title={selectedGroup?.botName || "Bot"}
            action={
              selectedGroup && (
                <div className="flex items-center gap-2">
                  <StatusPill status={selectedGroup.botStatus} />
                  {selectedGroup.hasGuilds && (
                    <button
                      className="secondary-button text-xs"
                      onClick={() => setShowChart(!showChart)}
                    >
                      {showChart ? "Tableau" : "Graphique"}
                    </button>
                  )}
                </div>
              )
            }
          >
            {selectedGroup?.hasGuilds ? (
              <div className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <MiniStat label="Serveurs" value={selectedGroup.guilds.length} />
                  <MiniStat label="Membres totaux" value={selectedGroup.guilds.reduce((s, g) => s + (g.memberCount || 0), 0).toLocaleString()} />
                  <MiniStat
                    label="Moy. / serveur"
                    value={selectedGroup.guilds.length ? Math.round(selectedGroup.guilds.reduce((s, g) => s + (g.memberCount || 0), 0) / selectedGroup.guilds.length).toLocaleString() : "0"}
                  />
                  <MiniStat
                    label="Plus gros"
                    value={selectedGroup.guilds.reduce((best, g) => (g.memberCount || 0) > (best.memberCount || 0) ? g : best, selectedGroup.guilds[0]).guildName}
                  />
                </div>

                {!showChart ? (
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>ID Serveur</th>
                          <th>Nom du serveur</th>
                          <th>Membres</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedGroup.guilds.map((guild) => (
                          <tr key={guild.id}>
                            <td className="font-mono text-xs text-mist-500 dark:text-mist-400">{guild.guildId}</td>
                            <td className="font-medium">{guild.guildName}</td>
                            <td>
                              <span className="inline-flex items-center gap-1.5">
                                <UsersIcon size={14} className="text-mist-400" />
                                {guild.memberCount.toLocaleString()}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-smoke dark:text-mist-100">Repartition des membres</p>
                    {selectedGroup.guilds.map((guild) => {
                      const maxMembers = selectedGroup.guilds.reduce((m, g) => Math.max(m, g.memberCount || 0), 0);
                      const pct = maxMembers ? ((guild.memberCount || 0) / maxMembers) * 100 : 0;
                      return (
                        <div key={guild.id} className="flex items-center gap-3">
                          <span className="w-32 truncate text-sm text-mist-500 dark:text-mist-400" title={guild.guildName}>
                            {guild.guildName}
                          </span>
                          <div className="flex-1 h-5 rounded-full bg-mist-200 dark:bg-mist-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500 ease-out"
                              style={{
                                width: `${Math.max(pct, 2)}%`,
                                background: "linear-gradient(90deg, #5865F2, #7983F5)"
                              }}
                            />
                          </div>
                          <span className="w-20 text-right text-sm font-semibold text-smoke dark:text-mist-100">
                            {guild.memberCount.toLocaleString()}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedGroup.botToken && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-mist-400 hover:text-mist-600 dark:hover:text-mist-300 transition-colors">
                      Token bot (pour report guilds)
                    </summary>
                    <code className="mt-1 block break-all rounded-lg bg-mist-100 p-2 text-[11px] text-smoke dark:bg-mist-900/50 dark:text-mist-200 select-all">
                      {selectedGroup.botToken}
                    </code>
                    <p className="mt-1 text-mist-400">
                      PUT /api/guilds/{selectedGroup.botId} avec <code className="text-xs">&#123;"guilds":[&#123;"id":"...","name":"...","memberCount":...&#125;]&#125;</code>
                    </p>
                  </details>
                )}
              </div>
            ) : selectedGroup ? (
              <div className="space-y-4">
                <EmptyState icon={GlobeIcon} title="Aucune donnee de guild" text="Ce bot n'a pas encore transmis ses serveurs Discord." />
                {selectedGroup.botToken && (
                  <details className="text-xs">
                    <summary className="cursor-pointer text-mist-400 hover:text-mist-600 dark:hover:text-mist-300 transition-colors">
                      Token bot (pour report guilds)
                    </summary>
                    <code className="mt-1 block break-all rounded-lg bg-mist-100 p-2 text-[11px] text-smoke dark:bg-mist-900/50 dark:text-mist-200 select-all">
                      {selectedGroup.botToken}
                    </code>
                    <p className="mt-1 text-mist-400">
                      PUT /api/guilds/{selectedGroup.botId} avec <code className="text-xs">&#123;"guilds":[&#123;"id":"...","name":"...","memberCount":...&#125;]&#125;</code>
                    </p>
                  </details>
                )}
              </div>
            ) : (
              <EmptyState icon={GlobeIcon} title="Selectionne un bot" text="Les serveurs Discord apparaitront ici." />
            )}
          </PanelCard>
        </div>
      )}
    </div>
  );
}

function ImportView({ refresh, addToast }) {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [name, setName] = useState("");
  const [installDependencies, setInstallDependencies] = useState(true);
  const [startNow, setStartNow] = useState(true);
  const [loading, setLoading] = useState(false);

  const upload = async () => {
    if (!file) return;
    setLoading(true);
    const form = new FormData();
    form.append("botZip", file);
    try {
      const response = await api.post("/imports/upload", form);
      setAnalysis(response.data);
      setName(response.data.analysis.packageJson.name || response.data.analysis.packageJson.description || "");
      addToast("ZIP analyse. Validation requise avant installation.", "success");
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Analyse impossible.", "error");
    } finally {
      setLoading(false);
    }
  };

  const confirm = async () => {
    setLoading(true);
    try {
      await api.post(`/imports/${analysis.id}/confirm`, { name: name || undefined, installDependencies, startNow });
      addToast(startNow ? "Bot installe et demarrage PM2 lance." : "Bot ajoute au panel sans demarrage.", "success");
      setAnalysis(null);
      setFile(null);
      await refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Validation impossible.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[420px_1fr] animate-fadeIn">
      <PanelCard title="Upload ZIP">
        <label className="drop-zone">
          <UploadIcon size={26} />
          <span className="font-semibold">{file ? file.name : "Choisir un fichier ZIP"}</span>
          <span className="text-sm text-mist-500 dark:text-mist-400">Analyse avant npm install et PM2</span>
          <input className="sr-only" type="file" accept=".zip" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        </label>
        <button className="primary-button mt-4 w-full" disabled={!file || loading} onClick={upload}>
          {loading && <LoaderIcon size={18} />}
          Analyser
        </button>
      </PanelCard>
      <PanelCard title="Validation">
        {analysis ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <MiniStat label="Package" value={analysis.analysis.packageJson.exists ? "Detecte" : "Absent"} />
              <MiniStat label="Entree" value={analysis.analysis.entrypoint || "N/A"} />
              <MiniStat label="Commandes" value={analysis.analysis.commands.length} />
            </div>
            <label className="field-label">
              Nom du bot dans le panel
              <input className="input" value={name} onChange={(event) => setName(event.target.value)} placeholder="Bot Moderation" />
            </label>
            {!!analysis.analysis.warnings.length && (
              <div className="rounded-xl border border-earth-200 bg-earth-50 p-3 text-sm text-earth-800 dark:border-earth-800 dark:bg-earth-950 dark:text-earth-300">
                {analysis.analysis.warnings.map((warning) => <p key={warning}>{warning}</p>)}
              </div>
            )}
            <InfoGrid rows={[
              ["Gestionnaire", analysis.analysis.packageManager],
              ["Dependances", analysis.analysis.packageJson.dependencies.length],
              ["Variables env", analysis.analysis.envFiles.flatMap((env) => env.keys).join(", ") || "Aucune"],
              ["Racine detectee", analysis.analysis.projectRoot]
            ]} />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="toggle-row">
                <input type="checkbox" checked={installDependencies} onChange={(event) => setInstallDependencies(event.target.checked)} />
                Installer les dependances
              </label>
              <label className="toggle-row">
                <input type="checkbox" checked={startNow} onChange={(event) => setStartNow(event.target.checked)} />
                Demarrer avec PM2
              </label>
            </div>
            <button className="primary-button" disabled={loading} onClick={confirm}>
              {loading && <LoaderIcon size={18} />}
              Valider, installer et demarrer
            </button>
          </div>
        ) : (
          <EmptyState icon={CheckCircleIcon} title="En attente d'analyse" text="Le panel ne lance rien avant validation." />
        )}
      </PanelCard>
    </div>
  );
}

function CommandsView({ bots, selectedBot, selectedBotId, setSelectedBotId }) {
  const [commands, setCommands] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");

  useEffect(() => {
    const botId = selectedBotId || selectedBot?.id;
    if (!botId) return;
    api.get(`/bots/${botId}/commands`).then((res) => setCommands(res.data.commands));
  }, [selectedBotId, selectedBot?.id]);

  const categories = ["all", ...new Set(commands.map((command) => command.category).filter(Boolean))];
  const filtered = commands.filter((command) => {
    const matchesSearch = `${command.name} ${command.description} ${command.sourceFile}`.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = category === "all" || command.category === category;
    return matchesSearch && matchesCategory;
  });

  return (
    <PanelCard title="Commandes detectees" action={<BotSelect bots={bots} value={selectedBot?.id} onChange={setSelectedBotId} />}>
      <Toolbar>
        <div className="search-box"><SearchIcon size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher" /></div>
        <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
          {categories.map((item) => <option key={item} value={item}>{item === "all" ? "Toutes categories" : item}</option>)}
        </select>
      </Toolbar>
      <div className="mt-4 divide-y divide-mist-200 overflow-hidden rounded-xl border border-mist-200 dark:divide-mist-800 dark:border-mist-800">
        {filtered.map((command) => (
          <details key={command.id} className="group bg-snow p-4 open:bg-mist-50 transition-colors duration-200 dark:bg-[#1A1612] dark:open:bg-mist-900/30">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-smoke dark:text-mist-100">
              <span className="font-semibold">{command.type === "slash" ? "/" : "!"}{command.name}</span>
              <span className="text-sm text-mist-500">{command.category}</span>
            </summary>
            <div className="mt-3 grid gap-2 text-sm text-mist-700 sm:grid-cols-2 dark:text-mist-300">
              <p>{command.description || "Sans description"}</p>
              <p>{command.permissions || "Permissions non detectees"}</p>
              <p className="text-smoke dark:text-mist-100 font-medium">{command.example}</p>
              <p className="text-xs opacity-70">{command.sourceFile}</p>
            </div>
          </details>
        ))}
      </div>
      {!filtered.length && <EmptyState icon={FileCodeIcon} title="Aucune commande" text="Relance le scan du bot si necessaire." />}
    </PanelCard>
  );
}

function LogsView({ logs, bots, selectedBotId, setSelectedBotId }) {
  const [level, setLevel] = useState("all");
  const [search, setSearch] = useState("");
  const [source, setSource] = useState("all");
  const [rows, setRows] = useState(logs);

  useEffect(() => setRows(logs), [logs]);

  const load = async () => {
    const params = new URLSearchParams();
    if (selectedBotId) params.set("botId", selectedBotId);
    if (level !== "all") params.set("level", level);
    if (source !== "all") params.set("source", source);
    if (search) params.set("search", search);
    params.set("limit", "500");
    const response = await api.get(`/logs?${params.toString()}`);
    setRows(response.data.logs);
  };

  const exportLogs = () => {
    const params = new URLSearchParams();
    if (selectedBotId) params.set("botId", selectedBotId);
    if (level !== "all") params.set("level", level);
    if (search) params.set("search", search);
    downloadFromApi(`/logs/export?${params.toString()}`, "myos-panel-logs.txt");
  };

  const purge = async () => {
    if (!confirm("Supprimer tous les logs filtres ? Cette action est irreversible.")) return;
    const params = new URLSearchParams();
    if (selectedBotId) params.set("botId", selectedBotId);
    await api.delete(`/logs?${params.toString()}`);
    setRows([]);
  };

  const sources = ["all", ...new Set(rows.map((log) => log.source).filter(Boolean))];

  return (
    <PanelCard title="Logs avances" action={
      <div className="flex gap-2">
        <button className="secondary-button" onClick={purge}><TrashIcon size={16} /> Purger</button>
        <button className="secondary-button" onClick={exportLogs}><DownloadIcon size={16} /> Export</button>
      </div>
    }>
      <Toolbar>
        <BotSelect bots={bots} value={selectedBotId || ""} onChange={setSelectedBotId} allowAll />
        <select className="select" value={level} onChange={(event) => setLevel(event.target.value)}>
          <option value="all">Tous niveaux</option>
          <option value="info">INFO</option>
          <option value="warning">WARNING</option>
          <option value="error">ERROR</option>
          <option value="debug">DEBUG</option>
        </select>
        <select className="select" value={source} onChange={(event) => setSource(event.target.value)}>
          <option value="all">Toutes sources</option>
          {sources.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
        </select>
        <div className="search-box"><SearchIcon size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Message" /></div>
        <button className="secondary-button" onClick={load}><ListFilterIcon size={16} /> Filtrer</button>
      </Toolbar>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <MiniStat label="Total" value={rows.length} />
        <MiniStat label="Errors" value={rows.filter((l) => l.level === "error").length} />
        <MiniStat label="Warnings" value={rows.filter((l) => l.level === "warning").length} />
      </div>
      <div className="mt-4">
        <LogList logs={rows} dense />
      </div>
    </PanelCard>
  );
}

function StorageView({ storage }) {
  const breakdown = storage?.breakdown || {};
  const disk = storage?.disk;

  return (
    <div className="space-y-5 animate-fadeIn">
      {disk && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <MetricCard icon={DatabaseIcon} label="Stockage total" value={formatBytes(disk.total)} detail={`Systeme de fichiers: ${disk.fs || "N/A"}`} />
            <MetricCard icon={HardDriveIcon} label="Utilise" value={formatBytes(disk.used)} detail={`${disk.use}% du disque`} />
            <MetricCard icon={HardDriveIcon} label="Libre" value={formatBytes(disk.available)} detail={`Montage: ${disk.mount || "/"}`} />
          </div>
          <PanelCard title="Utilisation du disque">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-mist-500">{formatBytes(disk.used)} utilise</span>
                <span className="font-semibold text-smoke dark:text-mist-100">{disk.use}%</span>
                <span className="text-mist-500">{formatBytes(disk.total)} total</span>
              </div>
              <div className="h-4 w-full rounded-full bg-mist-200 dark:bg-mist-800 overflow-hidden shadow-inner">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${Math.min(disk.use, 100)}%`,
                    background: disk.use > 90 ? "linear-gradient(90deg, #C4645A, #DDA15E)" : disk.use > 70 ? "linear-gradient(90deg, #DDA15E, #5B8C6F)" : "linear-gradient(90deg, #5B8C6F, #5B8C6F)"
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-mist-400">
                <span>0%</span>
                <span>50%</span>
                <span>100%</span>
              </div>
            </div>
          </PanelCard>
        </>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard icon={BotIcon} label="Bots" value={formatBytes(breakdown.bots || 0)} detail="Projets Discord" />
        <MetricCard icon={ArchiveIcon} label="Sauvegardes" value={formatBytes(breakdown.backups || 0)} detail="Archives ZIP" />
        <MetricCard icon={DatabaseIcon} label="Panel & DB" value={formatBytes((breakdown.panel || 0) + (breakdown.database || 0))} detail="Application" />
      </div>
      <PanelCard title="Repartition detaillee">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(breakdown).map(([key, value]) => <MiniStat key={key} label={key} value={formatBytes(value)} />)}
        </div>
      </PanelCard>
      <PanelCard title="Par bot">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Bot</th><th>Projet</th><th>node_modules</th><th>Sauvegardes</th><th>Total</th></tr></thead>
            <tbody>
              {(storage?.perBot || []).map((bot) => (
                <tr key={bot.id}><td className="font-medium">{bot.name}</td><td>{formatBytes(bot.project)}</td><td>{formatBytes(bot.nodeModules)}</td><td>{formatBytes(bot.backups)}</td><td className="font-semibold">{formatBytes(bot.total)}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

function UsersView({ users, currentUser, refresh, addToast }) {
  const [form, setForm] = useState({ username: "", name: "", password: "", role: "readonly" });

  const create = async (event) => {
    event.preventDefault();
    try {
      await api.post("/users", form);
      setForm({ username: "", name: "", password: "", role: "readonly" });
      addToast("Utilisateur cree.", "success");
      refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Creation impossible.", "error");
    }
  };

  if (currentUser.role !== "admin") {
    return <EmptyState icon={ShieldIcon} title="Reserve aux administrateurs" text="Ton role ne permet pas de gerer les utilisateurs." />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr] animate-fadeIn">
      <PanelCard title="Ajouter utilisateur">
        <form className="space-y-3" onSubmit={create}>
          <input className="input" placeholder="Nom d'utilisateur" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          <input className="input" placeholder="Nom" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <input className="input" placeholder="Mot de passe" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          <select className="select w-full" value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
            <option value="readonly">Lecture seule</option>
            <option value="moderator">Moderateur</option>
            <option value="admin">Administrateur</option>
          </select>
          <button className="primary-button w-full"><PlusIcon size={18} /> Ajouter</button>
        </form>
      </PanelCard>
      <PanelCard title="Comptes">
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead><tr><th>Nom</th><th>Nom d&apos;utilisateur</th><th>Role</th><th>Actif</th></tr></thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id}><td className="font-medium">{item.name}</td><td>{item.username}</td><td className="capitalize">{item.role}</td><td>{item.active ? <span className="status-pill pill-online">Oui</span> : <span className="status-pill pill-stopped">Non</span>}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </PanelCard>
    </div>
  );
}

function BackupsView({ backups, refresh, addToast }) {
  const download = async (backup) => {
    try {
      await downloadFromApi(`/backups/${backup.id}/download`, `${backup.botName || "bot"}-backup.zip`);
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Telechargement impossible.", "error");
    }
  };

  const restore = async (backup) => {
    if (!confirm(`Restaurer la sauvegarde de ${backup.botName || backup.botId} ? Une sauvegarde automatique sera creee avant.`)) return;
    try {
      await api.post(`/backups/${backup.id}/restore`);
      addToast("Restauration lancee.", "success");
      refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Restauration impossible.", "error");
    }
  };

  const remove = async (backup) => {
    if (!confirm(`Supprimer definitivement cette sauvegarde ?`)) return;
    try {
      await api.delete(`/backups/${backup.id}`);
      addToast("Sauvegarde supprimee.", "success");
      await refresh();
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Suppression impossible.", "error");
    }
  };

  return (
    <PanelCard title="Sauvegardes">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Bot</th><th>Date</th><th>Taille</th><th>Note</th><th>Actions</th></tr></thead>
          <tbody>
            {backups.map((backup) => (
              <tr key={backup.id}>
                <td className="font-medium">{backup.botName || backup.botId}</td>
                <td>{new Date(backup.createdAt).toLocaleString()}</td>
                <td>{formatBytes(backup.sizeBytes)}</td>
                <td className="text-mist-500">{backup.note || ""}</td>
                <td className="flex gap-2">
                  <IconButton title="Telecharger" onClick={() => download(backup)}><DownloadIcon size={16} /></IconButton>
                  <IconButton title="Restaurer" onClick={() => restore(backup)}><RotateIcon size={16} /></IconButton>
                  <IconButton title="Supprimer" onClick={() => remove(backup)}><TrashIcon size={16} /></IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!backups.length && <EmptyState icon={ArchiveIcon} title="Aucune sauvegarde" text="Utilise le bouton sauvegarder sur une fiche bot." />}
    </PanelCard>
  );
}

function SettingsView({ metrics, darkMode, toggleDarkMode, wallpaper, saveWallpaper, removeWallpaper, addToast }) {
  const fileRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [permissions, setPermissions] = useState(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permNotice, setPermNotice] = useState("");

  useEffect(() => {
    api.get("/settings/role-permissions").then((res) => setPermissions(res.data.permissions)).catch(() => null);
  }, []);

  const savePermissions = async () => {
    setPermLoading(true);
    try {
      await api.put("/settings/role-permissions", { permissions });
      setPermNotice("Permissions sauvegardees.");
      setTimeout(() => setPermNotice(""), 3000);
    } catch {
      setPermNotice("Erreur lors de la sauvegarde.");
    } finally {
      setPermLoading(false);
    }
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!selectedFile) return;
    const form = new FormData();
    form.append("wallpaper", selectedFile);
    try {
      await api.post("/settings/wallpaper", form);
      const reader = new FileReader();
      reader.onload = (e) => {
        saveWallpaper(e.target.result);
      };
      reader.readAsDataURL(selectedFile);
    } catch (err) {
      addToast(err.response?.data?.error?.message || "Upload du fond impossible.", "error");
      return;
    }
    setPreview(null);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCancel = () => {
    setPreview(null);
    setSelectedFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="Apparence">
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-mist-50 p-4 dark:bg-mist-950/30">
              <div className="flex items-center gap-3">
                {darkMode ? <MoonIcon size={20} className="text-smoke dark:text-mist-100" /> : <SunIcon size={20} className="text-smoke dark:text-mist-100" />}
                <div>
                  <p className="font-semibold text-smoke dark:text-mist-100">Mode {darkMode ? "sombre" : "clair"}</p>
                  <p className="text-sm text-mist-500">{darkMode ? "Interface sombre active" : "Interface claire active"}</p>
                </div>
              </div>
              <DarkToggle darkMode={darkMode} onToggle={toggleDarkMode} />
            </div>
          </div>
        </PanelCard>

        <PanelCard title="Personnalisation">
          <div className="space-y-4">
            <div className="rounded-xl bg-mist-50 p-4 dark:bg-mist-950/30">
              <div className="flex items-center gap-3 mb-3">
                <ImageIcon size={20} className="text-smoke dark:text-mist-100" />
                <div>
                  <p className="font-semibold text-smoke dark:text-mist-100">Fond d&apos;ecran</p>
                  <p className="text-sm text-mist-500">Personnalise l&apos;arriere-plan du panel</p>
                </div>
              </div>
              {wallpaper && (
                <div className="relative mb-3 rounded-lg overflow-hidden border border-mist-200 dark:border-mist-800">
                  <img src={wallpaper} alt="Fond actuel" className="w-full h-32 object-cover" />
                  <button
                    onClick={removeWallpaper}
                    className="absolute top-2 right-2 h-8 w-8 flex items-center justify-center rounded-lg bg-clay-500/90 text-snow hover:bg-clay-600 transition-colors"
                    title="Supprimer le fond"
                  >
                    <XIcon size={16} />
                  </button>
                </div>
              )}
              {preview && (
                <div className="relative mb-3 rounded-lg overflow-hidden border-2 border-sage">
                  <img src={preview} alt="Apercu" className="w-full h-32 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center bg-smoke/20">
                    <span className="status-pill pill-online">Apercu</span>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <label className="secondary-button cursor-pointer flex-1">
                  <ImagePlusIcon size={16} />
                  {wallpaper ? "Changer" : "Uploader"}
                  <input ref={fileRef} className="sr-only" type="file" accept="image/*" onChange={handleFileChange} />
                </label>
                {preview && (
                  <>
                    <button className="primary-button" onClick={handleSave}>
                      <CheckCircleIcon size={16} /> Appliquer
                    </button>
                    <button className="secondary-button" onClick={handleCancel}>
                      <XIcon size={16} /> Annuler
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </PanelCard>
      </div>

      {permissions && (
        <PanelCard title="Gestion des roles" action={
          <button className="secondary-button text-xs" onClick={savePermissions} disabled={permLoading}>
            {permLoading ? <LoaderIcon size={14} /> : <CheckCircleIcon size={14} />}
            Sauvegarder
          </button>
        }>
          <div className="grid gap-4 md:grid-cols-3">
            <RoleCard
              role="admin"
              label="Administrateur"
              description="Acces complet a toutes les fonctionnalites."
              color="smoke"
              permissions={[
                { label: "Gerer les utilisateurs", value: true, locked: true },
                { label: "Gerer les bots", value: true, locked: true },
                { label: "Gerer les parametres", value: true, locked: true }
              ]}
            />
            <RoleCard
              role="moderator"
              label="Moderateur"
              description="Gestion des bots et supervision."
              color="earth"
              permissions={[
                {
                  label: "Gerer les utilisateurs",
                  value: permissions.moderator?.canManageUsers || false,
                  onChange: (v) => setPermissions((p) => ({ ...p, moderator: { ...p.moderator, canManageUsers: v } }))
                },
                {
                  label: "Gerer les bots",
                  value: permissions.moderator?.canManageBots !== false,
                  onChange: (v) => setPermissions((p) => ({ ...p, moderator: { ...p.moderator, canManageBots: v } }))
                }
              ]}
            />
            <RoleCard
              role="readonly"
              label="Lecture seule"
              description="Consultation uniquement, aucune modification."
              color="sage"
              permissions={[
                {
                  label: "Voir les logs",
                  value: permissions.readonly?.canViewLogs !== false,
                  onChange: (v) => setPermissions((p) => ({ ...p, readonly: { ...p.readonly, canViewLogs: v } }))
                },
                {
                  label: "Voir le stockage",
                  value: permissions.readonly?.canViewStorage !== false,
                  onChange: (v) => setPermissions((p) => ({ ...p, readonly: { ...p.readonly, canViewStorage: v } }))
                }
              ]}
            />
          </div>
          {permNotice && <p className="mt-3 text-sm text-smoke dark:text-mist-100 font-medium">{permNotice}</p>}
        </PanelCard>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <PanelCard title="Acces reseau">
          <InfoGrid rows={[
            ["Mode", "LAN uniquement"],
            ["Adresse", window.location.origin],
            ["Serveur", metrics?.hostname || "N/A"],
            ["Plateforme", metrics?.platform || "Linux cible"]
          ]} />
        </PanelCard>
        <PanelCard title="Production Linux">
          <InfoGrid rows={[
            ["HOST", "0.0.0.0"],
            ["PORT", "3000"],
            ["Reverse proxy", "Nginx optionnel"],
            ["Process manager", "PM2 pour les bots, systemd pour le panel"]
          ]} />
        </PanelCard>
      </div>

      <PanelCard title="A propos">
        <div className="flex items-start gap-4">
          <div className="brand-mark shrink-0">
            <InfoIcon size={22} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-smoke dark:text-mist-100">Myo&apos;s Panel v1.2</h3>
            <p className="text-sm text-mist-500 dark:text-mist-400 mt-1">
              Panel web LAN pour gerer plusieurs bots Discord Node.js avec PM2.
            </p>
            <p className="text-sm text-mist-500 dark:text-mist-400 mt-0.5">
              Created by &copy; 2026 Myo&apos;s Development. Tous droits reserves.
            </p>
            <div className="mt-3 flex gap-2">
              <a
                href="https://discord.gg/ZKP8VjxCfC"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#5865F2]/20 bg-[#5865F2]/10 px-3 py-2 text-sm font-medium text-[#5865F2] transition-all duration-200 hover:bg-[#5865F2]/20 hover:border-[#5865F2]/30 hover:shadow-md dark:border-[#5865F2]/30 dark:bg-[#5865F2]/15 dark:text-[#7983F5] dark:hover:bg-[#5865F2]/25"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Discord
              </a>
              <a
                href="https://github.com/7Myo"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-xl border border-[#333]/15 bg-[#333]/5 px-3 py-2 text-sm font-medium text-[#333] transition-all duration-200 hover:bg-[#333]/10 hover:border-[#333]/25 hover:shadow-md dark:border-[#EEE]/20 dark:bg-[#EEE]/10 dark:text-[#DDD] dark:hover:bg-[#EEE]/20"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </a>
            </div>
          </div>
        </div>
      </PanelCard>
    </div>
  );
}

function RoleCard({ role, label, description, color, permissions }) {
  const colorMap = {
    smoke: "bg-smoke text-snow dark:bg-snow dark:text-smoke",
    earth: "bg-earth-100 text-earth-800 dark:bg-earth-400/15 dark:text-earth-200",
    sage: "bg-sage-100 text-sage-800 dark:bg-sage-400/15 dark:text-sage-200"
  };
  return (
    <div className="rounded-xl border border-mist-200/60 bg-mist-50 p-4 dark:border-mist-800/60 dark:bg-mist-950/30">
      <div className="flex items-center gap-2 mb-3">
        <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-bold uppercase ${colorMap[color] || colorMap.smoke}`}>
          {role}
        </span>
        <span className="font-semibold text-sm text-smoke dark:text-mist-100">{label}</span>
      </div>
      <p className="text-xs text-mist-500 dark:text-mist-400 mb-3">{description}</p>
      <div className="space-y-2">
        {permissions.map((perm) => (
          <label key={perm.label} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${perm.locked ? "bg-mist-100 dark:bg-mist-900/50" : "bg-snow dark:bg-[#1A1612] hover:bg-mist-50 dark:hover:bg-mist-800/50 cursor-pointer transition-colors"}`}>
            <span className={perm.locked ? "text-mist-500 dark:text-mist-400" : "text-smoke dark:text-mist-100"}>{perm.label}</span>
            {perm.locked ? (
              <span className="text-xs font-semibold text-smoke dark:text-mist-100">Toujours</span>
            ) : (
              <input
                type="checkbox"
                checked={perm.value}
                onChange={(e) => perm.onChange?.(e.target.checked)}
                className="h-4 w-4" style={{ accentColor: "#100C08" }}
              />
            )}
          </label>
        ))}
      </div>
    </div>
  );
}

function Brand({ compact = false }) {
  return (
    <div className="flex items-center gap-3">
      <div className="brand-mark">
        <BotIcon size={22} />
      </div>
      {!compact && (
        <div>
          <p className="text-lg font-bold text-smoke dark:text-mist-100">Myo&apos;s Panel</p>
          <p className="text-xs text-mist-500 dark:text-mist-400">Discord bots manager</p>
        </div>
      )}
    </div>
  );
}

function Splash() {
  return <div className="flex min-h-screen items-center justify-center bg-snow dark:bg-smoke"><LoaderIcon size={32} /></div>;
}

function LoginStat({ icon: Icon, label }) {
  return <div className="flex items-center gap-2 rounded-xl border border-mist-200/60 bg-snow p-3 text-sm font-medium shadow-sm dark:border-mist-800/60 dark:bg-[#1A1612] text-smoke dark:text-mist-100 hover:shadow-md transition-shadow duration-200"><Icon size={18} /> {label}</div>;
}

function PanelCard({ title, action, children }) {
  return (
    <section className="panel-card">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-smoke dark:text-mist-100">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail }) {
  const toneClass = "bg-smoke text-snow dark:bg-snow dark:text-smoke";
  return (
    <div className="rounded-2xl border border-mist-200/60 bg-snow p-5 shadow-sm transition-all duration-200 hover:shadow-card dark:border-mist-800/60 dark:bg-[#1A1612] sm:p-5">              <div className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl ${toneClass} shadow-sm`}><Icon size={20} /></div>
      <p className="text-sm text-mist-500 dark:text-mist-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-smoke dark:text-mist-100">{value}</p>
      <p className="mt-1 text-sm text-mist-500 dark:text-mist-400">{detail}</p>
    </div>
  );
}

function MiniStat({ label, value }) {
  return <div className="rounded-xl bg-mist-50 p-3 dark:bg-mist-900/20"><p className="text-xs uppercase tracking-wide text-mist-500 dark:text-mist-400">{label}</p><p className="mt-1 truncate font-semibold text-smoke dark:text-mist-100">{value}</p></div>;
}

function InfoGrid({ rows }) {
  return (
    <dl className="grid gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="grid gap-1 rounded-xl bg-mist-50 p-3 text-sm dark:bg-mist-900/20 sm:grid-cols-[150px_1fr]">
          <dt className="text-mist-500 dark:text-mist-400">{label}</dt>
          <dd className="min-w-0 break-words font-medium text-smoke dark:text-mist-100">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function StatusPill({ status, label }) {
  const state = status === "online" ? "pill-online" : status === "errored" ? "pill-error" : status === "stopped" ? "pill-stopped" : "pill-idle";
  return <span className={`status-pill ${state}`}>{label || status || "unknown"}</span>;
}

function IconButton({ title, onClick, children }) {
  return <button className="icon-button" title={title} aria-label={title} onClick={onClick}>{children}</button>;
}

function ActionButton({ icon: Icon, label, loading, onClick, tone = "default" }) {
  const toneClass = tone === "danger"
    ? "!bg-[#3A1515] !border-[#5A2020] !text-[#FFCCCC] hover:!bg-[#4A2020] dark:!bg-[#FFCCCC] dark:!text-[#3A1515] dark:!border-[#FFCCCC] dark:hover:!bg-[#FFDDDD]"
    : "";
  return <button className={`secondary-button ${toneClass}`} onClick={onClick} disabled={loading}>{loading ? <LoaderIcon size={16} /> : <Icon size={16} />}{label}</button>;
}

function BotSelect({ bots, value, onChange, allowAll = false }) {
  return (
    <select className="select" value={value || ""} onChange={(event) => onChange(event.target.value || null)}>
      {allowAll && <option value="">Tous les bots</option>}
      {bots.map((bot) => <option key={bot.id} value={bot.id}>{bot.name}</option>)}
    </select>
  );
}

function Toolbar({ children }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>;
}

function LogList({ logs, dense = false }) {
  if (!logs.length) return <EmptyState icon={TerminalIcon} title="Aucun log" text="Les nouveaux evenements apparaitront ici." />;
  return (
    <div className={`log-list ${dense ? "max-h-[620px]" : "max-h-80"}`}>
      {logs.map((log) => (
        <div key={log.id} className="grid gap-2 border-b border-mist-800/40 px-3 py-2 text-sm sm:grid-cols-[140px_85px_1fr]">
          <span className="text-mist-400">{new Date(log.createdAt).toLocaleTimeString()}</span>
          <span className={`font-semibold ${log.level === "error" ? "text-clay-300" : log.level === "warning" ? "text-earth-300" : "text-sage-200"}`}>{log.level.toUpperCase()}</span>
          <span className="break-words text-mist-100">{log.message}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-mist-300 p-8 text-center dark:border-mist-700">
      <Icon className="mx-auto text-mist-400" size={28} />
      <p className="mt-3 font-semibold text-smoke dark:text-mist-100">{title}</p>
      <p className="mt-1 text-sm text-mist-500 dark:text-mist-400">{text}</p>
    </div>
  );
}

function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null;
  return (
    <div className="pointer-events-none fixed left-4 right-4 top-4 z-50 flex w-auto max-w-sm flex-col gap-2 sm:left-auto sm:w-full">
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={() => onRemove(toast.id)} />
      ))}
    </div>
  );
}

function Toast({ id, message, type, onClose }) {
  const [exiting, setExiting] = useState(false);

  const handleClose = () => {
    setExiting(true);
    setTimeout(onClose, 300);
  };

  const config = {
    success: { icon: CheckCircleIcon, bg: "bg-sage-50 border-sage-200 text-sage-800 dark:bg-sage-950 dark:border-sage-800 dark:text-sage-200", bar: "bg-sage-500" },
    error: { icon: AlertTriangleIcon, bg: "bg-clay-50 border-clay-200 text-clay-800 dark:bg-clay-950 dark:border-clay-800 dark:text-clay-200", bar: "bg-clay-500" },
    warning: { icon: AlertTriangleIcon, bg: "bg-earth-50 border-earth-200 text-earth-800 dark:bg-earth-950 dark:border-earth-800 dark:text-earth-200", bar: "bg-earth-500" },
    info: { icon: InfoIcon, bg: "bg-sage-50 border-sage-200 text-sage-800 dark:bg-sage-950 dark:border-sage-800 dark:text-sage-200", bar: "bg-sage-500" }
  }[type] || { icon: InfoIcon, bg: "bg-sage-50 border-sage-200 text-sage-800 dark:bg-sage-950 dark:border-sage-800 dark:text-sage-200", bar: "bg-sage-500" };

  const Icon = config.icon;

  return (
    <div className={`pointer-events-auto rounded-2xl border-2 p-4 shadow-2xl ring-1 ring-smoke/5 dark:ring-snow/5 ${exiting ? "animate-toastOut" : "animate-toastIn"} ${config.bg} backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <Icon size={18} className="shrink-0 mt-0.5" />
        <p className="flex-1 text-sm font-medium leading-snug">{message}</p>
        <button onClick={handleClose} className="shrink-0 opacity-60 hover:opacity-100 transition-opacity">
          <XIcon size={15} />
        </button>
      </div>
      <div className={`mt-2 h-1 rounded-full ${config.bar} toast-progress`} />
    </div>
  );
}

function titleFor(view) {
  return navItems.find((item) => item.id === view)?.label || "Dashboard";
}

function pushMetric(history, metrics) {
  const memoryUse = metrics?.memory?.total ? (metrics.memory.used / metrics.memory.total) * 100 : 0;
  return [
    ...history,
    {
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      cpu: metrics?.cpu?.load || 0,
      memory: Math.round(memoryUse)
    }
  ].slice(-24);
}
