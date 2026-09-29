export const runtime = 'edge'
import { Globe, Star, CheckCircle, Clock, AlertCircle, ExternalLink, MessageSquare, MapPin, TrendingUp } from "lucide-react"
import { loadPortal } from "@/lib/client-portal"
import { getClientLocations, getClientGscSnapshots, getClientReviews } from "@/lib/db"
import { PageHeader, Empty } from "@/components/portal-ui"

export const dynamic = "force-dynamic"

const STATUS_LABEL: Record<string, { label: string; color: string; icon: any }> = {
  deployed:           { label: "Live",          color: "var(--success)", icon: CheckCircle },
  outreach_sent:      { label: "Live",          color: "var(--success)", icon: CheckCircle },
  sms_sent:           { label: "Live",          color: "var(--success)", icon: CheckCircle },
  conversation_active:{ label: "In Progress",   color: "var(--info)",    icon: Clock },
  meeting_scheduled:  { label: "Meeting Set",   color: "var(--accent-light)", icon: Clock },
  payment_link_sent:  { label: "Payment Sent",  color: "var(--warning)", icon: Clock },
  paid:               { label: "Active Client", color: "var(--paid)",    icon: CheckCircle },
  handed_off:         { label: "Active Client", color: "var(--paid)",    icon: CheckCircle },
  built:              { label: "Building",      color: "var(--warning)", icon: Clock },
  analyzed:           { label: "Preparing",     color: "var(--warning)", icon: Clock },
  error:              { label: "Issue Detected",color: "var(--error)",   icon: AlertCircle },
}

const PLAN_LABEL: Record<string, { label: string; color: string }> = {
  launch: { label: "Launch",  color: "#f59e0b" },
  grow:   { label: "Grow",    color: "var(--accent)" },
  scale:  { label: "Scale",   color: "#10b981" },
  ai_front_office: { label: "AI Front Office", color: "var(--accent)" },
}


export default async function WebsitePage() {
  const p = await loadPortal()
  const { lead, siteUrl } = p
  if (!p.hasSite) {
    return (
      <>
        <PageHeader title="Website" />
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14 }}>
          <Empty title="No website on your plan" body="Your plan covers the AI receptionist. If you'd like a website built for your business, ask us from Help & requests." />
        </div>
      </>
    )
  }
  const [locations, gscSnapshots, reviews] = await Promise.all([getClientLocations(p.email), getClientGscSnapshots(lead.id, 8), getClientReviews(lead.id, 10)])
  const isMultiLocation = locations.length > 1
  const latestGsc = gscSnapshots[0] ?? null
  const hasGscData = gscSnapshots.length > 0
  const hasReviews = reviews.length > 0
  const statusInfo = STATUS_LABEL[lead.status] ?? { label: lead.status, color: "var(--muted)", icon: Clock }
  const StatusIcon = statusInfo.icon
  const planInfo = PLAN_LABEL[lead.subscription_plan ?? lead.client_plan ?? "launch"] ?? PLAN_LABEL.launch

  return (
    <>
      <PageHeader title="Website" subtitle="How your site is doing: status, visitors from Google, and reviews." />
        {/* Site status card — hidden for AI-only clients (no site was ever part of their plan) */}
                <div
          style={{
            background:   "var(--surface)",
            border:       "1px solid var(--border)",
            borderRadius: 14,
            padding:      "24px 28px",
            marginBottom: 20,
          }}
        >
          <div
            style={{
              display:        "flex",
              alignItems:     "center",
              justifyContent: "space-between",
              marginBottom:   20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <StatusIcon size={18} color={statusInfo.color} />
              <span
                style={{
                  fontSize:   15,
                  fontWeight: 700,
                  color:      statusInfo.color,
                }}
              >
                {statusInfo.label}
              </span>
            </div>
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display:      "flex",
                  alignItems:   "center",
                  gap:          6,
                  background:   "var(--accent)",
                  color:        "#fff",
                  padding:      "9px 18px",
                  borderRadius: 8,
                  fontWeight:   700,
                  fontSize:     13,
                  textDecoration: "none",
                }}
              >
                <Globe size={14} />
                View Your Site
                <ExternalLink size={12} />
              </a>
            )}
          </div>

          <div
            style={{
              background:   "var(--surface-2)",
              border:       "1px solid var(--border)",
              borderRadius: 8,
              padding:      "12px 16px",
            }}
          >
            <div style={{ fontSize: 11, color: "var(--muted)", marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Website URL
            </div>
            {siteUrl ? (
              <a
                href={siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color:          "var(--accent-light)",
                  fontSize:       13,
                  textDecoration: "none",
                  fontWeight:     500,
                }}
              >
                {siteUrl}
              </a>
            ) : (
              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                Site is being built — check back soon
              </span>
            )}
          </div>
        </div>

        {/* Stats row */}
        <div
          style={{
            display:             "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap:                 16,
            marginBottom:        20,
          }}
        >
          {/* Site score */}
          {<div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 12,
              padding:      "18px 20px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Site Performance
            </div>
            {lead.site_score != null ? (
              <>
                <div
                  style={{
                    fontSize:      28,
                    fontWeight:    800,
                    letterSpacing: "-0.04em",
                    color:
                      lead.site_score >= 70
                        ? "var(--success)"
                        : lead.site_score >= 50
                        ? "var(--warning)"
                        : "var(--error)",
                    lineHeight:    1,
                    marginBottom:  8,
                  }}
                >
                  {lead.site_score}
                  <span style={{ fontSize: 14, fontWeight: 500, color: "var(--muted)" }}>/100</span>
                </div>
                <div
                  style={{
                    height:         5,
                    borderRadius:   3,
                    background:     "var(--border-2)",
                    overflow:       "hidden",
                  }}
                >
                  <div
                    style={{
                      height:       "100%",
                      width:        `${lead.site_score}%`,
                      background:
                        lead.site_score >= 70
                          ? "var(--success)"
                          : lead.site_score >= 50
                          ? "var(--warning)"
                          : "var(--error)",
                      borderRadius: 3,
                      transition:   "width 0.4s ease",
                    }}
                  />
                </div>
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>
                Being measured…
              </div>
            )}
          </div>}

          {/* Google rating */}
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 12,
              padding:      "18px 20px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Google Reviews
            </div>
            {lead.rating != null ? (
              <>
                <div
                  style={{
                    display:     "flex",
                    alignItems:  "baseline",
                    gap:         6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      fontSize:      28,
                      fontWeight:    800,
                      letterSpacing: "-0.04em",
                      color:         "var(--warning)",
                      lineHeight:    1,
                    }}
                  >
                    {lead.rating}
                  </span>
                  <Star size={16} color="var(--warning)" fill="var(--warning)" />
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>
                  {lead.review_count ?? 0} reviews
                </div>
              </>
            ) : (
              <div style={{ color: "var(--muted)", fontSize: 13 }}>No data yet</div>
            )}
          </div>

          {/* Account / plan */}
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 12,
              padding:      "18px 20px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>
              Your Plan
            </div>
            <div
              style={{
                fontSize:      20,
                fontWeight:    800,
                color:         planInfo.color,
                lineHeight:    1,
                marginBottom:  6,
                letterSpacing: "-0.02em",
              }}
            >
              {planInfo.label}
            </div>
            <div style={{ fontSize: 12, color: lead.paid ? "var(--paid)" : "var(--warning)" }}>
              {lead.paid ? "✓ Active" : "Pending payment"}
            </div>
          </div>
        </div>

        {/* Multi-location panel (Scale only) */}
        {isMultiLocation && (
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 14,
              padding:      "24px 28px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <MapPin size={16} color="var(--accent-light)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
                All Locations ({locations.length})
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {locations.map((loc) => {
                const locStatus = STATUS_LABEL[loc.status] ?? { label: loc.status, color: "var(--muted)", icon: Clock }
                const LocIcon = locStatus.icon
                const locUrl = loc.cloudflare_url ?? loc.vercel_url
                return (
                  <div
                    key={loc.id}
                    style={{
                      background:   "var(--surface-2)",
                      border:       "1px solid var(--border)",
                      borderRadius: 10,
                      padding:      "14px 18px",
                      display:      "flex",
                      alignItems:   "center",
                      justifyContent: "space-between",
                      gap:          12,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{loc.name}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        {loc.city}, {loc.state}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <LocIcon size={13} color={locStatus.color} />
                        <span style={{ fontSize: 12, color: locStatus.color, fontWeight: 600 }}>{locStatus.label}</span>
                      </div>
                      {locUrl && (
                        <a
                          href={locUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "flex", alignItems: "center", gap: 4,
                            color: "var(--accent-light)", fontSize: 12,
                            textDecoration: "none", fontWeight: 600,
                          }}
                        >
                          <Globe size={12} />
                          View
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* GSC Traffic section */}
        {hasGscData && latestGsc && (
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 14,
              padding:      "22px 28px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <Globe size={16} color="var(--accent-light)" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Google Search Traffic</span>
              </div>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>28-day period</span>
            </div>

            {/* Latest snapshot stats */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginBottom: 18 }}>
              {[
                { label: "Clicks",      value: latestGsc.total_clicks.toLocaleString(),      color: "#10b981" },
                { label: "Impressions", value: latestGsc.total_impressions.toLocaleString(), color: "var(--accent)" },
                { label: "CTR",         value: latestGsc.ctr_pct != null ? `${latestGsc.ctr_pct}%` : "—", color: "#8b5cf6" },
                { label: "Avg Position",value: latestGsc.avg_position != null ? `#${latestGsc.avg_position}` : "—", color: "#f59e0b" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.07em", fontWeight: 700, marginBottom: 6 }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color, letterSpacing: "-0.03em", lineHeight: 1 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Weekly clicks trend bars */}
            {gscSnapshots.length > 1 && (
              <div>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Click Trend</div>
                <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 48 }}>
                  {[...gscSnapshots].reverse().map((snap, i) => {
                    const maxClicks = Math.max(...gscSnapshots.map(s => s.total_clicks), 1)
                    const h = Math.max(4, Math.round((snap.total_clicks / maxClicks) * 48))
                    const isLatest = i === gscSnapshots.length - 1
                    return (
                      <div key={snap.id} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "flex-end", gap: 3 }}>
                        <div
                          style={{
                            width: "100%", height: h,
                            background: isLatest ? "#10b981" : "rgba(16,185,129,0.25)",
                            borderRadius: 3,
                            transition: "height 0.3s ease",
                          }}
                        />
                        <div style={{ fontSize: 9, color: "var(--muted)", whiteSpace: "nowrap" }}>
                          {new Date(snap.period_start).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Top keywords */}
            {latestGsc.top_keywords && latestGsc.top_keywords.length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "var(--muted)", fontWeight: 600, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Top Keywords</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {latestGsc.top_keywords.slice(0, 5).map((kw, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 10px", background: "var(--surface-2)", borderRadius: 6, border: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 12, color: "var(--text)", fontWeight: 500 }}>{kw.keyword}</span>
                      <span style={{ fontSize: 12, color: "#10b981", fontWeight: 700 }}>{kw.clicks} clicks</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Google Reviews feed */}
        {hasReviews && (
          <div
            style={{
              background:   "var(--surface)",
              border:       "1px solid var(--border)",
              borderRadius: 14,
              padding:      "22px 28px",
              marginBottom: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <Star size={16} color="var(--warning)" fill="var(--warning)" />
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text)" }}>Google Reviews</span>
              <span style={{ fontSize: 11, color: "var(--muted)", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 20, padding: "2px 8px" }}>
                {reviews.length} recent
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {reviews.map((review) => {
                const stars = "★".repeat(review.rating) + "☆".repeat(5 - review.rating)
                const dateStr = review.review_date
                  ? new Date(review.review_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                  : null
                return (
                  <div
                    key={review.id}
                    style={{
                      background:   "var(--surface-2)",
                      border:       "1px solid var(--border)",
                      borderRadius: 10,
                      padding:      "14px 16px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text)" }}>
                          {review.reviewer_name ?? "Anonymous"}
                        </span>
                        <span style={{ fontSize: 13, color: "var(--warning)", letterSpacing: 1 }}>{stars}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {review.our_reply && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", borderRadius: 4, padding: "2px 6px" }}>
                            REPLIED
                          </span>
                        )}
                        {dateStr && <span style={{ fontSize: 11, color: "var(--muted)" }}>{dateStr}</span>}
                      </div>
                    </div>
                    {review.comment && (
                      <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--muted)", lineHeight: 1.6 }}>
                        {review.comment.length > 180 ? review.comment.slice(0, 180) + "…" : review.comment}
                      </p>
                    )}
                    {review.our_reply && (
                      <div style={{ borderLeft: "2px solid rgba(0,194,110,0.4)", paddingLeft: 10, marginTop: 6 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, color: "var(--accent-light)", marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                          Your AI Reply
                        </div>
                        <p style={{ margin: 0, fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                          {review.our_reply.length > 160 ? review.our_reply.slice(0, 160) + "…" : review.our_reply}
                        </p>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

    </>
  )
}
