/**
 * ============================================================================
 * ZENOX WORKER BOT — PRODUCTION SERVERLESS TELEGRAM BOT (CLOUDFLARE WORKERS)
 * Framework: grammY (ES Modules)
 * Storage: Cloudflare KV Binding (`env.DB`)
 * ============================================================================
 */
import { Bot, InlineKeyboard, Keyboard } from "grammy";

export interface Env {
  DB?: {
    get(key: string): Promise<string | null>;
    put(key: string, value: string): Promise<void>;
    delete(key: string): Promise<void>;
  };
  BOT_TOKEN?: string;
  OWNER_ID?: string;
  SUPPORT_USERNAME?: string;
  FORCE_CHANNEL?: string;
  BOT_USERNAME?: string;
}

// ============================================================================
// 1. DEFAULT CONFIGURATION & ENVIRONMENT FALLBACKS
// ============================================================================
const DEFAULT_CONFIG = {
  BOT_TOKEN: "9162764699:AAGUZ-mJ4qAIHyCs0GLNAB5JeZxQjCmALWQ",
  OWNER_ID: "8838351233",
  SUPPORT_USERNAME: "@ZenoxWorker",
  FORCE_CHANNEL: "https://t.me/+ukH5GufIKTthNzA9",
};

const DEFAULT_SETTINGS = {
  maintenanceMode: false,
  forceChannelEnabled: true,
  forceChannelUrl: DEFAULT_CONFIG.FORCE_CHANNEL,
  forceChannelChatId: "",
  currencySymbol: "USDT",
  welcomeBonus: 1.5,
  referralBonus: 2.0,
  dailyBonus: 0.5,
  minWithdraw: 10.0,
  supportUsername: DEFAULT_CONFIG.SUPPORT_USERNAME,
  admins: [DEFAULT_CONFIG.OWNER_ID],
};

const DEFAULT_TASKS = [
  {
    id: "task_101",
    title: "📢 Join Official Announcements Channel",
    description:
      "Subscribe to our official Telegram channel and stay active for updates and reward drops.",
    reward: 1.5,
    url: "https://t.me/+ukH5GufIKTthNzA9",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "task_102",
    title: "🐦 Follow Partner X (Twitter) & Retweet Pinned Post",
    description:
      "Follow our official X account, like and retweet the pinned post, then submit your @username as proof.",
    reward: 2.5,
    url: "https://x.com",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
  {
    id: "task_103",
    title: "💬 Invite 3 Active Friends via Referral Link",
    description:
      "Share your personal referral link in crypto communities and submit a screenshot once completed.",
    reward: 3.0,
    url: "https://t.me/+ukH5GufIKTthNzA9",
    active: true,
    createdAt: "2026-11-01T00:00:00.000Z",
  },
];

// ============================================================================
// 2. CLOUDFLARE KV STORAGE LAYER (`env.DB`)
// ============================================================================
const IN_MEMORY_FALLBACK = new Map<string, string>();

function getKV(env: Env) {
  if (env && env.DB && typeof env.DB.get === "function") {
    return env.DB;
  }
  return {
    async get(key: string) {
      return IN_MEMORY_FALLBACK.has(key) ? IN_MEMORY_FALLBACK.get(key)! : null;
    },
    async put(key: string, value: string) {
      IN_MEMORY_FALLBACK.set(key, value);
    },
    async delete(key: string) {
      IN_MEMORY_FALLBACK.delete(key);
    },
  };
}

async function kvGetJSON<T>(env: Env, key: string, fallbackValue: T): Promise<T> {
  try {
    const kv = getKV(env);
    const raw = await kv.get(key);
    if (!raw) return fallbackValue;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.error(`[KV READ ERROR] Key: ${key}`, err);
    return fallbackValue;
  }
}

async function kvPutJSON(env: Env, key: string, value: unknown): Promise<boolean> {
  try {
    const kv = getKV(env);
    await kv.put(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`[KV WRITE ERROR] Key: ${key}`, err);
    return false;
  }
}

export async function kvDelete(env: Env, key: string): Promise<boolean> {
  try {
    const kv = getKV(env);
    await kv.delete(key);
    return true;
  } catch (err) {
    console.error(`[KV DELETE ERROR] Key: ${key}`, err);
    return false;
  }
}

// ============================================================================
// 3. DATA ACCESS HELPERS
// ============================================================================
function resolveEnvConfig(env: Env) {
  return {
    BOT_TOKEN: env?.BOT_TOKEN || DEFAULT_CONFIG.BOT_TOKEN,
    OWNER_ID: String(env?.OWNER_ID || DEFAULT_CONFIG.OWNER_ID).trim(),
    SUPPORT_USERNAME: env?.SUPPORT_USERNAME || DEFAULT_CONFIG.SUPPORT_USERNAME,
    FORCE_CHANNEL: env?.FORCE_CHANNEL || DEFAULT_CONFIG.FORCE_CHANNEL,
  };
}

async function getSettings(env: Env) {
  const cfg = resolveEnvConfig(env);
  const stored = await kvGetJSON<Record<string, any> | null>(env, "sys:settings", null);
  const merged = {
    ...DEFAULT_SETTINGS,
    forceChannelUrl: cfg.FORCE_CHANNEL,
    supportUsername: cfg.SUPPORT_USERNAME,
    ...(stored || {}),
  };
  if (!Array.isArray(merged.admins)) {
    merged.admins = [cfg.OWNER_ID];
  }
  if (!merged.admins.includes(cfg.OWNER_ID)) {
    merged.admins.unshift(cfg.OWNER_ID);
  }
  return merged;
}

async function saveSettings(env: Env, settings: Record<string, any>) {
  return kvPutJSON(env, "sys:settings", settings);
}

async function getUserIndex(env: Env): Promise<string[]> {
  return kvGetJSON<string[]>(env, "sys:users_index", []);
}

async function addUserToIndex(env: Env, userId: string | number) {
  const uid = String(userId);
  const index = await getUserIndex(env);
  if (!index.includes(uid)) {
    index.push(uid);
    await kvPutJSON(env, "sys:users_index", index);
  }
}

async function getUser(env: Env, userId: string | number, fromObj: any = null) {
  const uid = String(userId);
  let user = await kvGetJSON<Record<string, any> | null>(env, `user:${uid}`, null);
  const now = new Date().toISOString();

  if (!user && fromObj) {
    const settings = await getSettings(env);
    user = {
      id: uid,
      username: fromObj.username ? `@${fromObj.username}` : "No Username",
      firstName: fromObj.first_name || "User",
      balance: Number(settings.welcomeBonus || 0),
      totalEarned: Number(settings.welcomeBonus || 0),
      withdrawn: 0,
      referralsCount: 0,
      referredBy: null,
      walletAddress: "Not Set",
      completedTasks: [],
      pendingTasks: [],
      verifiedChannel: false,
      banned: false,
      lastDailyBonus: null,
      state: null,
      stateData: {},
      joinedAt: now,
      updatedAt: now,
      isNew: true,
    };
    await kvPutJSON(env, `user:${uid}`, user);
    await addUserToIndex(env, uid);
    return user;
  }

  if (user && fromObj) {
    user.username = fromObj.username ? `@${fromObj.username}` : user.username;
    user.firstName = fromObj.first_name || user.firstName;
    user.updatedAt = now;
    user.isNew = false;
  }

  return user;
}

async function saveUser(env: Env, user: Record<string, any> | null) {
  if (!user || !user.id) return false;
  const copy = { ...user };
  delete copy.isNew;
  copy.updatedAt = new Date().toISOString();
  return kvPutJSON(env, `user:${copy.id}`, copy);
}

async function getTasks(env: Env) {
  const tasks = await kvGetJSON<any[] | null>(env, "sys:tasks", null);
  if (!tasks) {
    await kvPutJSON(env, "sys:tasks", DEFAULT_TASKS);
    return DEFAULT_TASKS;
  }
  return tasks;
}

async function saveTasks(env: Env, tasks: any[]) {
  return kvPutJSON(env, "sys:tasks", tasks);
}

async function getSubmissions(env: Env) {
  return kvGetJSON<any[]>(env, "sys:submissions", []);
}

async function saveSubmissions(env: Env, submissions: any[]) {
  return kvPutJSON(env, "sys:submissions", submissions);
}

async function getPayouts(env: Env) {
  return kvGetJSON<any[]>(env, "sys:payouts", []);
}

async function savePayouts(env: Env, payouts: any[]) {
  return kvPutJSON(env, "sys:payouts", payouts);
}

// ============================================================================
// 4. KEYBOARDS & UI BUILDERS
// ============================================================================
function buildUserReplyKeyboard() {
  return new Keyboard()
    .text("🎯 Earn Tasks")
    .text("💰 My Balance")
    .row()
    .text("💳 Wallet & Withdraw")
    .text("👥 Refer & Earn")
    .row()
    .text("🎁 Daily Bonus")
    .text("🛟 Support")
    .resized()
    .persistent();
}

function buildForceChannelKeyboard(channelUrl: string) {
  return new InlineKeyboard()
    .url("📢 Join Official Channel", channelUrl)
    .row()
    .text("✅ Verify Membership", "verify_force_channel");
}

function buildAdminPanelKeyboard() {
  return new InlineKeyboard()
    .text("➕ Create / Add", "admin:create_add")
    .text("📋 Manage Custom / Tasks", "admin:manage_tasks")
    .row()
    .text("📝 Review Pending Submissions", "admin:review_submissions")
    .row()
    .text("👥 View All Users", "admin:view_users:0")
    .text("🔍 Inspect User", "admin:inspect_user")
    .row()
    .text("📊 Real-Time Analytics", "admin:analytics")
    .text("💳 Manage Payments / Payouts", "admin:manage_payouts")
    .row()
    .text("🎁 Set Rewards / Bonuses", "admin:set_rewards")
    .text("📢 Force Channel Verification", "admin:force_channel")
    .row()
    .text("👥 Manage Admins", "admin:manage_admins")
    .text("📢 Broadcast System", "admin:broadcast")
    .row()
    .text("⚙️ Maintenance Mode", "admin:maintenance")
    .text("⚠️ Wipe / Reset All Platform Data", "admin:wipe_confirm")
    .row()
    .text("🔙 Close Admin Panel", "admin:close");
}

function buildAdminBackKeyboard() {
  return new InlineKeyboard().text("🔙 Back to Admin Panel", "admin:home");
}

function escapeHtml(str: unknown) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function formatMoney(amount: unknown, currency = "USDT") {
  return `${Number(amount || 0).toFixed(2)} ${currency}`;
}

// ============================================================================
// 5. PERMISSION & FORCE CHANNEL VERIFICATION
// ============================================================================
function isOwner(userId: string | number, env: Env) {
  const cfg = resolveEnvConfig(env);
  return String(userId) === String(cfg.OWNER_ID);
}

async function isAuthorizedAdmin(userId: string | number, env: Env) {
  if (isOwner(userId, env)) return true;
  const settings = await getSettings(env);
  return Array.isArray(settings.admins) && settings.admins.includes(String(userId));
}

async function verifyChannelMembership(
  ctx: any,
  env: Env,
  user: Record<string, any>,
  settings: Record<string, any>
) {
  if (!settings.forceChannelEnabled) return true;
  if (await isAuthorizedAdmin(user.id, env)) return true;

  if (settings.forceChannelChatId && settings.forceChannelChatId.trim() !== "") {
    try {
      const member = await ctx.api.getChatMember(
        settings.forceChannelChatId.trim(),
        Number(user.id)
      );
      const validStatuses = ["creator", "administrator", "member", "restricted"];
      if (validStatuses.includes(member.status)) {
        user.verifiedChannel = true;
        await saveUser(env, user);
        return true;
      }
      return false;
    } catch (err: any) {
      console.warn("[ForceChannel API Check Warning]:", err?.message || err);
    }
  }
  return Boolean(user.verifiedChannel);
}

async function sendForceChannelPrompt(ctx: any, settings: Record<string, any>) {
  const text =
    `🚨 <b>Action Required: Channel Subscription</b>\n\n` +
    `Welcome to our platform! To unlock your wallet, tasks, and bonuses, you must join our official channel first.\n\n` +
    `1️⃣ Click <b>"📢 Join Official Channel"</b> below.\n` +
    `2️⃣ Click <b>"✅ Verify Membership"</b> to continue.`;

  await ctx.reply(text, {
    parse_mode: "HTML",
    reply_markup: buildForceChannelKeyboard(settings.forceChannelUrl),
  });
}

async function buildAdminDashboardText(env: Env) {
  const settings = await getSettings(env);
  const usersIndex = await getUserIndex(env);
  const tasks = await getTasks(env);
  const submissions = await getSubmissions(env);
  const payouts = await getPayouts(env);

  const pendingSubs = submissions.filter((s) => s.status === "pending").length;
  const pendingPayouts = payouts.filter((p) => p.status === "pending").length;

  return (
    `🛡️ <b>ZENOX EXECUTIVE ADMIN CONTROL PANEL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👥 <b>Total Registered Users:</b> <code>${usersIndex.length}</code>\n` +
    `📋 <b>Active Tasks:</b> <code>${tasks.filter((t) => t.active).length} / ${tasks.length}</code>\n` +
    `📝 <b>Pending Submissions:</b> <code>${pendingSubs}</code>\n` +
    `💳 <b>Pending Payouts:</b> <code>${pendingPayouts}</code>\n` +
    `📢 <b>Force Channel:</b> <code>${settings.forceChannelEnabled ? "ENABLED 🟢" : "DISABLED 🔴"}</code>\n` +
    `⚙️ <b>Maintenance Mode:</b> <code>${settings.maintenanceMode ? "ACTIVE 🟠" : "OFF 🟢"}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Select a management module below:</i>`
  );
}

// ============================================================================
// 6. BOT FACTORY & HANDLER REGISTRATION
// ============================================================================
export function createBotInstance(env: Env) {
  const cfg = resolveEnvConfig(env);
  const bot = new Bot<any>(cfg.BOT_TOKEN);

  bot.catch((err) => {
    console.error("[grammY Bot Error]:", err.error || err);
  });

  bot.use(async (ctx, next) => {
    if (!ctx.from) return;
    const settings = await getSettings(env);
    const user = await getUser(env, ctx.from.id, ctx.from);
    ctx.state = { user, settings, cfg };

    const adminAuth = await isAuthorizedAdmin(ctx.from.id, env);
    if (user?.banned && !adminAuth) {
      await ctx.reply(
        `🚫 <b>Access Suspended</b>\n\nYour account has been restricted by an administrator. Contact ${escapeHtml(
          settings.supportUsername
        )} for assistance.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (settings.maintenanceMode && !adminAuth) {
      await ctx.reply(
        `⚙️ <b>System Maintenance Underway</b>\n\nWe are currently upgrading our servers and reward engine. Please check back shortly!\n\n🛟 Support: ${escapeHtml(
          settings.supportUsername
        )}`,
        { parse_mode: "HTML" }
      );
      return;
    }

    await next();
  });

  // /start command
  bot.command("start", async (ctx) => {
    const { user, settings } = ctx.state;
    const payload = ctx.match ? String(ctx.match).trim() : "";

    user.state = null;
    user.stateData = {};

    if (user.isNew && payload.startsWith("ref_")) {
      const refId = payload.replace("ref_", "").trim();
      if (refId && refId !== String(user.id)) {
        const referrer = await getUser(env, refId);
        if (referrer && !user.referredBy) {
          user.referredBy = refId;
          const bonus = Number(settings.referralBonus || 0);
          referrer.balance = Number(referrer.balance || 0) + bonus;
          referrer.totalEarned = Number(referrer.totalEarned || 0) + bonus;
          referrer.referralsCount = Number(referrer.referralsCount || 0) + 1;
          await saveUser(env, referrer);
          try {
            await ctx.api.sendMessage(
              Number(refId),
              `🎉 <b>New Referral Joined!</b>\n\n👤 <b>User:</b> ${escapeHtml(
                user.firstName
              )}\n🎁 <b>Bonus Credited:</b> +${formatMoney(bonus, settings.currencySymbol)}`,
              { parse_mode: "HTML" }
            );
          } catch (_) {}
        }
      }
    }

    await saveUser(env, user);

    const isVerified = await verifyChannelMembership(ctx, env, user, settings);
    if (!isVerified) {
      await sendForceChannelPrompt(ctx, settings);
      return;
    }

    const welcomeText =
      `✨ <b>Welcome to Zenox Rewards Hub, ${escapeHtml(user.firstName)}!</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🆔 <b>Account ID:</b> <code>${user.id}</code>\n` +
      `💰 <b>Current Balance:</b> <code>${formatMoney(user.balance, settings.currencySymbol)}</code>\n` +
      `👥 <b>Total Referrals:</b> <code>${user.referralsCount}</code>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `🚀 Complete daily tasks, invite friends, and withdraw instant payouts directly to your wallet!\n\n` +
      `👇 <i>Use the interactive menu below to navigate:</i>`;

    await ctx.reply(welcomeText, {
      parse_mode: "HTML",
      reply_markup: buildUserReplyKeyboard(),
    });
  });

  // /admin command
  bot.command("admin", async (ctx) => {
    const userId = String(ctx.from?.id || "");
    const authorized = await isAuthorizedAdmin(userId, env);
    if (!authorized) {
      await ctx.reply(
        `⛔ <b>Access Denied</b>\nThis command is restricted strictly to the platform owner.`,
        { parse_mode: "HTML" }
      );
      return;
    }

    const { user } = ctx.state;
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);

    const dashboardText = await buildAdminDashboardText(env);
    await ctx.reply(dashboardText, {
      parse_mode: "HTML",
      reply_markup: buildAdminPanelKeyboard(),
    });
  });

  bot.callbackQuery("verify_force_channel", async (ctx) => {
    const { user, settings } = ctx.state;
    if (settings.forceChannelChatId && settings.forceChannelChatId.trim() !== "") {
      const ok = await verifyChannelMembership(ctx, env, user, settings);
      if (!ok) {
        await ctx.answerCallbackQuery({
          text: "❌ You haven't joined the channel yet! Please join first.",
          show_alert: true,
        });
        return;
      }
    } else {
      user.verifiedChannel = true;
      await saveUser(env, user);
    }

    await ctx.answerCallbackQuery({
      text: "✅ Membership verified! Welcome aboard.",
    });
    try {
      await ctx.deleteMessage();
    } catch (_) {}

    await ctx.reply(
      `✅ <b>Verification Successful!</b>\n\nWelcome, <b>${escapeHtml(
        user.firstName
      )}</b>! Your account is now active.\n💰 <b>Balance:</b> <code>${formatMoney(
        user.balance,
        settings.currencySymbol
      )}</code>`,
      {
        parse_mode: "HTML",
        reply_markup: buildUserReplyKeyboard(),
      }
    );
  });

  // Task & Wallet Callbacks
  bot.callbackQuery(/^task:view:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const { user, settings } = ctx.state;
    const tasks = await getTasks(env);
    const task = tasks.find((t) => t.id === taskId && t.active);
    if (!task) {
      await ctx.answerCallbackQuery({
        text: "⚠️ Task is no longer available.",
        show_alert: true,
      });
      return;
    }

    const completed = (user.completedTasks || []).includes(task.id);
    const pending = (user.pendingTasks || []).includes(task.id);

    const kb = new InlineKeyboard();
    if (task.url) {
      kb.url("🔗 Open Task Link", task.url).row();
    }
    if (!completed && !pending) {
      kb.text("📤 Submit Proof & Claim Reward", `task:submit:${task.id}`).row();
    }
    kb.text("🔙 Back to Tasks", "user:tasks_list");

    const statusBadge = completed
      ? "✅ Completed"
      : pending
      ? "⏳ Pending Review"
      : "🟢 Available";
    const text =
      `🎯 <b>${escapeHtml(task.title)}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📝 <b>Instructions:</b>\n${escapeHtml(task.description)}\n\n` +
      `🎁 <b>Reward:</b> <code>+${formatMoney(task.reward, settings.currencySymbol)}</code>\n` +
      `📌 <b>Status:</b> ${statusBadge}`;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery("user:tasks_list", async (ctx) => {
    const { user, settings } = ctx.state;
    const tasks = (await getTasks(env)).filter((t) => t.active);
    const kb = new InlineKeyboard();
    for (const t of tasks) {
      const done = (user.completedTasks || []).includes(t.id);
      const pend = (user.pendingTasks || []).includes(t.id);
      const prefix = done ? "✅" : pend ? "⏳" : "🎯";
      kb.text(
        `${prefix} ${t.title} (+${formatMoney(t.reward, settings.currencySymbol)})`,
        `task:view:${t.id}`
      ).row();
    }
    const text =
      tasks.length > 0
        ? `🎯 <b>Available Earning Tasks (${tasks.length})</b>\n\nSelect any task below to view instructions and claim your reward:`
        : `📭 <b>No Active Tasks</b>\n\nAll tasks are completed or being refreshed. Check back soon!`;

    await ctx.answerCallbackQuery();
    await ctx.editMessageText(text, { parse_mode: "HTML", reply_markup: kb });
  });

  bot.callbackQuery(/^task:submit:(.+)$/, async (ctx) => {
    const taskId = ctx.match[1];
    const { user } = ctx.state;
    const tasks = await getTasks(env);
    const task = tasks.find((t) => t.id === taskId && t.active);
    if (!task) {
      await ctx.answerCallbackQuery({ text: "⚠️ Task not found.", show_alert: true });
      return;
    }

    user.state = "USER_SUBMITTING_TASK";
    user.stateData = { taskId: task.id, taskTitle: task.title, reward: task.reward };
    await saveUser(env, user);

    await ctx.answerCallbackQuery();
    await ctx.reply(
      `📤 <b>Submit Proof for:</b> ${escapeHtml(task.title)}\n\n` +
        `Please send your proof of completion as a text message (e.g., your username or verification details).\n\n` +
        `<i>Type /cancel at any time to abort.</i>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("wallet:set_address", async (ctx) => {
    const { user } = ctx.state;
    user.state = "USER_SETTING_WALLET";
    user.stateData = {};
    await saveUser(env, user);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💳 <b>Update Payout Wallet Address</b>\n\n` +
        `Please reply with your valid wallet address (USDT TRC20 / BEP20 or TON):\n\n` +
        `<i>Type /cancel to abort.</i>`,
      { parse_mode: "HTML" }
    );
  });

  bot.callbackQuery("wallet:withdraw", async (ctx) => {
    const { user, settings } = ctx.state;
    if (!user.walletAddress || user.walletAddress === "Not Set") {
      await ctx.answerCallbackQuery({
        text: "⚠️ Please set your wallet address first!",
        show_alert: true,
      });
      return;
    }
    if (Number(user.balance) < Number(settings.minWithdraw)) {
      await ctx.answerCallbackQuery({
        text: `⚠️ Minimum withdrawal is ${formatMoney(settings.minWithdraw, settings.currencySymbol)}.`,
        show_alert: true,
      });
      return;
    }

    user.state = "USER_WITHDRAW_AMOUNT";
    user.stateData = {};
    await saveUser(env, user);
    await ctx.answerCallbackQuery();
    await ctx.reply(
      `💸 <b>Request Withdrawal</b>\n\n` +
        `💰 <b>Available Balance:</b> <code>${formatMoney(user.balance, settings.currencySymbol)}</code>\n` +
        `🏦 <b>Destination Wallet:</b> <code>${escapeHtml(user.walletAddress)}</code>\n` +
        `📉 <b>Minimum Withdrawal:</b> <code>${formatMoney(settings.minWithdraw, settings.currencySymbol)}</code>\n\n` +
        `Please enter the amount you wish to withdraw:`,
      { parse_mode: "HTML" }
    );
  });

  // ==========================================================================
  // 7. ADMIN PANEL CALLBACK HANDLERS (14 MODULES)
  // ==========================================================================
  bot.callbackQuery(/^admin:(.+)$/, async (ctx) => {
    const userId = String(ctx.from.id);
    if (!(await isAuthorizedAdmin(userId, env))) {
      await ctx.answerCallbackQuery({ text: "⛔ Unauthorized.", show_alert: true });
      return;
    }

    const actionPayload = ctx.match[1];
    const { user, settings } = ctx.state;
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);

    if (actionPayload === "home") {
      await ctx.answerCallbackQuery();
      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    if (actionPayload === "create_add") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_CREATE_TASK";
      await saveUser(env, user);
      const text =
        `➕ <b>Create / Add New Earning Task</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Send details in format:\n<code>Title | Description | Reward | URL</code>`;
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "manage_tasks") {
      await ctx.answerCallbackQuery();
      const tasks = await getTasks(env);
      const kb = new InlineKeyboard();
      for (const t of tasks) {
        const statusIcon = t.active ? "🟢" : "🔴";
        kb.text(`${statusIcon} ${t.title.slice(0, 20)} (${t.reward})`, `admin:task_toggle:${t.id}`)
          .text("🗑️ Delete", `admin:task_del:${t.id}`)
          .row();
      }
      kb.text("➕ Add New Task", "admin:create_add").row();
      kb.text("🔙 Back", "admin:home");
      await ctx.editMessageText(`📋 <b>Manage Tasks (${tasks.length})</b>`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      return;
    }

    if (actionPayload.startsWith("task_toggle:")) {
      const taskId = actionPayload.replace("task_toggle:", "");
      const tasks = await getTasks(env);
      const target = tasks.find((t) => t.id === taskId);
      if (target) {
        target.active = !target.active;
        await saveTasks(env, tasks);
        await ctx.answerCallbackQuery({
          text: `Task is now ${target.active ? "Active 🟢" : "Paused 🔴"}`,
        });
      }
      return;
    }

    if (actionPayload.startsWith("task_del:")) {
      const taskId = actionPayload.replace("task_del:", "");
      const tasks = (await getTasks(env)).filter((t) => t.id !== taskId);
      await saveTasks(env, tasks);
      await ctx.answerCallbackQuery({ text: "🗑️ Task deleted." });
      const kb = new InlineKeyboard();
      for (const t of tasks) {
        const statusIcon = t.active ? "🟢" : "🔴";
        kb.text(`${statusIcon} ${t.title.slice(0, 20)} (${t.reward})`, `admin:task_toggle:${t.id}`)
          .text("🗑️ Delete", `admin:task_del:${t.id}`)
          .row();
      }
      kb.text("➕ Add New Task", "admin:create_add").row();
      kb.text("🔙 Back", "admin:home");
      await ctx.editMessageText(`📋 <b>Manage Tasks (${tasks.length})</b>`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      return;
    }

    if (actionPayload === "review_submissions") {
      await ctx.answerCallbackQuery();
      const subs = await getSubmissions(env);
      const pending = subs.filter((s) => s.status === "pending");
      if (pending.length === 0) {
        await ctx.editMessageText(`📝 <b>Review Submissions</b>\n\n✅ 0 pending submissions.`, {
          parse_mode: "HTML",
          reply_markup: buildAdminBackKeyboard(),
        });
        return;
      }
      const item = pending[0];
      const kb = new InlineKeyboard()
        .text(`✅ Approve (+${item.reward})`, `admin:sub_approve:${item.id}`)
        .text("❌ Reject", `admin:sub_reject:${item.id}`)
        .row()
        .text("🔙 Back", "admin:home");
      await ctx.editMessageText(
        `📝 <b>Review Submission (1 of ${pending.length})</b>\n\n` +
          `👤 <b>User:</b> ${escapeHtml(item.userName)} (<code>${item.userId}</code>)\n` +
          `🎯 <b>Task:</b> ${escapeHtml(item.taskTitle)}\n` +
          `📄 <b>Proof:</b> <code>${escapeHtml(item.proof)}</code>`,
        { parse_mode: "HTML", reply_markup: kb }
      );
      return;
    }

    if (actionPayload.startsWith("sub_approve:") || actionPayload.startsWith("sub_reject:")) {
      const isApprove = actionPayload.startsWith("sub_approve:");
      const subId = actionPayload.split(":")[1];
      const subs = await getSubmissions(env);
      const sub = subs.find((s) => s.id === subId);
      if (sub) {
        sub.status = isApprove ? "approved" : "rejected";
        await saveSubmissions(env, subs);
        const targetUser = await getUser(env, sub.userId);
        if (targetUser) {
          targetUser.pendingTasks = (targetUser.pendingTasks || []).filter(
            (id: string) => id !== sub.taskId
          );
          if (isApprove) {
            targetUser.completedTasks = targetUser.completedTasks || [];
            targetUser.completedTasks.push(sub.taskId);
            targetUser.balance = Number(targetUser.balance || 0) + Number(sub.reward || 0);
            targetUser.totalEarned =
              Number(targetUser.totalEarned || 0) + Number(sub.reward || 0);
          }
          await saveUser(env, targetUser);
        }
      }
      await ctx.answerCallbackQuery({ text: isApprove ? "✅ Approved!" : "❌ Rejected." });
      return;
    }

    if (actionPayload.startsWith("view_users:")) {
      await ctx.answerCallbackQuery();
      const userIds = await getUserIndex(env);
      await ctx.editMessageText(`👥 <b>Total Users:</b> ${userIds.length}`, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "inspect_user") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_INSPECT_USER";
      await saveUser(env, user);
      await ctx.editMessageText(
        `🔍 <b>Inspect User</b>\n\nSend the Telegram User ID to inspect:`,
        {
          parse_mode: "HTML",
          reply_markup: buildAdminBackKeyboard(),
        }
      );
      return;
    }

    if (actionPayload === "analytics") {
      await ctx.answerCallbackQuery({ text: "📊 Analytics refreshed!" });
      const userIds = await getUserIndex(env);
      await ctx.editMessageText(`📊 <b>Analytics</b>\n\nTotal Users: ${userIds.length}`, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "manage_payouts") {
      await ctx.answerCallbackQuery();
      const payouts = await getPayouts(env);
      const pending = payouts.filter((p) => p.status === "pending");
      await ctx.editMessageText(`💳 <b>Pending Payouts:</b> ${pending.length}`, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "set_rewards") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_SET_REWARDS";
      await saveUser(env, user);
      await ctx.editMessageText(
        `🎁 Send 4 pipe-separated values:\n<code>Welcome | Referral | Daily | MinWithdraw</code>`,
        {
          parse_mode: "HTML",
          reply_markup: buildAdminBackKeyboard(),
        }
      );
      return;
    }

    if (actionPayload === "force_channel") {
      await ctx.answerCallbackQuery();
      settings.forceChannelEnabled = !settings.forceChannelEnabled;
      await saveSettings(env, settings);
      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    if (actionPayload === "manage_admins") {
      await ctx.answerCallbackQuery();
      await ctx.editMessageText(`👥 <b>Admins:</b> ${settings.admins.join(", ")}`, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "broadcast") {
      await ctx.answerCallbackQuery();
      user.state = "ADMIN_BROADCAST";
      await saveUser(env, user);
      await ctx.editMessageText(`📢 Send your broadcast message:`, {
        parse_mode: "HTML",
        reply_markup: buildAdminBackKeyboard(),
      });
      return;
    }

    if (actionPayload === "maintenance") {
      settings.maintenanceMode = !settings.maintenanceMode;
      await saveSettings(env, settings);
      await ctx.answerCallbackQuery({ text: `Maintenance: ${settings.maintenanceMode}` });
      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    if (actionPayload === "wipe_confirm") {
      await ctx.answerCallbackQuery();
      const kb = new InlineKeyboard()
        .text("⚠️ YES, WIPE DATA", "admin:wipe_execute")
        .row()
        .text("🔙 Cancel", "admin:home");
      await ctx.editMessageText(`⚠️ WIPE ALL DATA?`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      return;
    }

    if (actionPayload === "wipe_execute") {
      await kvPutJSON(env, "sys:users_index", []);
      await kvPutJSON(env, "sys:tasks", DEFAULT_TASKS);
      await kvPutJSON(env, "sys:submissions", []);
      await kvPutJSON(env, "sys:payouts", []);
      await ctx.answerCallbackQuery({ text: "✅ Wiped successfully!" });
      const text = await buildAdminDashboardText(env);
      await ctx.editMessageText(text, {
        parse_mode: "HTML",
        reply_markup: buildAdminPanelKeyboard(),
      });
      return;
    }

    if (actionPayload === "close") {
      await ctx.answerCallbackQuery({ text: "Closed." });
      try {
        await ctx.deleteMessage();
      } catch (_) {}
      return;
    }
  });

  // Cancel command
  bot.command("cancel", async (ctx) => {
    const { user } = ctx.state;
    user.state = null;
    user.stateData = {};
    await saveUser(env, user);
    await ctx.reply("✅ Cancelled.", { reply_markup: buildUserReplyKeyboard() });
  });

  // Message Handler & States
  bot.on("message:text", async (ctx) => {
    const text = ctx.message.text.trim();
    const { user, settings } = ctx.state;

    if (user.state) {
      if (user.state === "USER_SUBMITTING_TASK") {
        const { taskId, taskTitle, reward } = user.stateData || {};
        const submissions = await getSubmissions(env);
        submissions.push({
          id: `sub_${Date.now().toString().slice(-6)}`,
          userId: user.id,
          userName: user.firstName || user.username,
          taskId,
          taskTitle,
          reward: Number(reward || 0),
          proof: text,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        await saveSubmissions(env, submissions);
        user.pendingTasks = user.pendingTasks || [];
        if (taskId && !user.pendingTasks.includes(taskId)) {
          user.pendingTasks.push(taskId);
        }
        user.state = null;
        user.stateData = {};
        await saveUser(env, user);
        await ctx.reply(
          "✅ <b>Proof Submitted!</b>\nYour submission is now pending admin verification.",
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }

      if (user.state === "USER_SETTING_WALLET") {
        user.walletAddress = text;
        user.state = null;
        user.stateData = {};
        await saveUser(env, user);
        await ctx.reply(
          `✅ <b>Wallet Updated!</b>\n<code>${escapeHtml(user.walletAddress)}</code>`,
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }

      if (user.state === "USER_WITHDRAW_AMOUNT") {
        const amount = Number(text);
        if (
          isNaN(amount) ||
          amount < Number(settings.minWithdraw) ||
          amount > Number(user.balance)
        ) {
          await ctx.reply(
            `⚠️ Invalid amount. Enter a number between ${settings.minWithdraw} and ${user.balance}.`,
            { parse_mode: "HTML" }
          );
          return;
        }
        user.balance = Number(user.balance) - amount;
        user.withdrawn = Number(user.withdrawn || 0) + amount;
        user.state = null;
        user.stateData = {};
        await saveUser(env, user);

        const payouts = await getPayouts(env);
        payouts.push({
          id: `pay_${Date.now().toString().slice(-6)}`,
          userId: user.id,
          amount,
          wallet: user.walletAddress,
          status: "pending",
          createdAt: new Date().toISOString(),
        });
        await savePayouts(env, payouts);
        await ctx.reply(
          `✅ <b>Withdrawal Requested!</b>\nAmount: <code>${formatMoney(
            amount,
            settings.currencySymbol
          )}</code>`,
          { parse_mode: "HTML", reply_markup: buildUserReplyKeyboard() }
        );
        return;
      }

      if (user.state === "ADMIN_CREATE_TASK" && (await isAuthorizedAdmin(user.id, env))) {
        const parts = text.split("|").map((s: string) => s.trim());
        if (parts.length >= 3) {
          const tasks = await getTasks(env);
          tasks.push({
            id: `task_${Date.now().toString().slice(-5)}`,
            title: parts[0],
            description: parts[1],
            reward: Number(parts[2]) || 1.0,
            url: parts[3] || settings.forceChannelUrl,
            active: true,
            createdAt: new Date().toISOString(),
          });
          await saveTasks(env, tasks);
          user.state = null;
          await saveUser(env, user);
          await ctx.reply("✅ Task created!", { reply_markup: buildAdminPanelKeyboard() });
          return;
        }
      }

      if (user.state === "ADMIN_SET_REWARDS" && (await isAuthorizedAdmin(user.id, env))) {
        const parts = text.split("|").map((s: string) => Number(s.trim()));
        if (parts.length === 4 && parts.every((n: number) => !isNaN(n))) {
          settings.welcomeBonus = parts[0];
          settings.referralBonus = parts[1];
          settings.dailyBonus = parts[2];
          settings.minWithdraw = parts[3];
          await saveSettings(env, settings);
          user.state = null;
          await saveUser(env, user);
          await ctx.reply("✅ Rewards & bonuses updated!", {
            reply_markup: buildAdminPanelKeyboard(),
          });
          return;
        }
      }

      if (user.state === "ADMIN_INSPECT_USER" && (await isAuthorizedAdmin(user.id, env))) {
        const target = await getUser(env, text);
        user.state = null;
        await saveUser(env, user);
        if (!target) {
          await ctx.reply("⚠️ User not found.", { reply_markup: buildAdminBackKeyboard() });
          return;
        }
        await ctx.reply(
          `🔍 <b>User Profile:</b> <code>${escapeHtml(target.id)}</code>\n` +
            `👤 <b>Name:</b> ${escapeHtml(target.firstName)} (${escapeHtml(target.username)})\n` +
            `💰 <b>Balance:</b> <code>${formatMoney(
              target.balance,
              settings.currencySymbol
            )}</code>\n` +
            `👥 <b>Referrals:</b> <code>${target.referralsCount || 0}</code>\n` +
            `🏦 <b>Wallet:</b> <code>${escapeHtml(target.walletAddress)}</code>`,
          { parse_mode: "HTML", reply_markup: buildAdminBackKeyboard() }
        );
        return;
      }

      if (user.state === "ADMIN_BROADCAST" && (await isAuthorizedAdmin(user.id, env))) {
        const userIds = await getUserIndex(env);
        for (const uid of userIds) {
          try {
            await ctx.api.sendMessage(Number(uid), `📢 <b>Broadcast:</b>\n${text}`, {
              parse_mode: "HTML",
            });
          } catch (_) {}
        }
        user.state = null;
        await saveUser(env, user);
        await ctx.reply("✅ Broadcast sent!", { reply_markup: buildAdminPanelKeyboard() });
        return;
      }
    }

    // Menu Buttons
    if (text === "🎯 Earn Tasks") {
      const tasks = (await getTasks(env)).filter((t) => t.active);
      const kb = new InlineKeyboard();
      for (const t of tasks) {
        kb.text(`🎯 ${t.title} (+${t.reward})`, `task:view:${t.id}`).row();
      }
      await ctx.reply("🎯 <b>Available Tasks:</b>", {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      return;
    }

    if (text === "💰 My Balance") {
      await ctx.reply(
        `💰 Balance: <b>${formatMoney(user.balance, settings.currencySymbol)}</b>`,
        { parse_mode: "HTML" }
      );
      return;
    }

    if (text === "💳 Wallet & Withdraw") {
      const kb = new InlineKeyboard()
        .text("✏️ Set Wallet", "wallet:set_address")
        .row()
        .text("💸 Withdraw", "wallet:withdraw");
      await ctx.reply(`💳 Wallet: <code>${escapeHtml(user.walletAddress)}</code>`, {
        parse_mode: "HTML",
        reply_markup: kb,
      });
      return;
    }

    if (text === "👥 Refer & Earn") {
      const botUsername = env?.BOT_USERNAME || ctx.me?.username || "ZenoxWorkerBot";
      const link = `https://t.me/${botUsername}?start=ref_${user.id}`;
      await ctx.reply(`👥 Referral Link:\n<code>${link}</code>`, { parse_mode: "HTML" });
      return;
    }

    if (text === "🎁 Daily Bonus") {
      const bonus = Number(settings.dailyBonus || 0.5);
      user.balance = Number(user.balance || 0) + bonus;
      await saveUser(env, user);
      await ctx.reply(`🎁 Claimed +${bonus}!`, { parse_mode: "HTML" });
      return;
    }

    if (text === "🛟 Support") {
      await ctx.reply(`🛟 Support: ${settings.supportUsername}`, { parse_mode: "HTML" });
      return;
    }

    await ctx.reply("🤖 Use the buttons below:", { reply_markup: buildUserReplyKeyboard() });
  });

  return bot;
}

// ============================================================================
// 8. CLOUDFLARE WORKERS FETCH ENTRYPOINT
// ============================================================================
export default {
  async fetch(request: Request, env: Env, _ctx?: any): Promise<Response> {
    try {
      const url = new URL(request.url);
      const cfg = resolveEnvConfig(env);

      if (request.method === "GET" && url.pathname === "/setWebhook") {
        const webhookUrl = `${url.origin}/`;
        const tgRes = await fetch(
          `https://api.telegram.org/bot${cfg.BOT_TOKEN}/setWebhook?url=${encodeURIComponent(
            webhookUrl
          )}&drop_pending_updates=true`
        );
        const data = await tgRes.json();
        return new Response(
          JSON.stringify({ ok: true, webhookUrl, telegramResponse: data }, null, 2),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      }

      if (request.method === "GET") {
        return new Response(
          JSON.stringify({ status: "OK", service: "Zenox Telegram Bot" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }

      if (request.method === "POST") {
        const update = await request.json();
        const bot = createBotInstance(env);
        await bot.init();
        await bot.handleUpdate(update);
        return new Response("OK", { status: 200 });
      }

      return new Response("OK", { status: 200 });
    } catch (error) {
      console.error("[Worker Error]:", error);
      return new Response("OK", { status: 200 });
    }
  },
};
