import type { NeonClient } from "./db";

interface ExpiringSubscription {
  subscription_id: number;
  customer_email: string;
  customer_name: string | null;
  plan_name: string;
  expiry_date: string;
  days_remaining: number;
}

export async function sendExpiryReminder(
  resendApiKey: string,
  adminEmail: string,
  fromEmail: string,
  subscriptions: ExpiringSubscription[]
): Promise<void> {
  if (subscriptions.length === 0) return;

  const rows = subscriptions
    .map(
      (s) =>
        `• ${s.customer_name || s.customer_email} (${s.customer_email}) — expires ${s.expiry_date} (${s.days_remaining} days left)`
    )
    .join("\n");

  const htmlRows = subscriptions
    .map(
      (s) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #2a2a3e;">${s.customer_name || "—"}</td>
        <td style="padding: 8px; border-bottom: 1px solid #2a2a3e;">${s.customer_email}</td>
        <td style="padding: 8px; border-bottom: 1px solid #2a2a3e;">${s.expiry_date}</td>
        <td style="padding: 8px; border-bottom: 1px solid #2a2a3e; color: ${s.days_remaining <= 1 ? "#ef4444" : "#f59e0b"}; font-weight: bold;">${s.days_remaining} days</td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family: 'Inter', sans-serif; background: #0f0f23; color: #e2e8f0; padding: 32px; border-radius: 12px;">
      <h2 style="color: #818cf8; margin-bottom: 8px;">⚡ Substrack Reminder</h2>
      <p style="color: #94a3b8; margin-bottom: 24px;">${subscriptions.length} subscription(s) expiring soon:</p>
      <table style="width: 100%; border-collapse: collapse; background: #1a1a2e; border-radius: 8px; overflow: hidden;">
        <thead>
          <tr style="background: #16163a;">
            <th style="padding: 12px 8px; text-align: left; color: #818cf8;">Name</th>
            <th style="padding: 12px 8px; text-align: left; color: #818cf8;">Email</th>
            <th style="padding: 12px 8px; text-align: left; color: #818cf8;">Expiry</th>
            <th style="padding: 12px 8px; text-align: left; color: #818cf8;">Remaining</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail || "Substrack <noreply@substrack.dev>",
      to: [adminEmail],
      subject: `⚡ ${subscriptions.length} subscription(s) expiring soon`,
      html,
      text: `Substrack Reminder\n\n${subscriptions.length} subscription(s) expiring soon:\n\n${rows}`,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[EMAIL] Failed to send: ${err}`);
    throw new Error(`Resend API error: ${response.status}`);
  }

  console.log(`[EMAIL] Reminder sent to ${adminEmail} for ${subscriptions.length} subscriptions`);
}

export async function getExpiringSubscriptions(
  sql: NeonClient,
  daysAhead: number = 3
): Promise<ExpiringSubscription[]> {
  const rows = await sql`
    SELECT
      subscription_id,
      customer_email,
      customer_name,
      plan_name,
      expiry_date::text as expiry_date,
      (expiry_date - CURRENT_DATE) as days_remaining
    FROM subscriptions
    WHERE status = 'active'
      AND expiry_date <= CURRENT_DATE + ${daysAhead}
      AND expiry_date >= CURRENT_DATE
      AND reminder_sent = false
    ORDER BY expiry_date ASC
  `;
  return rows as ExpiringSubscription[];
}

export async function markReminderSent(
  sql: NeonClient,
  ids: number[]
): Promise<void> {
  if (ids.length === 0) return;
  await sql`
    UPDATE subscriptions
    SET reminder_sent = true, updated_at = NOW()
    WHERE subscription_id = ANY(${ids})
  `;
}

export async function markExpiredSubscriptions(
  sql: NeonClient
): Promise<number> {
  const result = await sql`
    UPDATE subscriptions
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active'
      AND expiry_date < CURRENT_DATE
    RETURNING subscription_id
  `;
  return result.length;
}
