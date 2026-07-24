import React, { useState } from "react";
import {
  Calendar as CalendarIcon,
  Megaphone,
  BookOpen,
  ClipboardList,
  MessageCircle,
  ChevronLeft,
  Circle,
  CheckCircle2,
  Clock,
  MapPin,
} from "lucide-react";

/* ---------------------------------------------------------
   TOKENS
--------------------------------------------------------- */
const COLORS = {
  cover: "#1C1C1E",       // marbled notebook black
  paper: "#F6F3EC",       // chalk/paper white
  paperDim: "#EDE9DE",
  tape: "#C1272D",        // red binding tape
  pencil: "#F4B942",      // pencil yellow highlight
  chalk: "#33513F",       // chalkboard green
  chalkSoft: "#DCE6DF",
  ink: "#1F1F1F",
  graphite: "#6B6B66",
  graphiteLight: "#A6A29A",
  line: "#DDD7C8",
  danger: "#B3261E",
};

const FONT_HAND = "'Bradley Hand', 'Segoe Print', 'Comic Sans MS', cursive";
const FONT_BODY =
  "'Avenir Next', 'Segoe UI', ui-sans-serif, system-ui, sans-serif";
const FONT_MONO =
  "'IBM Plex Mono', ui-monospace, SFMono-Regular, Menlo, monospace";

/* ---------------------------------------------------------
   MOCK DATA
--------------------------------------------------------- */
const STUDENT = { name: "Maya Torres", grade: "Grade 8", school: "Elmwood Academy" };

const WEEK = [
  { d: "MON", n: 20 },
  { d: "TUE", n: 21 },
  { d: "WED", n: 22 },
  { d: "THU", n: 23 },
  { d: "FRI", n: 24 },
  { d: "SAT", n: 25 },
  { d: "SUN", n: 26 },
];

const EVENTS = {
  20: [{ t: "Science Fair Projects Due", time: "8:30 AM", cat: "Deadline" }],
  21: [{ t: "Chess Club", time: "3:30 PM", cat: "Club" }],
  22: [
    { t: "Half Day — Staff PD", time: "12:15 PM dismissal", cat: "Holiday" },
  ],
  23: [{ t: "Fall Choir Concert", time: "6:00 PM · Auditorium", cat: "Event" }],
  24: [
    { t: "Math Quiz — Ch. 4", time: "9:15 AM", cat: "Academic" },
    { t: "Soccer vs. Rosewood", time: "4:00 PM · Home", cat: "Sports" },
  ],
  25: [],
  26: [],
};

const CAT_COLOR = {
  Deadline: COLORS.tape,
  Club: COLORS.chalk,
  Holiday: COLORS.pencil,
  Event: "#5B6EE1",
  Academic: COLORS.tape,
  Sports: COLORS.chalk,
};

const ANNOUNCEMENTS = [
  {
    from: "Principal's Office",
    title: "Picture Day moved to Nov 3rd",
    body:
      "Due to the auditorium booking conflict, Picture Day will now take place next Tuesday. Order forms are due the day before.",
    time: "2h ago",
    tag: "School",
  },
  {
    from: "Athletics",
    title: "Soccer sign-ups close Friday",
    body:
      "Spring soccer registration closes this Friday at 5 PM. Forms are available at the front office or online.",
    time: "5h ago",
    tag: "Sports",
  },
  {
    from: "PTA",
    title: "Fall Bake Sale volunteers needed",
    body:
      "We're still short a few volunteers for Saturday's bake sale table. Sign up via the link in last week's newsletter.",
    time: "1d ago",
    tag: "PTA",
  },
  {
    from: "Nurse's Office",
    title: "Flu shot clinic next week",
    body:
      "A free flu shot clinic will be held in the gym Tuesday and Wednesday. Permission slips went home today.",
    time: "2d ago",
    tag: "Health",
  },
];

const SCHEDULE_TODAY = [
  { period: 1, subj: "Algebra I", room: "Rm 214", time: "8:00 – 8:50", teacher: "Mr. Han" },
  { period: 2, subj: "English 8", room: "Rm 108", time: "8:55 – 9:45", teacher: "Ms. Okafor" },
  { period: 3, subj: "Earth Science", room: "Lab 3", time: "9:50 – 10:40", teacher: "Dr. Patel" },
  { period: 4, subj: "World History", room: "Rm 220", time: "10:45 – 11:35", teacher: "Mr. Diaz" },
  { period: 5, subj: "Lunch", room: "Cafeteria", time: "11:35 – 12:10", teacher: "" },
  { period: 6, subj: "Studio Art", room: "Rm 5", time: "12:15 – 1:05", teacher: "Mrs. Bell" },
  { period: 7, subj: "Phys Ed", room: "Gym", time: "1:10 – 2:00", teacher: "Coach Reyes" },
];

const GRADES = [
  { subj: "Algebra I", grade: "A-", pct: 91 },
  { subj: "English 8", grade: "B+", pct: 88 },
  { subj: "Earth Science", grade: "A", pct: 95 },
  { subj: "World History", grade: "B", pct: 84 },
  { subj: "Studio Art", grade: "A", pct: 97 },
];

const gradeColor = (pct) =>
  pct >= 93 ? COLORS.chalk : pct >= 85 ? "#5B6EE1" : pct >= 75 ? COLORS.pencil : COLORS.tape;

const HOMEWORK_INIT = [
  { id: 1, subj: "Algebra I", title: "Worksheet 4.3 — even problems", due: "Due tomorrow", done: false, priority: "high" },
  { id: 2, subj: "English 8", title: "Read Ch. 6 of Holes, write summary", due: "Due Fri", done: false, priority: "med" },
  { id: 3, subj: "Earth Science", title: "Rock cycle diagram", due: "Due Mon", done: false, priority: "low" },
  { id: 4, subj: "World History", title: "Study for Ch. 5 test", due: "Due Wed", done: true, priority: "med" },
  { id: 5, subj: "Studio Art", title: "Bring sketchbook", due: "Due tomorrow", done: false, priority: "low" },
];

const THREADS = [
  { from: "Ms. Okafor (English)", snippet: "Great work on the summary draft — one small note on...", time: "10:40 AM", unread: 2 },
  { from: "Front Office", snippet: "Reminder: early dismissal permission slip is due...", time: "Yesterday", unread: 0 },
  { from: "Coach Reyes", snippet: "Practice moved to the small gym today, see you at...", time: "Mon", unread: 1 },
  { from: "Mr. Han (Algebra)", snippet: "Nice job catching that error on problem 12!", time: "Fri", unread: 0 },
];

/* ---------------------------------------------------------
   SHARED BITS
--------------------------------------------------------- */
function TapeStrip({ label }) {
  return (
    <div
      style={{
        position: "absolute",
        top: -10,
        left: "50%",
        transform: "translateX(-50%) rotate(-1.5deg)",
        background: COLORS.tape,
        color: "#fff",
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: 1,
        padding: "4px 14px",
        borderRadius: 2,
        boxShadow: "0 2px 4px rgba(0,0,0,0.25)",
      }}
    >
      {label}
    </div>
  );
}

function ScreenHeader({ title, sub }) {
  return (
    <div
      style={{
        position: "relative",
        background: COLORS.cover,
        backgroundImage:
          "radial-gradient(circle at 20% 30%, rgba(255,255,255,0.05) 0, transparent 40%), radial-gradient(circle at 70% 70%, rgba(255,255,255,0.04) 0, transparent 35%), radial-gradient(circle at 50% 50%, rgba(255,255,255,0.03) 0, transparent 60%)",
        padding: "22px 20px 18px",
        borderBottomLeftRadius: 18,
        borderBottomRightRadius: 18,
      }}
    >
      <div style={{ color: COLORS.graphiteLight, fontFamily: FONT_MONO, fontSize: 11, letterSpacing: 1.5 }}>
        {STUDENT.school.toUpperCase()}
      </div>
      <div
        style={{
          color: COLORS.paper,
          fontFamily: FONT_HAND,
          fontSize: 30,
          marginTop: 2,
          lineHeight: 1.1,
        }}
      >
        {title}
      </div>
      {sub && (
        <div style={{ color: COLORS.graphiteLight, fontFamily: FONT_BODY, fontSize: 12.5, marginTop: 4 }}>
          {sub}
        </div>
      )}
    </div>
  );
}

function CatPill({ cat }) {
  const c = CAT_COLOR[cat] || COLORS.graphite;
  return (
    <span
      style={{
        fontFamily: FONT_MONO,
        fontSize: 10,
        letterSpacing: 0.5,
        color: c,
        border: `1px solid ${c}`,
        borderRadius: 20,
        padding: "2px 8px",
        whiteSpace: "nowrap",
      }}
    >
      {cat}
    </span>
  );
}

/* ---------------------------------------------------------
   TAB: CALENDAR
--------------------------------------------------------- */
function CalendarTab() {
  const [sel, setSel] = useState(24);
  const dayEvents = EVENTS[sel] || [];

  return (
    <div>
      <ScreenHeader title="Calendar" sub="October 2026" />
      <div style={{ padding: "16px 16px 0" }}>
        <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 4 }}>
          {WEEK.map((w) => {
            const active = w.n === sel;
            const hasEvents = (EVENTS[w.n] || []).length > 0;
            return (
              <button
                key={w.n}
                onClick={() => setSel(w.n)}
                style={{
                  flex: "0 0 auto",
                  width: 46,
                  padding: "8px 0",
                  borderRadius: 12,
                  border: active ? "none" : `1px solid ${COLORS.line}`,
                  background: active ? COLORS.chalk : COLORS.paper,
                  cursor: "pointer",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    color: active ? COLORS.paper : COLORS.graphiteLight,
                  }}
                >
                  {w.d}
                </div>
                <div
                  style={{
                    fontFamily: FONT_BODY,
                    fontWeight: 600,
                    fontSize: 16,
                    color: active ? COLORS.paper : COLORS.ink,
                    marginTop: 2,
                  }}
                >
                  {w.n}
                </div>
                <div
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 4,
                    margin: "4px auto 0",
                    background: hasEvents ? (active ? COLORS.paper : COLORS.tape) : "transparent",
                  }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: "18px 16px 90px" }}>
        {dayEvents.length === 0 ? (
          <div
            style={{
              fontFamily: FONT_BODY,
              color: COLORS.graphiteLight,
              fontSize: 13,
              textAlign: "center",
              padding: "30px 0",
              border: `1px dashed ${COLORS.line}`,
              borderRadius: 14,
            }}
          >
            Nothing on the schedule for this day.
          </div>
        ) : (
          dayEvents.map((e, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 12,
                background: COLORS.paper,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 10,
                alignItems: "flex-start",
              }}
            >
              <div
                style={{
                  width: 4,
                  alignSelf: "stretch",
                  borderRadius: 4,
                  background: CAT_COLOR[e.cat] || COLORS.graphite,
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14.5, color: COLORS.ink }}>
                  {e.t}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginTop: 4,
                    color: COLORS.graphite,
                    fontFamily: FONT_MONO,
                    fontSize: 11.5,
                  }}
                >
                  <Clock size={12} /> {e.time}
                </div>
              </div>
              <CatPill cat={e.cat} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TAB: NEWS / ANNOUNCEMENTS
--------------------------------------------------------- */
function NewsTab() {
  return (
    <div>
      <ScreenHeader title="News" sub="From the front office" />
      <div style={{ padding: "16px 16px 90px" }}>
        {ANNOUNCEMENTS.map((a, i) => (
          <div
            key={i}
            style={{
              background: COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: "14px 14px",
              marginBottom: 12,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  color: COLORS.chalk,
                  background: COLORS.chalkSoft,
                  borderRadius: 20,
                  padding: "2px 9px",
                }}
              >
                {a.from}
              </span>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10.5, color: COLORS.graphiteLight }}>
                {a.time}
              </span>
            </div>
            <div style={{ fontFamily: FONT_BODY, fontWeight: 700, fontSize: 15.5, color: COLORS.ink, marginTop: 8 }}>
              {a.title}
            </div>
            <div style={{ fontFamily: FONT_BODY, fontSize: 13, color: COLORS.graphite, marginTop: 4, lineHeight: 1.45 }}>
              {a.body}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TAB: CLASSES (schedule + grades)
--------------------------------------------------------- */
function ClassesTab() {
  const [view, setView] = useState("schedule");
  return (
    <div>
      <ScreenHeader title="Classes" sub={STUDENT.grade} />
      <div style={{ padding: "16px 16px 0", display: "flex", gap: 8 }}>
        {["schedule", "grades"].map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 10,
              border: `1px solid ${view === v ? COLORS.cover : COLORS.line}`,
              background: view === v ? COLORS.cover : COLORS.paper,
              color: view === v ? COLORS.paper : COLORS.graphite,
              fontFamily: FONT_BODY,
              fontWeight: 600,
              fontSize: 13,
              cursor: "pointer",
              textTransform: "capitalize",
            }}
          >
            {v === "schedule" ? "Today" : "Grades"}
          </button>
        ))}
      </div>

      <div style={{ padding: "16px 16px 90px" }}>
        {view === "schedule" ? (
          SCHEDULE_TODAY.map((s, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 4px",
                borderBottom: i < SCHEDULE_TODAY.length - 1 ? `1px dashed ${COLORS.line}` : "none",
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 11,
                  color: COLORS.paper,
                  background: COLORS.chalk,
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {s.period}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                  {s.subj}
                </div>
                {s.teacher && (
                  <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: COLORS.graphiteLight }}>
                    {s.teacher} · <MapPin size={10} style={{ display: "inline", marginBottom: -1 }} /> {s.room}
                  </div>
                )}
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 11, color: COLORS.graphite, textAlign: "right" }}>
                {s.time}
              </div>
            </div>
          ))
        ) : (
          GRADES.map((g, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: COLORS.paper,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 10,
              }}
            >
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontWeight: 700,
                  fontSize: 15,
                  color: gradeColor(g.pct),
                  border: `2px solid ${gradeColor(g.pct)}`,
                  borderRadius: 10,
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {g.grade}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                  {g.subj}
                </div>
                <div style={{ background: COLORS.paperDim, height: 5, borderRadius: 4, marginTop: 6, overflow: "hidden" }}>
                  <div style={{ width: `${g.pct}%`, height: "100%", background: gradeColor(g.pct) }} />
                </div>
              </div>
              <div style={{ fontFamily: FONT_MONO, fontSize: 12, color: COLORS.graphite }}>{g.pct}%</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TAB: HOMEWORK
--------------------------------------------------------- */
function HomeworkTab() {
  const [items, setItems] = useState(HOMEWORK_INIT);
  const toggle = (id) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, done: !it.done } : it)));

  const remaining = items.filter((i) => !i.done).length;
  const prColor = { high: COLORS.tape, med: COLORS.pencil, low: COLORS.graphiteLight };

  return (
    <div>
      <ScreenHeader title="Homework" sub={`${remaining} assignment${remaining === 1 ? "" : "s"} left this week`} />
      <div style={{ padding: "16px 16px 90px" }}>
        {items.map((it) => (
          <button
            key={it.id}
            onClick={() => toggle(it.id)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: it.done ? COLORS.paperDim : COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            {it.done ? (
              <CheckCircle2 size={20} color={COLORS.chalk} style={{ flexShrink: 0 }} />
            ) : (
              <Circle size={20} color={COLORS.graphiteLight} style={{ flexShrink: 0 }} />
            )}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: FONT_MONO,
                  fontSize: 10.5,
                  color: COLORS.graphiteLight,
                  letterSpacing: 0.5,
                }}
              >
                {it.subj.toUpperCase()}
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontWeight: 600,
                  fontSize: 14,
                  color: it.done ? COLORS.graphiteLight : COLORS.ink,
                  textDecoration: it.done ? "line-through" : "none",
                  marginTop: 2,
                }}
              >
                {it.title}
              </div>
              <div style={{ fontFamily: FONT_BODY, fontSize: 11.5, color: COLORS.graphite, marginTop: 3 }}>
                {it.due}
              </div>
            </div>
            {!it.done && (
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 8,
                  background: prColor[it.priority],
                  flexShrink: 0,
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   TAB: MESSAGES
--------------------------------------------------------- */
function MessagesTab() {
  const [open, setOpen] = useState(null);

  if (open !== null) {
    const t = THREADS[open];
    return (
      <div>
        <div
          style={{
            background: COLORS.cover,
            padding: "18px 16px 16px",
            borderBottomLeftRadius: 18,
            borderBottomRightRadius: 18,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <button
            onClick={() => setOpen(null)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            <ChevronLeft color={COLORS.paper} size={22} />
          </button>
          <div style={{ color: COLORS.paper, fontFamily: FONT_HAND, fontSize: 22 }}>{t.from}</div>
        </div>
        <div style={{ padding: "20px 16px 90px", display: "flex", flexDirection: "column", gap: 10 }}>
          <div
            style={{
              alignSelf: "flex-start",
              background: COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: "4px 14px 14px 14px",
              padding: "10px 13px",
              maxWidth: "78%",
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              color: COLORS.ink,
            }}
          >
            {t.snippet}
          </div>
          <div
            style={{
              alignSelf: "flex-end",
              background: COLORS.chalk,
              borderRadius: "14px 4px 14px 14px",
              padding: "10px 13px",
              maxWidth: "78%",
              fontFamily: FONT_BODY,
              fontSize: 13.5,
              color: COLORS.paper,
            }}
          >
            Thank you for letting me know!
          </div>
          <div
            style={{
              textAlign: "center",
              fontFamily: FONT_MONO,
              fontSize: 10.5,
              color: COLORS.graphiteLight,
              marginTop: 10,
            }}
          >
            This is a preview thread — messaging isn't wired up yet.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <ScreenHeader title="Messages" sub="Teachers & school office" />
      <div style={{ padding: "16px 16px 90px" }}>
        {THREADS.map((t, i) => (
          <button
            key={i}
            onClick={() => setOpen(i)}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 12,
              background: COLORS.paper,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 14,
              padding: "12px 14px",
              marginBottom: 10,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: COLORS.chalkSoft,
                color: COLORS.chalk,
                fontFamily: FONT_BODY,
                fontWeight: 700,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {t.from[0]}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT_BODY, fontWeight: 600, fontSize: 14, color: COLORS.ink }}>
                {t.from}
              </div>
              <div
                style={{
                  fontFamily: FONT_BODY,
                  fontSize: 12,
                  color: COLORS.graphite,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginTop: 2,
                }}
              >
                {t.snippet}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <span style={{ fontFamily: FONT_MONO, fontSize: 10, color: COLORS.graphiteLight }}>{t.time}</span>
              {t.unread > 0 && (
                <span
                  style={{
                    background: COLORS.tape,
                    color: "#fff",
                    fontFamily: FONT_MONO,
                    fontSize: 10,
                    borderRadius: 20,
                    minWidth: 16,
                    height: 16,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "0 4px",
                  }}
                >
                  {t.unread}
                </span>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------
   ROOT
--------------------------------------------------------- */
const TABS = [
  { key: "calendar", label: "Calendar", icon: CalendarIcon, Comp: CalendarTab },
  { key: "news", label: "News", icon: Megaphone, Comp: NewsTab },
  { key: "classes", label: "Classes", icon: BookOpen, Comp: ClassesTab },
  { key: "homework", label: "Homework", icon: ClipboardList, Comp: HomeworkTab },
  { key: "messages", label: "Messages", icon: MessageCircle, Comp: MessagesTab },
];

export default function SchoolApp() {
  const [tab, setTab] = useState("calendar");
  const Active = TABS.find((t) => t.key === tab).Comp;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "transparent",
        padding: 20,
        fontFamily: FONT_BODY,
      }}
    >
      {/* Phone frame */}
      <div
        style={{
          position: "relative",
          width: 375,
          maxWidth: "100%",
          height: 780,
          maxHeight: "92vh",
          background: COLORS.paper,
          borderRadius: 40,
          border: `10px solid ${COLORS.cover}`,
          boxShadow: "0 20px 50px rgba(0,0,0,0.35)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <TapeStrip label="ELMWOOD" />

        {/* Notch */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: "50%",
            transform: "translateX(-50%)",
            width: 120,
            height: 22,
            background: COLORS.cover,
            borderBottomLeftRadius: 14,
            borderBottomRightRadius: 14,
            zIndex: 5,
          }}
        />

        <div style={{ flex: 1, overflowY: "auto", background: COLORS.paper }}>
          <Active />
        </div>

        {/* Bottom tab bar */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            display: "flex",
            background: "rgba(246,243,236,0.96)",
            backdropFilter: "blur(6px)",
            borderTop: `1px solid ${COLORS.line}`,
            padding: "8px 4px 12px",
          }}
        >
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = t.key === tab;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 3,
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 0",
                }}
              >
                <Icon size={20} color={active ? COLORS.tape : COLORS.graphiteLight} />
                <span
                  style={{
                    fontFamily: FONT_MONO,
                    fontSize: 9.5,
                    color: active ? COLORS.tape : COLORS.graphiteLight,
                  }}
                >
                  {t.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
