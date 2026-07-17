/** Three daily motivational device notifications (Arabic). */

export interface MotivationalTemplate {
  id: number;
  title: string;
  body: string;
  hour: number;
  minute: number;
}

export const MOTIVATIONAL_NOTIFICATIONS: MotivationalTemplate[] = [
  {
    id: 1001,
    title: "السلام عليكم",
    body: "يوم جديد وتاريخ جديد — ابدأ بخطوة صغيرة في ميزان اليوم.",
    hour: 8,
    minute: 0,
  },
  {
    id: 1002,
    title: "مشروع جديد؟",
    body: "وقت مناسب لفتح مشروع أو تسجيل معاملة تقرّبك من هدفك.",
    hour: 11,
    minute: 30,
  },
  {
    id: 1003,
    title: "حافظ على التوازن",
    body: "راجع محافظك وديونك لدقيقة — الوضوح مالٌ مدّخر.",
    hour: 18,
    minute: 0,
  },
];

const morning = MOTIVATIONAL_NOTIFICATIONS[0]!;
const project = MOTIVATIONAL_NOTIFICATIONS[1]!;
const balance = MOTIVATIONAL_NOTIFICATIONS[2]!;

/** Quick signals supervisors can broadcast from the control panel. */
export const SUPERVISOR_SIGNAL_TEMPLATES = [
  {
    key: "morning",
    label: "تحية الصباح",
    title: morning.title,
    body: morning.body,
  },
  {
    key: "project",
    label: "دفعة مشروع",
    title: project.title,
    body: project.body,
  },
  {
    key: "balance",
    label: "تذكير التوازن",
    title: balance.title,
    body: balance.body,
  },
  {
    key: "custom",
    label: "رسالة مخصّصة",
    title: "",
    body: "",
  },
] as const;
