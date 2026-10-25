import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ||
  "http://localhost:3001";

const TOKEN_KEY = "moriesly_admin_token";
const DELETION_PREVIEW_MODE =
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).get("preview") === "deletions";

const previewDeletionRequests = [
  {
    id: "DEL-1048",
    displayName: "Nadia Putri",
    email: "nadia.putri@example.com",
    userCreatedAt: "2025-03-18T08:30:00.000Z",
    requestedAt: "2026-10-24T04:15:00.000Z",
    deadlineAt: "2026-10-27T16:59:00.000Z",
    reason: "Sudah tidak menggunakan layanan dan ingin seluruh data dihapus.",
    status: "pending",
    source: "Aplikasi iOS",
  },
  {
    id: "DEL-1047",
    displayName: "Rizky Mahendra",
    email: "rizky.m@example.com",
    userCreatedAt: "2024-11-02T10:10:00.000Z",
    requestedAt: "2026-10-23T09:45:00.000Z",
    deadlineAt: "2026-10-30T16:59:00.000Z",
    reason: "Membuat akun baru dengan alamat email lain.",
    status: "pending",
    source: "Web",
  },
  {
    id: "DEL-1046",
    displayName: "Salsa Anindya",
    email: "salsa.a@example.com",
    userCreatedAt: "2025-08-14T02:20:00.000Z",
    requestedAt: "2026-10-21T13:05:00.000Z",
    deadlineAt: "2026-10-28T16:59:00.000Z",
    reason: "Alasan privasi.",
    status: "processing",
    source: "Aplikasi Android",
  },
  {
    id: "DEL-1042",
    displayName: "Bima Prakoso",
    email: "bima.p@example.com",
    userCreatedAt: "2024-06-09T06:00:00.000Z",
    requestedAt: "2026-10-12T03:25:00.000Z",
    deadlineAt: "2026-10-19T16:59:00.000Z",
    reason: "Tidak membutuhkan akun lagi.",
    status: "completed",
    source: "Web",
  },
];

const menus = [
  { name: "Dashboard", icon: "⌂" },
  { name: "Users", icon: "♙" },
  { name: "Permintaan Hapus", icon: "♲" },
  { name: "Plans", icon: "◇" },
  { name: "Subscriptions", icon: "▣" },
  { name: "Features & Limits", icon: "⚙" },
  { name: "Activity Logs", icon: "◴" },
  { name: "Settings", icon: "◌" },
];

const subscriptionStatusOptions = ["trial", "active", "expired", "cancelled"];
const userStatusOptions = ["active", "suspended", "deleted"];
const roleOptions = ["user", "admin"];
const deletionStatusOptions = ["", "pending", "processing", "completed", "rejected"];

function titleCase(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatPlan(plan) {
  if (plan === "pro_max") return "Pro Max";
  return titleCase(plan || "free");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function deletionStatusLabel(status) {
  const labels = {
    pending: "Menunggu",
    processing: "Diproses",
    completed: "Selesai",
    rejected: "Ditolak",
  };
  return labels[status] || titleCase(status || "pending");
}

function deletionStatusType(status) {
  const types = {
    pending: "yellow",
    processing: "blue",
    completed: "green",
    rejected: "red",
  };
  return types[status] || "gray";
}

function daysUntil(value) {
  if (!value) return null;
  const deadline = new Date(value);
  if (Number.isNaN(deadline.getTime())) return null;
  return Math.ceil((deadline.getTime() - Date.now()) / 86400000);
}

function normalizeDeletionRequest(request, index) {
  const user = request.user || {};
  return {
    ...request,
    id: request.id || request.requestId || `request-${index}`,
    userId: request.userId || user.userId || user.id,
    displayName: request.displayName || user.displayName || user.name,
    email: request.email || user.email,
    userCreatedAt: request.userCreatedAt || user.createdAt,
    requestedAt: request.requestedAt || request.createdAt,
    deadlineAt:
      request.deadlineAt || request.scheduledDeletionAt || request.expiresAt,
    source: request.source || request.requestSource,
    status: request.status || "pending",
    dataScopes: request.dataScopes || request.affectedData || [],
  };
}

function toDateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
}

function initials(name) {
  return String(name || "User")
    .split(" ")
    .filter(Boolean)
    .map((item) => item[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function badgeType(value) {
  const key = String(value || "").toLowerCase();
  if (key === "admin" || key === "pro_max") return "purple";
  if (key === "pro max" || key === "pro-max" || key === "promax") return "purple";
  if (key === "pro" || key === "trial") return "blue";
  if (key === "active") return "green";
  if (key === "expired" || key === "cancelled" || key === "suspended") {
    return "red";
  }
  return "gray";
}

async function apiRequest(path, { token, method = "GET", body, signal } = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    signal,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload?.message || payload?.error || `Request gagal (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

function Badge({ children, type = "gray" }) {
  const styles = {
    gray: "bg-gray-100 text-gray-600",
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-red-50 text-red-600",
    yellow: "bg-amber-50 text-amber-700",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${styles[type]}`}
    >
      {children}
    </span>
  );
}

function StatCard({ title, value, description, icon }) {
  return (
    <div className="flex justify-between rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <div>
        <p className="mb-2 text-sm text-gray-500">{title}</p>
        <h2 className="text-3xl font-bold tracking-tight text-gray-900">
          {value}
        </h2>
        <p className="mt-2 text-xs text-gray-400">{description}</p>
      </div>
      <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-50 text-lg text-violet-600">
        {icon}
      </div>
    </div>
  );
}

function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div>
        <h2 className="text-lg font-bold">{title}</h2>
        {subtitle ? <p className="text-sm text-gray-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

function EmptyState({ title, subtitle }) {
  return (
    <div className="rounded-lg border border-dashed border-gray-200 bg-white py-12 text-center">
      <p className="font-semibold text-gray-700">{title}</p>
      <p className="mt-1 text-sm text-gray-400">{subtitle}</p>
    </div>
  );
}

function ToastBubble({ toast, onClose }) {
  if (!toast) return null;

  const styles =
    toast.type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className="fixed right-5 top-5 z-[60] w-[calc(100%-2.5rem)] max-w-sm">
      <div
        className={`flex items-start justify-between gap-3 rounded-lg border px-4 py-3 shadow-lg ${styles}`}
      >
        <div>
          <p className="text-sm font-bold">
            {toast.type === "error" ? "Gagal" : "Berhasil"}
          </p>
          <p className="mt-0.5 text-sm">{toast.message}</p>
        </div>
        <button
          onClick={onClose}
          className="text-lg leading-none opacity-60 hover:opacity-100"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function LoginGate({
  email,
  password,
  setEmail,
  setPassword,
  onLogin,
  loading,
  error,
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f7f8fc] p-5">
      <div className="w-full max-w-lg rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-violet-600 font-bold text-white">
            M
          </div>
          <div>
            <h1 className="text-xl font-bold">Moriesly Admin</h1>
            <p className="text-sm text-gray-400">{API_BASE_URL}</p>
          </div>
        </div>

        <label className="mb-2 block text-xs font-semibold text-gray-600">
          Email
        </label>
        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          placeholder="admin@example.com"
        />

        <label className="mb-2 mt-4 block text-xs font-semibold text-gray-600">
          Password
        </label>
        <input
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onLogin();
          }}
          type="password"
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-violet-400"
          placeholder="Password"
        />

        {error ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
            {error}
          </p>
        ) : null}

        <button
          onClick={onLogin}
          disabled={!email.trim() || !password || loading}
          className="mt-4 w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-300"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

function Sidebar({ activeMenu, setActiveMenu, onLogout }) {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-gray-200 bg-white p-4 md:flex">
      <div className="mb-8 flex items-center gap-3 px-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-600 font-bold text-white">
          M
        </div>
        <div>
          <h1 className="font-bold">Moriesly</h1>
          <p className="text-xs text-gray-400">Admin Console</p>
        </div>
      </div>

      <nav className="space-y-1">
        {menus.map((menu) => (
          <button
            key={menu.name}
            onClick={() => setActiveMenu(menu.name)}
            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition ${
              activeMenu === menu.name
                ? "bg-violet-50 font-semibold text-violet-600"
                : "text-gray-500 hover:bg-gray-50 hover:text-gray-900"
            }`}
          >
            <span className="w-5 text-center text-lg">{menu.icon}</span>
            {menu.name}
          </button>
        ))}
      </nav>

      <div className="mt-auto border-t border-gray-100 pt-4">
        <button
          onClick={onLogout}
          className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
        >
          Sign Out
        </button>
      </div>
    </aside>
  );
}

function MobileMenu({ activeMenu, setActiveMenu }) {
  return (
    <label className="mb-6 block md:hidden">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
        Menu admin
      </span>
      <select
        value={activeMenu}
        onChange={(event) => setActiveMenu(event.target.value)}
        className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm outline-none focus:border-violet-400"
      >
        {menus.map((menu) => (
          <option key={menu.name} value={menu.name}>
            {menu.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function DashboardView({ overview, plans, onSeedPlans, seedLoading }) {
  const usersByPlan = overview?.usersByPlan || {};
  const subs = overview?.subscriptionsByStatus || {};
  const totalUsers = overview?.totalUsers ?? 0;

  return (
    <>
      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Total Users"
          value={totalUsers}
          description="All registered accounts"
          icon="♙"
        />
        <StatCard
          title="Free Plan"
          value={usersByPlan.free ?? 0}
          description="Current free users"
          icon="○"
        />
        <StatCard
          title="Pro Users"
          value={usersByPlan.pro ?? 0}
          description="Active Pro plan"
          icon="◆"
        />
        <StatCard
          title="Pro Max"
          value={usersByPlan.pro_max ?? usersByPlan["pro max"] ?? 0}
          description="Highest paid plan"
          icon="◇"
        />
      </section>

      <section className="mb-8 grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionHeader
            title="Plans Overview"
            subtitle="Plan configuration loaded from backend data."
            action={
              <button
                onClick={onSeedPlans}
                disabled={seedLoading}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {seedLoading ? "Seeding..." : "Seed Defaults"}
              </button>
            }
          />

          <div className="grid gap-4 lg:grid-cols-3">
            {plans.map((plan) => (
              <PlanCard key={plan.id} plan={plan} />
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
          <SectionHeader title="Subscription Status" />
          <div className="space-y-3">
            {subscriptionStatusOptions.map((status) => (
              <div
                key={status}
                className="flex items-center justify-between rounded-lg bg-gray-50 px-4 py-3"
              >
                <div className="flex items-center gap-2">
                  <Badge type={badgeType(status)}>{titleCase(status)}</Badge>
                </div>
                <span className="text-sm font-semibold text-gray-700">
                  {subs[status] ?? 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

function PlanCard({ plan, onEdit }) {
  const limits = plan.limits || {};
  const visibleLimits = [
    ["Scan / day", limits.scanCount],
    ["Chat / day", limits.chatCount],
    ["Video minutes", limits.videoCallMinutesPerMonth],
  ];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex justify-between gap-3">
        <div>
          <Badge type={badgeType(plan.id)}>{plan.name || formatPlan(plan.id)}</Badge>
          <h3 className="mt-4 text-2xl font-bold">{formatPlan(plan.id)}</h3>
          <p className="mt-1 text-xs text-gray-400">
            {plan.status || "active"} · {plan.source || "firestore"}
          </p>
        </div>
        {onEdit ? (
          <button
            onClick={() => onEdit(plan)}
            className="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-violet-300 hover:text-violet-600"
          >
            Edit
          </button>
        ) : null}
      </div>

      <div className="my-5 border-y border-gray-100 py-4">
        <div className="text-xl font-bold">
          {Array.isArray(limits.allowedScanTypes)
            ? limits.allowedScanTypes.length
            : 0}
        </div>
        <span className="text-xs text-gray-400">scan types enabled</span>
      </div>

      <div className="space-y-3">
        {visibleLimits.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-semibold text-gray-800">
              {value === null ? "Unlimited" : (value ?? "-")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function UsersView({
  users,
  plans,
  filters,
  setFilters,
  pagination,
  setPage,
  onOpenUser,
  loading,
}) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        title="User Management"
        subtitle="Manage user access, roles, subscriptions, and quota usage."
      />

      <div className="mb-5 flex flex-col gap-3 xl:flex-row">
        <div className="flex flex-1 items-center rounded-lg border border-gray-200 px-3 focus-within:border-violet-400">
          <span className="text-gray-400">⌕</span>
          <input
            type="text"
            placeholder="Search user..."
            value={filters.search}
            onChange={(event) => {
              setPage(1);
              setFilters((current) => ({ ...current, search: event.target.value }));
            }}
            className="w-full bg-transparent px-3 py-2.5 text-sm outline-none"
          />
        </div>

        <select
          value={filters.plan}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, plan: event.target.value }));
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">All Plans</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name || formatPlan(plan.id)}
            </option>
          ))}
        </select>

        <select
          value={filters.role}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, role: event.target.value }));
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">All Roles</option>
          {roleOptions.map((role) => (
            <option key={role} value={role}>
              {titleCase(role)}
            </option>
          ))}
        </select>

        <select
          value={filters.status}
          onChange={(event) => {
            setPage(1);
            setFilters((current) => ({ ...current, status: event.target.value }));
          }}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none"
        >
          <option value="">All Status</option>
          {userStatusOptions.map((status) => (
            <option key={status} value={status}>
              {titleCase(status)}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[980px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Plan</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Usage</th>
              <th className="px-4 py-3 font-medium">Expired At</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>

          <tbody>
            {users.map((user) => (
              <UserRow key={user.userId} user={user} onOpenUser={onOpenUser} />
            ))}
          </tbody>
        </table>

        {users.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-semibold text-gray-600">
              {loading ? "Loading users..." : "No users found"}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              Try another keyword or filter.
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-gray-100 pt-4">
        <p className="text-xs text-gray-400">
          Showing {users.length} of {pagination.total} users
        </p>

        <div className="flex gap-1">
          <button
            onClick={() => setPage(Math.max(1, pagination.page - 1))}
            disabled={pagination.page <= 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            ‹
          </button>
          <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-violet-600 bg-violet-600 px-3 text-xs text-white">
            {pagination.page}
          </span>
          <button
            onClick={() =>
              setPage(Math.min(pagination.totalPages || 1, pagination.page + 1))
            }
            disabled={pagination.page >= (pagination.totalPages || 1)}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-xs text-gray-500 hover:bg-gray-50 disabled:opacity-40"
          >
            ›
          </button>
        </div>
      </div>
    </section>
  );
}

function UserRow({ user, onOpenUser }) {
  const usage = Number(user.usagePercent ?? 0);

  return (
    <tr className="border-t border-gray-100 transition hover:bg-gray-50/70">
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-600">
            {initials(user.displayName || user.email)}
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-800">
              {user.displayName || "Unnamed User"}
            </div>
            <div className="mt-0.5 text-xs text-gray-400">{user.email}</div>
          </div>
        </div>
      </td>

      <td className="px-4 py-4">
        <Badge type={badgeType(user.role)}>{titleCase(user.role)}</Badge>
      </td>
      <td className="px-4 py-4">
        <Badge type={badgeType(user.plan)}>{formatPlan(user.plan)}</Badge>
      </td>
      <td className="px-4 py-4">
        <Badge type={badgeType(user.status)}>{titleCase(user.status)}</Badge>
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-1.5 w-20 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-violet-600"
              style={{ width: `${Math.min(Math.max(usage, 0), 100)}%` }}
            />
          </div>
          <span className="text-xs text-gray-500">{usage}%</span>
        </div>
      </td>
      <td className="px-4 py-4 text-sm text-gray-500">
        {formatDate(user.expiredAt)}
      </td>
      <td className="px-4 py-4 text-right">
        <button
          onClick={() => onOpenUser(user)}
          className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-violet-300 hover:text-violet-600"
        >
          Manage
        </button>
      </td>
    </tr>
  );
}

function DeletionStatCard({ label, value, caption, tone = "violet" }) {
  const tones = {
    violet: "bg-violet-50 text-violet-600",
    amber: "bg-amber-50 text-amber-600",
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-gray-900">
            {value}
          </p>
          <p className="mt-1 text-xs text-gray-400">{caption}</p>
        </div>
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>
          <span className="h-2.5 w-2.5 rounded-full bg-current" />
        </div>
      </div>
    </div>
  );
}

function DeletionRequestsView({
  requests,
  summary,
  filters,
  setFilters,
  loading,
  error,
  onSelect,
  onRefresh,
}) {
  const counts = requests.reduce(
    (result, request) => ({
      ...result,
      [request.status]: (result[request.status] || 0) + 1,
    }),
    {},
  );
  const pending = summary.pending ?? counts.pending ?? 0;
  const processing = summary.processing ?? counts.processing ?? 0;
  const completed = summary.completedThisMonth ?? counts.completed ?? 0;
  const urgent =
    summary.urgent ??
    requests.filter((request) => {
      const remaining = daysUntil(request.deadlineAt);
      return request.status === "pending" && remaining !== null && remaining <= 2;
    }).length;

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DeletionStatCard
          label="Menunggu tinjauan"
          value={pending}
          caption="Perlu keputusan admin"
          tone="amber"
        />
        <DeletionStatCard
          label="Sedang diproses"
          value={processing}
          caption="Penghapusan sedang berjalan"
          tone="blue"
        />
        <DeletionStatCard
          label="Mendekati tenggat"
          value={urgent}
          caption="Kurang dari 48 jam"
          tone="violet"
        />
        <DeletionStatCard
          label="Selesai bulan ini"
          value={completed}
          caption="Permintaan terselesaikan"
          tone="green"
        />
      </section>

      <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-5 py-5 lg:px-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
            <div>
              <h2 className="text-lg font-bold text-gray-900">Daftar permintaan</h2>
              <p className="mt-1 text-sm text-gray-400">
                Tinjau identitas, alasan, dan tenggat sebelum mengambil tindakan.
              </p>
            </div>
            <button
              onClick={onRefresh}
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 transition hover:border-violet-200 hover:text-violet-600 disabled:opacity-50"
            >
              <span className={loading ? "animate-spin" : ""}>↻</span>
              {loading ? "Memuat..." : "Perbarui data"}
            </button>
          </div>

          <div className="mt-5 flex flex-col gap-3 lg:flex-row">
            <label className="flex flex-1 items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/60 px-3 focus-within:border-violet-400 focus-within:bg-white">
              <span className="text-gray-400">⌕</span>
              <input
                type="search"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                placeholder="Cari nama atau email pengguna..."
                className="w-full bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-400"
              />
            </label>
            <select
              value={filters.status}
              onChange={(event) =>
                setFilters((current) => ({ ...current, status: event.target.value }))
              }
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-600 outline-none focus:border-violet-400"
            >
              {deletionStatusOptions.map((status) => (
                <option key={status || "all"} value={status}>
                  {status ? deletionStatusLabel(status) : "Semua status"}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? (
          <div className="m-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <p className="font-semibold">Data permintaan belum dapat dimuat</p>
            <p className="mt-1 text-red-600">{error}</p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px]">
            <thead>
              <tr className="bg-gray-50/80 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                <th className="px-6 py-3.5">Pengguna</th>
                <th className="px-4 py-3.5">Diajukan</th>
                <th className="px-4 py-3.5">Alasan</th>
                <th className="px-4 py-3.5">Tenggat</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-6 py-3.5 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => {
                const remaining = daysUntil(request.deadlineAt);
                const urgentDeadline =
                  request.status === "pending" && remaining !== null && remaining <= 2;
                return (
                  <tr key={request.id} className="border-t border-gray-100 hover:bg-gray-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                          {initials(request.displayName || request.email)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-gray-800">
                            {request.displayName || "Pengguna tanpa nama"}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-gray-400">
                            {request.email || "-"}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm font-medium text-gray-700">
                        {formatDate(request.requestedAt)}
                      </p>
                      <p className="mt-0.5 text-xs text-gray-400">
                        {request.source || "Aplikasi"}
                      </p>
                    </td>
                    <td className="max-w-[240px] px-4 py-4">
                      <p className="truncate text-sm text-gray-600">
                        {request.reason || "Tidak ada alasan yang diberikan"}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <p className={`text-sm font-semibold ${urgentDeadline ? "text-red-600" : "text-gray-700"}`}>
                        {formatDate(request.deadlineAt)}
                      </p>
                      {remaining !== null && request.status === "pending" ? (
                        <p className={`mt-0.5 text-xs ${urgentDeadline ? "text-red-500" : "text-gray-400"}`}>
                          {remaining < 0
                            ? `Terlambat ${Math.abs(remaining)} hari`
                            : remaining === 0
                              ? "Jatuh tempo hari ini"
                              : `${remaining} hari lagi`}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-4">
                      <Badge type={deletionStatusType(request.status)}>
                        {deletionStatusLabel(request.status)}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => onSelect(request)}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-violet-300 hover:bg-violet-50 hover:text-violet-700"
                      >
                        Tinjau
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {!loading && !error && requests.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-xl text-emerald-600">
              ✓
            </div>
            <p className="mt-4 font-semibold text-gray-700">Tidak ada permintaan</p>
            <p className="mt-1 text-sm text-gray-400">
              Semua permintaan pada filter ini sudah ditangani.
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function DeletionRequestModal({ request, onClose, onResolve, saving }) {
  const [adminNote, setAdminNote] = useState(request.adminNote || "");
  const [confirmText, setConfirmText] = useState("");
  const [showConfirmation, setShowConfirmation] = useState(false);
  const canReview = request.status === "pending";
  const canComplete = request.status === "processing";

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/50 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold text-gray-900">Tinjau permintaan</h2>
              <Badge type={deletionStatusType(request.status)}>
                {deletionStatusLabel(request.status)}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-gray-400">ID: {request.id}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Tutup"
          >
            ×
          </button>
        </div>

        <div className="space-y-6 p-6">
          <div className="flex items-center gap-4 rounded-xl bg-gray-50 p-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">
              {initials(request.displayName || request.email)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">
                {request.displayName || "Pengguna tanpa nama"}
              </p>
              <p className="truncate text-sm text-gray-500">{request.email || "-"}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Terdaftar sejak</p>
              <p className="mt-1 text-sm font-semibold text-gray-700">
                {formatDate(request.userCreatedAt)}
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <SummaryBox label="Permintaan diajukan" value={formatDateTime(request.requestedAt)} />
            <SummaryBox label="Tenggat penyelesaian" value={formatDateTime(request.deadlineAt)} />
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Alasan pengguna
            </p>
            <p className="mt-2 rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 text-gray-600">
              {request.reason || "Pengguna tidak memberikan alasan tambahan."}
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              Data yang akan dihapus
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {(request.dataScopes?.length
                ? request.dataScopes
                : ["Profil dan preferensi", "Riwayat aktivitas", "File pengguna", "Data langganan"]
              ).map((scope) => (
                <div key={scope} className="flex items-center gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-red-100 text-[10px]">×</span>
                  {scope}
                </div>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-400">
              Catatan admin
            </span>
            <textarea
              value={adminNote}
              onChange={(event) => setAdminNote(event.target.value)}
              rows={3}
              disabled={!canReview && !canComplete}
              placeholder="Tambahkan alasan keputusan atau catatan internal..."
              className="w-full resize-none rounded-xl border border-gray-200 px-3 py-3 text-sm outline-none focus:border-violet-400 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </label>

          {showConfirmation ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-sm font-bold text-red-800">Konfirmasi penghapusan akun</p>
              <p className="mt-1 text-sm leading-6 text-red-700">
                Tindakan ini akan menghapus akun Firebase dan seluruh data pengguna secara permanen. Ketik
                <strong> HAPUS</strong> untuk melanjutkan.
              </p>
              <input
                autoFocus
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder="Ketik HAPUS"
                className="mt-3 w-full rounded-lg border border-red-200 bg-white px-3 py-2.5 text-sm font-semibold outline-none focus:border-red-400"
              />
            </div>
          ) : null}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/70 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            onClick={onClose}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Tutup
          </button>
          {canReview ? (
            <>
              <button
                onClick={() => onResolve(request.id, "rejected", adminNote)}
                disabled={saving || !adminNote.trim()}
                className="rounded-xl border border-red-200 bg-white px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Tolak permintaan
              </button>
              {showConfirmation ? (
                <button
                  onClick={() => onResolve(request.id, "completed", adminNote)}
                  disabled={saving || confirmText !== "HAPUS"}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300"
                >
                  {saving ? "Menghapus akun..." : "Setujui & hapus akun"}
                </button>
              ) : (
                <button
                  onClick={() => setShowConfirmation(true)}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700"
                >
                  Setujui & hapus akun
                </button>
              )}
            </>
          ) : null}
          {canComplete ? (
            <button
              onClick={() => onResolve(request.id, "completed", adminNote)}
              disabled={saving}
              className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving ? "Menghapus akun..." : "Hapus akun & selesaikan"}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlansView({ plans, onSeedPlans, onEditPlan, seedLoading }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        title="Plan Management"
        subtitle="Plan → Features → Limits, loaded from Firestore-backed data."
        action={
          <button
            onClick={onSeedPlans}
            disabled={seedLoading}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {seedLoading ? "Seeding..." : "Seed Defaults"}
          </button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} onEdit={onEditPlan} />
        ))}
      </div>
    </section>
  );
}

function FeaturesView({ featureMeta, plans }) {
  const limitKeys = featureMeta?.limits || [];

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        title="Features & Limits"
        subtitle="Compare every plan using the normalized limit keys."
      />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px]">
          <thead>
            <tr className="bg-gray-50 text-left text-[11px] uppercase tracking-wide text-gray-400">
              <th className="px-4 py-3 font-medium">Limit</th>
              {plans.map((plan) => (
                <th key={plan.id} className="px-4 py-3 font-medium">
                  {plan.name || formatPlan(plan.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {limitKeys.map((key) => (
              <tr key={key} className="border-t border-gray-100">
                <td className="px-4 py-3 text-sm font-semibold text-gray-700">
                  {key}
                </td>
                {plans.map((plan) => (
                  <td key={plan.id} className="px-4 py-3 text-sm text-gray-500">
                    {formatLimitValue(plan.limits?.[key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {limitKeys.length === 0 ? (
        <EmptyState
          title="No limits available"
          subtitle="Seed or create plans first."
        />
      ) : null}
    </section>
  );
}

function formatLimitValue(value) {
  if (value === null) return "Unlimited";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Enabled" : "Disabled";
  if (value === undefined) return "-";
  return String(value);
}

function SubscriptionsView({ users, onOpenUser }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader
        title="Subscription Management"
        subtitle="Upgrade, downgrade, cancel, and suspend from user detail."
      />

      <div className="grid gap-3">
        {users.map((user) => (
          <button
            key={user.userId}
            onClick={() => onOpenUser(user)}
            className="flex flex-col justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-violet-300 sm:flex-row sm:items-center"
          >
            <div>
              <p className="font-semibold text-gray-800">
                {user.displayName || user.email}
              </p>
              <p className="text-sm text-gray-400">{user.email}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge type={badgeType(user.plan)}>{formatPlan(user.plan)}</Badge>
              <Badge type={badgeType(user.subscriptionStatus)}>
                {titleCase(user.subscriptionStatus)}
              </Badge>
              <Badge type="gray">{formatDate(user.expiredAt)}</Badge>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function ActivityLogsView({ logs }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader title="Activity Logs" subtitle="Recent admin changes." />

      <div className="space-y-3">
        {logs.map((log) => (
          <div
            key={log.id}
            className="rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
          >
            <div className="flex flex-col justify-between gap-2 sm:flex-row">
              <div>
                <p className="font-semibold text-gray-800">{log.action}</p>
                <p className="text-xs text-gray-400">
                  {log.targetType} · {log.targetId}
                </p>
              </div>
              <p className="text-xs text-gray-400">{formatDate(log.createdAt)}</p>
            </div>
          </div>
        ))}
      </div>

      {logs.length === 0 ? (
        <EmptyState title="No activity yet" subtitle="Admin updates appear here." />
      ) : null}
    </section>
  );
}

function SettingsView({ token, onLogout }) {
  return (
    <section className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm">
      <SectionHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">
            API Base URL
          </p>
          <p className="mt-2 break-all text-sm font-semibold text-gray-800">
            {API_BASE_URL}
          </p>
        </div>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="text-xs font-semibold uppercase text-gray-400">
            Session
          </p>
          <p className="mt-2 text-sm font-semibold text-gray-800">
            {token ? "Signed in" : "Not connected"}
          </p>
        </div>
      </div>
      <button
        onClick={onLogout}
        className="mt-5 rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
      >
        Sign Out
      </button>
    </section>
  );
}

function UserModal({
  user,
  plans,
  onClose,
  onSaveRole,
  onSaveStatus,
  onSaveSubscription,
  saving,
}) {
  const [role, setRole] = useState(user.role || "user");
  const [status, setStatus] = useState(user.status || "active");
  const [subscription, setSubscription] = useState({
    plan: user.currentPlan || user.plan || "free",
    status: user.subscription?.status || user.subscriptionStatus || "active",
    startedAt: toDateInput(user.subscription?.startedAt),
    expiresAt: toDateInput(user.subscription?.expiredAt || user.expiredAt),
    source: user.subscription?.source || "admin",
    note: "",
  });

  const usageToday = user.usageToday || {};
  const quota = user.quota || {};

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Manage User</h2>
            <p className="mt-1 text-sm text-gray-400">{user.email}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="my-6 flex items-center gap-3 rounded-lg bg-gray-50 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
            {initials(user.displayName || user.email)}
          </div>
          <div>
            <h3 className="font-semibold">
              {user.displayName || "Unnamed User"}
            </h3>
            <p className="text-sm text-gray-400">{user.userId}</p>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SummaryBox label="Current Plan" value={formatPlan(user.currentPlan || user.plan)} />
          <SummaryBox label="Scans Today" value={`${usageToday.scanCount ?? 0} / ${quota.scanCount ?? "-"}`} />
          <SummaryBox label="Chats Today" value={`${usageToday.chatCount ?? 0} / ${quota.chatCount ?? "-"}`} />
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-4 font-semibold">Role & Status</h3>
            <label className="mb-2 block text-xs font-semibold text-gray-600">
              Role
            </label>
            <select
              value={role}
              onChange={(event) => setRole(event.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              {roleOptions.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>

            <label className="mb-2 block text-xs font-semibold text-gray-600">
              User Status
            </label>
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              className="mb-4 w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
            >
              {userStatusOptions.map((item) => (
                <option key={item} value={item}>
                  {titleCase(item)}
                </option>
              ))}
            </select>

            <div className="flex gap-2">
              <button
                onClick={() => onSaveRole(role)}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Save Role
              </button>
              <button
                onClick={() => onSaveStatus(status)}
                disabled={saving}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
              >
                Save Status
              </button>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            <h3 className="mb-4 font-semibold">Subscription</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <FieldSelect
                label="Plan"
                value={subscription.plan}
                onChange={(value) =>
                  setSubscription((current) => ({ ...current, plan: value }))
                }
                options={plans.map((plan) => ({
                  value: plan.id,
                  label: plan.name || formatPlan(plan.id),
                }))}
              />
              <FieldSelect
                label="Status"
                value={subscription.status}
                onChange={(value) =>
                  setSubscription((current) => ({ ...current, status: value }))
                }
                options={subscriptionStatusOptions.map((item) => ({
                  value: item,
                  label: titleCase(item),
                }))}
              />
              <FieldInput
                label="Start Date"
                type="date"
                value={subscription.startedAt}
                onChange={(value) =>
                  setSubscription((current) => ({ ...current, startedAt: value }))
                }
              />
              <FieldInput
                label="Expiry Date"
                type="date"
                value={subscription.expiresAt}
                onChange={(value) =>
                  setSubscription((current) => ({ ...current, expiresAt: value }))
                }
              />
            </div>

            <FieldInput
              label="Note"
              value={subscription.note}
              onChange={(value) =>
                setSubscription((current) => ({ ...current, note: value }))
              }
              className="mt-3"
            />

            <button
              onClick={() =>
                onSaveSubscription({
                  ...subscription,
                  startedAt: subscription.startedAt || null,
                  expiresAt: subscription.expiresAt || null,
                })
              }
              disabled={saving}
              className="mt-4 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              Save Subscription
            </button>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-gray-200 p-4">
          <h3 className="mb-3 font-semibold">Active Features</h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(user.activeFeatures || {}).map(([key, value]) => (
              <div key={key} className="rounded-lg bg-gray-50 p-3">
                <p className="text-[10px] uppercase text-gray-400">{key}</p>
                <p className="mt-1 text-xs font-semibold text-gray-700">
                  {formatLimitValue(value)}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryBox({ label, value }) {
  return (
    <div className="rounded-lg bg-gray-50 p-4">
      <p className="text-[10px] uppercase text-gray-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-gray-800">{value}</p>
    </div>
  );
}

function FieldInput({ label, value, onChange, type = "text", className = "" }) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-2 block text-xs font-semibold text-gray-600">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      />
    </label>
  );
}

function FieldSelect({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold text-gray-600">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-400"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function PlanModal({ plan, onClose, onSave, saving }) {
  const [name, setName] = useState(plan.name || formatPlan(plan.id));
  const [status, setStatus] = useState(plan.status || "active");
  const [featuresText, setFeaturesText] = useState(
    JSON.stringify(plan.features || {}, null, 2),
  );
  const [limitsText, setLimitsText] = useState(
    JSON.stringify(plan.limits || {}, null, 2),
  );
  const [parseError, setParseError] = useState("");

  const handleSave = () => {
    try {
      setParseError("");
      onSave(plan.id, {
        name,
        status,
        features: JSON.parse(featuresText || "{}"),
        limits: JSON.parse(limitsText || "{}"),
      });
    } catch {
      setParseError("JSON features atau limits tidak valid.");
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-[2px]"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">Edit Plan</h2>
            <p className="mt-1 text-sm text-gray-400">{plan.id}</p>
          </div>
          <button
            onClick={onClose}
            className="text-2xl text-gray-400 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <FieldInput label="Plan Name" value={name} onChange={setName} />
          <FieldSelect
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <label>
            <span className="mb-2 block text-xs font-semibold text-gray-600">
              Features JSON
            </span>
            <textarea
              value={featuresText}
              onChange={(event) => setFeaturesText(event.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-violet-400"
            />
          </label>
          <label>
            <span className="mb-2 block text-xs font-semibold text-gray-600">
              Limits JSON
            </span>
            <textarea
              value={limitsText}
              onChange={(event) => setLimitsText(event.target.value)}
              rows={12}
              className="w-full rounded-lg border border-gray-200 px-3 py-2.5 font-mono text-xs outline-none focus:border-violet-400"
            />
          </label>
        </div>

        {parseError ? (
          <p className="mt-3 text-sm font-semibold text-red-600">{parseError}</p>
        ) : null}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            Save Plan
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [activeMenu, setActiveMenu] = useState(
    DELETION_PREVIEW_MODE ? "Permintaan Hapus" : "Dashboard",
  );
  const [token, setToken] = useState(() =>
    DELETION_PREVIEW_MODE ? "preview-token" : localStorage.getItem(TOKEN_KEY) || "",
  );
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [plans, setPlans] = useState([]);
  const [featureMeta, setFeatureMeta] = useState({ features: [], limits: [] });
  const [logs, setLogs] = useState([]);
  const [deletionRequests, setDeletionRequests] = useState([]);
  const [deletionSummary, setDeletionSummary] = useState({});
  const [deletionFilters, setDeletionFilters] = useState({ search: "", status: "" });
  const [deletionLoading, setDeletionLoading] = useState(false);
  const [deletionError, setDeletionError] = useState("");
  const [filters, setFilters] = useState({
    search: "",
    role: "",
    plan: "",
    status: "",
    limit: 25,
  });
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 25,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seedLoading, setSeedLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedDeletionRequest, setSelectedDeletionRequest] = useState(null);
  const [editingPlan, setEditingPlan] = useState(null);
  const [toast, setToast] = useState(null);

  const auth = useMemo(() => ({ token }), [token]);

  const showToast = useCallback((message, type = "success") => {
    setToast({ id: Date.now(), message, type });
  }, []);

  const buildUsersPath = useCallback(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", String(filters.limit));
    if (filters.search.trim()) params.set("search", filters.search.trim());
    if (filters.role) params.set("role", filters.role);
    if (filters.plan) params.set("plan", filters.plan);
    if (filters.status) params.set("status", filters.status);
    return `/api/admin/users?${params.toString()}`;
  }, [filters, page]);

  const buildDeletionRequestsPath = useCallback(() => {
    const params = new URLSearchParams();
    if (deletionFilters.search.trim()) {
      params.set("search", deletionFilters.search.trim());
    }
    if (deletionFilters.status) params.set("status", deletionFilters.status);
    const query = params.toString();
    return `/api/admin/account-deletion-requests${query ? `?${query}` : ""}`;
  }, [deletionFilters]);

  const loadDeletionRequests = useCallback(
    async ({ signal, successMessage } = {}) => {
      if (!token) return;
      if (DELETION_PREVIEW_MODE) {
        setDeletionRequests(previewDeletionRequests.map(normalizeDeletionRequest));
        setDeletionSummary({
          pending: 2,
          processing: 1,
          urgent: 1,
          completedThisMonth: 8,
        });
        return;
      }
      setDeletionLoading(true);
      setDeletionError("");
      try {
        const result = await apiRequest(buildDeletionRequestsPath(), {
          ...auth,
          signal,
        });
        const items = result.items || result.data?.items || result.data || [];
        setDeletionRequests(
          Array.isArray(items) ? items.map(normalizeDeletionRequest) : [],
        );
        setDeletionSummary(result.summary || result.data?.summary || {});
        if (successMessage) showToast(successMessage);
      } catch (err) {
        if (err.name === "AbortError") return;
        setDeletionError(err.message);
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        }
      } finally {
        setDeletionLoading(false);
      }
    },
    [auth, buildDeletionRequestsPath, showToast, token],
  );

  const loadData = useCallback(
    async ({ signal, successMessage } = {}) => {
      if (!token) return;
      if (DELETION_PREVIEW_MODE) return;
      setLoading(true);
      setError("");

      try {
        const [overviewRes, usersRes, plansRes, featuresRes, logsRes] =
          await Promise.all([
            apiRequest("/api/admin/overview", { ...auth, signal }),
            apiRequest(buildUsersPath(), { ...auth, signal }),
            apiRequest("/api/admin/plans", { ...auth, signal }),
            apiRequest("/api/admin/features", { ...auth, signal }),
            apiRequest("/api/admin/activity-logs?limit=30", { ...auth, signal }),
          ]);

        setOverview(overviewRes);
        setUsers(usersRes.items || []);
        setPagination(
          usersRes.pagination || {
            page,
            limit: filters.limit,
            total: usersRes.items?.length ?? 0,
            totalPages: 1,
          },
        );
        setPlans(plansRes.items || []);
        setFeatureMeta(featuresRes || { features: [], limits: [] });
        setLogs(logsRes.items || []);
        if (successMessage) showToast(successMessage);
      } catch (err) {
        if (err.name === "AbortError") return;
        setError(err.message);
        showToast(err.message, "error");
        if (err.status === 401 || err.status === 403) {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        }
      } finally {
        setLoading(false);
      }
    },
    [auth, buildUsersPath, filters.limit, page, showToast, token],
  );

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => {
      void loadData({ signal: controller.signal });
    });
    return () => controller.abort();
  }, [loadData]);

  useEffect(() => {
    if (activeMenu !== "Permintaan Hapus") return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadDeletionRequests({ signal: controller.signal });
    }, deletionFilters.search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [activeMenu, deletionFilters.search, deletionFilters.status, loadDeletionRequests]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const login = async () => {
    setLoginLoading(true);
    setLoginError("");

    try {
      const result = await apiRequest("/api/admin/login", {
        method: "POST",
        body: {
          email: loginEmail.trim(),
          password: loginPassword,
        },
      });

      const accessToken = result.data?.token || result.token || result.accessToken;
      if (!accessToken) throw new Error("Token login tidak ditemukan pada respons API.");

      localStorage.setItem(TOKEN_KEY, accessToken);
      setToken(accessToken);
      setLoginPassword("");
      setLoginEmail("");
      showToast("Login berhasil. Dashboard admin siap digunakan.");
    } catch (err) {
      setLoginError(err.message);
      showToast(err.message, "error");
    } finally {
      setLoginLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setLoginPassword("");
    setLoginError("");
    showToast("Anda sudah keluar dari dashboard.");
  };

  const openUser = async (user) => {
    setSaving(false);
    setError("");
    try {
      const detail = await apiRequest(`/api/admin/users/${user.userId}`, auth);
      setSelectedUser(detail);
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    }
  };

  const refreshAfterMutation = async () => {
    await loadData();
    if (selectedUser?.userId) {
      const detail = await apiRequest(`/api/admin/users/${selectedUser.userId}`, auth);
      setSelectedUser(detail);
    }
  };

  const saveRole = async (role) => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${selectedUser.userId}/role`, {
        ...auth,
        method: "PATCH",
        body: { role },
      });
      await refreshAfterMutation();
      showToast("Role user berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveStatus = async (status) => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${selectedUser.userId}/status`, {
        ...auth,
        method: "PATCH",
        body: { status },
      });
      await refreshAfterMutation();
      showToast("Status user berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const saveSubscription = async (subscription) => {
    if (!selectedUser) return;
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/users/${selectedUser.userId}/subscription`, {
        ...auth,
        method: "PATCH",
        body: subscription,
      });
      await refreshAfterMutation();
      showToast("Subscription user berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const seedPlans = async () => {
    setSeedLoading(true);
    setError("");
    try {
      await apiRequest("/api/admin/plans/seed-defaults", {
        ...auth,
        method: "POST",
      });
      await loadData();
      showToast("Default plan berhasil disimpan ke Firestore.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSeedLoading(false);
    }
  };

  const savePlan = async (planId, payload) => {
    setSaving(true);
    setError("");
    try {
      await apiRequest(`/api/admin/plans/${planId}`, {
        ...auth,
        method: "PUT",
        body: payload,
      });
      setEditingPlan(null);
      await loadData();
      showToast("Plan berhasil diperbarui.");
    } catch (err) {
      setError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const resolveDeletionRequest = async (requestId, status, adminNote) => {
    setSaving(true);
    setDeletionError("");
    try {
      if (DELETION_PREVIEW_MODE) {
        setDeletionRequests((current) =>
          current.map((request) =>
            request.id === requestId
              ? { ...request, status, adminNote: adminNote.trim() || null }
              : request,
          ),
        );
        setSelectedDeletionRequest(null);
        showToast("Mode preview: status permintaan berhasil diperbarui.");
        return;
      }
      await apiRequest(`/api/admin/account-deletion-requests/${requestId}/status`, {
        ...auth,
        method: "PATCH",
        body: { status, adminNote: adminNote.trim() || null },
      });
      setSelectedDeletionRequest(null);
      await loadDeletionRequests();
      const messages = {
        rejected: "Permintaan penghapusan berhasil ditolak.",
        processing: "Proses penghapusan akun berhasil dimulai.",
        completed: "Akun dan data pengguna berhasil dihapus.",
      };
      showToast(messages[status] || "Status permintaan berhasil diperbarui.");
    } catch (err) {
      setDeletionError(err.message);
      showToast(err.message, "error");
    } finally {
      setSaving(false);
    }
  };

  const pageTitle =
    activeMenu === "Permintaan Hapus"
      ? "Penghapusan Akun"
      : activeMenu;
  const pageSubtitle = {
    Dashboard: "Overview users, roles, plans, subscriptions, and activity.",
    "Permintaan Hapus":
      "Kelola permintaan penghapusan akun secara aman dan terdokumentasi.",
  }[activeMenu] || "Manage users, roles, plans, subscriptions, features, and limits.";

  if (!token) {
    return (
      <>
        <ToastBubble toast={toast} onClose={() => setToast(null)} />
        <LoginGate
          email={loginEmail}
          password={loginPassword}
          setEmail={setLoginEmail}
          setPassword={setLoginPassword}
          onLogin={login}
          loading={loginLoading}
          error={loginError}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] text-gray-900">
      <ToastBubble toast={toast} onClose={() => setToast(null)} />
      <Sidebar activeMenu={activeMenu} setActiveMenu={setActiveMenu} onLogout={logout} />

      <main className="min-h-screen md:ml-64">
        <div className="mx-auto max-w-[1600px] p-5 md:p-8">
          <MobileMenu activeMenu={activeMenu} setActiveMenu={setActiveMenu} />
          <header className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {pageTitle}
              </h1>
              <p className="mt-1 text-sm text-gray-400">{pageSubtitle}</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  if (activeMenu === "Permintaan Hapus") {
                    void loadDeletionRequests({
                      successMessage: "Data permintaan berhasil diperbarui.",
                    });
                    return;
                  }
                  void loadData({
                    successMessage: "Data dashboard berhasil diperbarui.",
                  });
                }}
                disabled={
                  activeMenu === "Permintaan Hapus" ? deletionLoading : loading
                }
                className="rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 shadow-sm hover:bg-gray-50 disabled:opacity-60"
              >
                {activeMenu === "Permintaan Hapus"
                  ? deletionLoading
                    ? "Memperbarui..."
                    : "Perbarui"
                  : loading
                    ? "Refreshing..."
                    : "Refresh"}
              </button>
            </div>
          </header>

          {error && activeMenu !== "Permintaan Hapus" ? (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
              {error}
            </div>
          ) : null}

          {activeMenu === "Dashboard" ? (
            <DashboardView
              overview={overview}
              plans={plans}
              onSeedPlans={seedPlans}
              seedLoading={seedLoading}
            />
          ) : null}

          {activeMenu === "Users" ? (
            <UsersView
              users={users}
              plans={plans}
              filters={filters}
              setFilters={setFilters}
              pagination={pagination}
              setPage={setPage}
              onOpenUser={openUser}
              loading={loading}
            />
          ) : null}

          {activeMenu === "Permintaan Hapus" ? (
            <DeletionRequestsView
              requests={deletionRequests}
              summary={deletionSummary}
              filters={deletionFilters}
              setFilters={setDeletionFilters}
              loading={deletionLoading}
              error={deletionError}
              onSelect={setSelectedDeletionRequest}
              onRefresh={() =>
                loadDeletionRequests({
                  successMessage: "Data permintaan berhasil diperbarui.",
                })
              }
            />
          ) : null}

          {activeMenu === "Plans" ? (
            <PlansView
              plans={plans}
              onSeedPlans={seedPlans}
              onEditPlan={setEditingPlan}
              seedLoading={seedLoading}
            />
          ) : null}

          {activeMenu === "Subscriptions" ? (
            <SubscriptionsView users={users} onOpenUser={openUser} />
          ) : null}

          {activeMenu === "Features & Limits" ? (
            <FeaturesView featureMeta={featureMeta} plans={plans} />
          ) : null}

          {activeMenu === "Activity Logs" ? <ActivityLogsView logs={logs} /> : null}

          {activeMenu === "Settings" ? (
            <SettingsView token={token} onLogout={logout} />
          ) : null}
        </div>
      </main>

      {selectedUser ? (
        <UserModal
          user={selectedUser}
          plans={plans}
          onClose={() => setSelectedUser(null)}
          onSaveRole={saveRole}
          onSaveStatus={saveStatus}
          onSaveSubscription={saveSubscription}
          saving={saving}
        />
      ) : null}

      {editingPlan ? (
        <PlanModal
          plan={editingPlan}
          onClose={() => setEditingPlan(null)}
          onSave={savePlan}
          saving={saving}
        />
      ) : null}


      {selectedDeletionRequest ? (
        <DeletionRequestModal
          request={selectedDeletionRequest}
          onClose={() => setSelectedDeletionRequest(null)}
          onResolve={resolveDeletionRequest}
          saving={saving}
        />
      ) : null}
    </div>
  );
}
