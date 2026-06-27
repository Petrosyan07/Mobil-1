"use client";

import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  FileText,
  Pencil,
  Plus,
  Printer,
  RefreshCw,
  Search,
  Settings,
  Trash2,
  Users
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

type PaymentMethod = "Наличные" | "Перевод" | "Терминал" | "Безнал" | "Не оплачено";
type VisitStatus = "Запланирован" | "В работе" | "Завершён" | "Оплачен";
type AppointmentState = "active" | "accepted" | "cancelled";

type Mechanic = {
  id: string;
  name: string;
  percent: number;
  paid: number;
};

type WorkItem = {
  name: string;
  amount: number;
};

type Visit = {
  id: string;
  date: string;
  time: string;
  client: string;
  phone: string;
  car: string;
  plate: string;
  mileage: string;
  vin: string;
  works: WorkItem[];
  mechanic: string;
  laborAmount: number;
  parts: WorkItem[];
  partsAmount: number;
  paymentMethod: PaymentMethod;
  status: VisitStatus;
  comment: string;
};

type Appointment = {
  id: string;
  date: string;
  time: string;
  client: string;
  phone: string;
  car: string;
  plate: string;
  plannedService: string;
  comment: string;
  state: AppointmentState;
};

type CompanySettings = {
  name: string;
  address: string;
  phone: string;
};

type AppState = {
  visits: Visit[];
  appointments: Appointment[];
  mechanics: Mechanic[];
  services: string[];
  company: CompanySettings;
};

type VisitForm = {
  time: string;
  client: string;
  phone: string;
  car: string;
  plate: string;
  mileage: string;
  vin: string;
  worksText: string;
  mechanic: string;
  laborAmount: string;
  partsText: string;
  partsAmount: string;
  paymentMethod: PaymentMethod;
  status: VisitStatus;
  comment: string;
};

type AppointmentForm = {
  date: string;
  time: string;
  client: string;
  phone: string;
  car: string;
  plate: string;
  plannedService: string;
  comment: string;
};

const paymentMethods: PaymentMethod[] = ["Не оплачено", "Наличные", "Перевод", "Терминал", "Безнал"];
const statuses: VisitStatus[] = ["Запланирован", "В работе", "Завершён", "Оплачен"];
const storageKey = "m1-autoservice-mvp-v2";

const dayMs = 24 * 60 * 60 * 1000;

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function todayDate() {
  return new Date();
}

function todayIsoDate() {
  return isoDate(todayDate());
}

function addDaysFrom(base: Date, days: number) {
  return isoDate(new Date(base.getTime() + days * dayMs));
}

function addDays(days: number) {
  return addDaysFrom(todayDate(), days);
}

function currentTime() {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00`));
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

function sum(list: number[]) {
  return list.reduce((total, item) => total + item, 0);
}

// Русское склонение окончания для слова "визит": 1 визит, 2 визита, 5 визитов.
function plural(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "а";
  return "ов";
}

function visitTotal(visit: Visit) {
  return visit.laborAmount + visit.partsAmount;
}

function isPaid(visit: Visit) {
  return visit.paymentMethod !== "Не оплачено";
}

function nextVisitId(visits: Visit[]) {
  const next = visits.reduce((max, visit) => {
    const number = Number(visit.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 100) + 1;

  return `v-${next}`;
}

function nextAppointmentId(appointments: Appointment[]) {
  const next = appointments.reduce((max, appointment) => {
    const number = Number(appointment.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `a-${next}`;
}

function statusForPayment(paymentMethod: PaymentMethod, current: VisitStatus): VisitStatus {
  if (paymentMethod !== "Не оплачено") return "Оплачен";
  return current === "Оплачен" ? "Завершён" : current;
}

function parseItems(text: string, fallbackAmount: number): WorkItem[] {
  const names = text
    .split(/[,;\n]/)
    .map((item) => item.trim())
    .filter(Boolean);

  if (names.length === 0) {
    return [];
  }

  if (names.length === 1) {
    return [{ name: names[0], amount: fallbackAmount }];
  }

  const evenAmount = Math.round(fallbackAmount / names.length);
  return names.map((name, index) => ({
    name,
    amount: index === names.length - 1 ? fallbackAmount - evenAmount * (names.length - 1) : evenAmount
  }));
}

function createEmptyForm(mechanics?: Mechanic[]): VisitForm {
  return {
    time: currentTime(),
    client: "",
    phone: "",
    car: "",
    plate: "",
    mileage: "",
    vin: "",
    worksText: "",
    mechanic: mechanics?.[0]?.name ?? "",
    laborAmount: "",
    partsText: "",
    partsAmount: "",
    paymentMethod: "Не оплачено",
    status: "В работе",
    comment: ""
  };
}

function createEmptyAppointmentForm(): AppointmentForm {
  return {
    date: addDays(0),
    time: currentTime(),
    client: "",
    phone: "",
    car: "",
    plate: "",
    plannedService: "",
    comment: ""
  };
}

const mockState: AppState = {
  mechanics: [
    { id: "m-1", name: "Аркаша", percent: 50, paid: 1500 },
    { id: "m-2", name: "Коля", percent: 40, paid: 0 },
    { id: "m-3", name: "Сергей", percent: 40, paid: 2000 },
    { id: "m-4", name: "Дима", percent: 40, paid: 0 }
  ],
  services: [
    "Замена масла",
    "Диагностика ходовой",
    "Компьютерная диагностика",
    "Шиномонтаж",
    "Ремонт колеса",
    "Замена тормозных колодок",
    "Замена тормозных дисков",
    "Замена свечей",
    "Заправка кондиционера",
    "Снятие/установка защиты картера"
  ],
  company: {
    name: "М1 / Mobil 1 Центр",
    address: "Красноярск, ул. Забобонова, 13",
    phone: "+7 (391) 000-00-00"
  },
  visits: [
    {
      id: "v-101",
      date: addDays(0),
      time: "09:20",
      client: "Иван Петров",
      phone: "+7 923 111-22-33",
      car: "Toyota Camry",
      plate: "А123ВС124",
      mileage: "148000",
      vin: "JTNB11HK203456789",
      works: [
        { name: "Замена масла", amount: 1800 },
        { name: "Снятие/установка защиты картера", amount: 700 }
      ],
      mechanic: "Аркаша",
      laborAmount: 2500,
      parts: [{ name: "Масло Mobil 1 5W-30", amount: 5200 }],
      partsAmount: 5200,
      paymentMethod: "Терминал",
      status: "Оплачен",
      comment: "Фильтр клиента."
    },
    {
      id: "v-102",
      date: addDays(0),
      time: "10:10",
      client: "",
      phone: "",
      car: "Hyundai Solaris",
      plate: "К774МР124",
      mileage: "92000",
      vin: "",
      works: [{ name: "Диагностика ходовой", amount: 1500 }],
      mechanic: "Коля",
      laborAmount: 1500,
      parts: [],
      partsAmount: 0,
      paymentMethod: "Не оплачено",
      status: "Завершён",
      comment: "Клиент вернётся после согласования."
    },
    {
      id: "v-103",
      date: addDays(0),
      time: "11:30",
      client: "Марина Соколова",
      phone: "+7 913 555-10-20",
      car: "Kia Sportage",
      plate: "Н045ТК124",
      mileage: "67300",
      vin: "XWEPH81BDN0000001",
      works: [{ name: "Замена тормозных колодок", amount: 3200 }],
      mechanic: "Сергей",
      laborAmount: 3200,
      parts: [{ name: "Колодки передние", amount: 4100 }],
      partsAmount: 4100,
      paymentMethod: "Перевод",
      status: "Оплачен",
      comment: ""
    },
    {
      id: "v-095",
      date: addDays(-5),
      time: "12:15",
      client: "Иван Петров",
      phone: "+7 923 111-22-33",
      car: "Toyota Camry",
      plate: "А123ВС124",
      mileage: "146500",
      vin: "JTNB11HK203456789",
      works: [{ name: "Компьютерная диагностика", amount: 1800 }],
      mechanic: "Дима",
      laborAmount: 1800,
      parts: [],
      partsAmount: 0,
      paymentMethod: "Наличные",
      status: "Оплачен",
      comment: ""
    }
  ],
  appointments: [
    {
      id: "a-1",
      date: addDays(0),
      time: "14:30",
      client: "Павел",
      phone: "+7 902 333-44-55",
      car: "Skoda Octavia",
      plate: "О800ОО124",
      plannedService: "Шиномонтаж",
      comment: "Комплект в багажнике",
      state: "active"
    },
    {
      id: "a-2",
      date: addDays(1),
      time: "10:00",
      client: "Анна",
      phone: "+7 913 777-66-55",
      car: "Mazda CX-5",
      plate: "М650АС124",
      plannedService: "Заправка кондиционера",
      comment: "",
      state: "active"
    },
    {
      id: "a-3",
      date: addDays(3),
      time: "16:00",
      client: "Сергей",
      phone: "+7 923 444-00-10",
      car: "Lada Vesta",
      plate: "Р441ЕН124",
      plannedService: "Замена свечей",
      comment: "Свечи свои",
      state: "active"
    }
  ]
};

const nav = [
  { id: "today", label: "Сегодня", href: "/", icon: CalendarDays },
  { id: "appointments", label: "Записи", href: "/appointments", icon: ClipboardList },
  { id: "clients", label: "Клиенты", href: "/clients", icon: Users },
  { id: "orders", label: "Заказ-наряды", href: "/orders", icon: FileText },
  { id: "summary", label: "Итог дня", href: "/summary", icon: CheckCircle2 },
  { id: "stats", label: "Статистика", href: "/stats", icon: CreditCard },
  { id: "settings", label: "Настройки", href: "/settings", icon: Settings }
] as const;

type SectionId = (typeof nav)[number]["id"];

export default function M1Journal({ section = "today", initialOrderId }: { section?: SectionId; initialOrderId?: string }) {
  const router = useRouter();
  const [state, setState] = useState<AppState>(() => {
    if (typeof window === "undefined") return mockState;
    const saved = window.localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved) as AppState;
      } catch {
        window.localStorage.removeItem(storageKey);
      }
    }
    return mockState;
  });
  const [formOpen, setFormOpen] = useState(false);
  const [detailVisit, setDetailVisit] = useState<Visit | null>(null);
  const [paymentVisit, setPaymentVisit] = useState<Visit | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Наличные");
  const [selectedOrderId, setSelectedOrderId] = useState(() => initialOrderId ?? state.visits[0]?.id ?? "");
  const [clientSearch, setClientSearch] = useState("");
  const [form, setForm] = useState<VisitForm>(() => createEmptyForm(state.mechanics));
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  const todayIso = todayIsoDate();
  const todayVisits = useMemo(() => state.visits.filter((visit) => visit.date === todayIso), [state.visits, todayIso]);
  const selectedOrder = state.visits.find((visit) => visit.id === selectedOrderId) ?? todayVisits[0] ?? state.visits[0];

  const dayTotals = useMemo(() => buildDayTotals(todayVisits, state.mechanics), [todayVisits, state.mechanics]);
  const clientCards = useMemo(() => buildClients(state.visits, state.appointments, todayIso), [state.visits, state.appointments, todayIso]);
  const filteredClients = clientCards.filter((client) => {
    const query = clientSearch.trim().toLowerCase();
    if (!query) return true;
    return `${client.name} ${client.phone} ${client.cars.join(" ")}`.toLowerCase().includes(query);
  });

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function updateVisit(id: string, patch: Partial<Visit>) {
    setState((current) => ({
      ...current,
      visits: current.visits.map((visit) => (visit.id === id ? { ...visit, ...patch } : visit))
    }));
  }

  function markPaid(visit: Visit) {
    setPaymentVisit(visit);
    setPaymentMethod(visit.paymentMethod === "Не оплачено" ? "Наличные" : visit.paymentMethod);
  }

  function confirmPayment() {
    if (!paymentVisit) return;
    updateVisit(paymentVisit.id, {
      paymentMethod,
      status: statusForPayment(paymentMethod, paymentVisit.status)
    });
    showNotice(paymentMethod === "Не оплачено" ? `Оплата снята: ${paymentVisit.car}` : `Оплата отмечена: ${paymentVisit.car}`);
    setPaymentVisit(null);
  }

  function startEditVisit(visit: Visit) {
    setEditingVisit(visit);
    setForm({
      time: visit.time,
      client: visit.client,
      phone: visit.phone,
      car: visit.car,
      plate: visit.plate,
      mileage: visit.mileage,
      vin: visit.vin,
      worksText: visit.works.map((w) => w.name).join(", "),
      mechanic: visit.mechanic,
      laborAmount: String(visit.laborAmount),
      partsText: visit.parts.map((p) => p.name).join(", "),
      partsAmount: String(visit.partsAmount),
      paymentMethod: visit.paymentMethod,
      status: visit.status,
      comment: visit.comment
    });
    setFormOpen(true);
  }

  function saveVisit() {
    if (!form.car.trim() || !form.worksText.trim() || !form.mechanic.trim() || Number(form.laborAmount) <= 0) {
      setFormError("Заполните автомобиль, работу, механика и сумму работ.");
      return;
    }

    const laborAmount = Number(form.laborAmount) || 0;
    const partsAmount = Number(form.partsAmount) || 0;
    const visitData = {
      time: form.time || currentTime(),
      client: form.client.trim(),
      phone: form.phone.trim(),
      car: form.car.trim(),
      plate: form.plate.trim().toUpperCase(),
      mileage: form.mileage.trim(),
      vin: form.vin.trim().toUpperCase(),
      works: parseItems(form.worksText, laborAmount),
      mechanic: form.mechanic,
      laborAmount,
      parts: parseItems(form.partsText, partsAmount),
      partsAmount,
      paymentMethod: form.paymentMethod,
      status: statusForPayment(form.paymentMethod, form.status),
      comment: form.comment.trim()
    };

    if (editingVisit) {
      updateVisit(editingVisit.id, visitData);
      showNotice(`Заезд обновлён: ${visitData.car}`);
    } else {
      const visit: Visit = {
        id: nextVisitId(state.visits),
        date: todayIso,
        ...visitData
      };
      setState((current) => ({
        ...current,
        visits: [visit, ...current.visits],
        // если заезд создан из записи — помечаем запись принятой
        appointments: acceptingId
          ? current.appointments.map((item) => item.id === acceptingId ? { ...item, state: "accepted" } : item)
          : current.appointments
      }));
      setSelectedOrderId(visit.id);
      if (acceptingId) {
        showNotice(`Запись принята в работу: ${visit.car}`);
        router.push("/");
      } else {
        showNotice(`Заезд добавлен: ${visit.car}`);
      }
    }

    setEditingVisit(null);
    setAcceptingId(null);
    setForm(createEmptyForm(state.mechanics));
    setFormError("");
    setFormOpen(false);
  }

  function deleteVisit(id: string) {
    const visit = state.visits.find((v) => v.id === id);
    setState((current) => ({
      ...current,
      visits: current.visits.filter((v) => v.id !== id)
    }));
    setDeleteConfirm(null);
    if (visit) showNotice(`Заезд удалён: ${visit.car}`);
  }

  function changeVisitStatus(id: string, status: VisitStatus) {
    updateVisit(id, { status });
  }

  function addAppointment(form: AppointmentForm) {
    const appointment: Appointment = {
      id: nextAppointmentId(state.appointments),
      date: form.date,
      time: form.time || currentTime(),
      client: form.client.trim(),
      phone: form.phone.trim(),
      car: form.car.trim(),
      plate: form.plate.trim().toUpperCase(),
      plannedService: form.plannedService.trim(),
      comment: form.comment.trim(),
      state: "active"
    };

    setState((current) => ({
      ...current,
      appointments: [...current.appointments, appointment]
    }));
    showNotice(`Запись добавлена: ${appointment.car}`);
  }

  // Принять запись = открыть форму заезда, заранее заполненную данными из записи.
  // Сумму работ и мастера вносит приёмщик. Запись помечается «принята» после сохранения.
  function acceptAppointment(appointment: Appointment) {
    setEditingVisit(null);
    setAcceptingId(appointment.id);
    setForm({
      time: appointment.time || currentTime(),
      client: appointment.client,
      phone: appointment.phone,
      car: appointment.car,
      plate: appointment.plate,
      mileage: "",
      vin: "",
      worksText: appointment.plannedService,
      mechanic: state.mechanics[0]?.name ?? "",
      laborAmount: "",
      partsText: "",
      partsAmount: "",
      paymentMethod: "Не оплачено",
      status: "В работе",
      comment: appointment.comment
    });
    setFormError("");
    setFormOpen(true);
  }

  function moveAppointment(appointment: Appointment) {
    const nextDay = addDaysFrom(new Date(`${appointment.date}T12:00:00`), 1);
    setState((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === appointment.id ? { ...item, date: nextDay } : item
      )
    }));
    showNotice(`Запись перенесена на ${formatDate(nextDay)}`);
  }

  function cancelAppointment(appointment: Appointment) {
    setState((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === appointment.id ? { ...item, state: "cancelled" } : item
      )
    }));
    showNotice("Запись отменена");
  }

  function restoreAppointment(appointment: Appointment) {
    setState((current) => ({
      ...current,
      appointments: current.appointments.map((item) =>
        item.id === appointment.id ? { ...item, state: "active" } : item
      )
    }));
    showNotice("Запись возвращена в активные");
  }

  function deleteAppointment(id: string) {
    setState((current) => ({
      ...current,
      appointments: current.appointments.filter((item) => item.id !== id)
    }));
    showNotice("Запись удалена");
  }

  function saveAppointment(formData: AppointmentForm) {
    if (editingAppointment) {
      setState((current) => ({
        ...current,
        appointments: current.appointments.map((item) =>
          item.id === editingAppointment.id
            ? {
                ...item,
                date: formData.date,
                time: formData.time || currentTime(),
                client: formData.client.trim(),
                phone: formData.phone.trim(),
                car: formData.car.trim(),
                plate: formData.plate.trim().toUpperCase(),
                plannedService: formData.plannedService.trim(),
                comment: formData.comment.trim()
              }
            : item
        )
      }));
      setEditingAppointment(null);
      showNotice(`Запись обновлена: ${formData.car}`);
    } else {
      addAppointment(formData);
    }
  }

  function resetDemo() {
    window.localStorage.removeItem(storageKey);
    setState(mockState);
    setSelectedOrderId(mockState.visits[0].id);
    showNotice("Демо-данные восстановлены");
  }

  return (
    <main className="flex min-h-screen bg-[hsl(var(--background))]">
      <aside className="no-print fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col border-r border-slate-800 bg-[hsl(var(--sidebar))]">
        <div className="flex h-16 items-center gap-3 border-b border-slate-800 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">M1</div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">Mobil 1 Центр</p>
            <p className="truncate text-xs text-slate-400">Журнал</p>
          </div>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-all ${
                  active
                    ? "bg-blue-600 text-white shadow-lg shadow-blue-600/25"
                    : "text-slate-400 hover:bg-[hsl(var(--sidebar-hover))] hover:text-white"
                }`}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-800 p-3">
          <Button variant="secondary" size="sm" onClick={resetDemo} className="w-full justify-center gap-2 border-slate-700 bg-transparent text-slate-400 hover:bg-slate-800 hover:text-white">
            <RefreshCw className="h-3.5 w-3.5" />
            Сбросить демо
          </Button>
        </div>
      </aside>

      <div className="flex-1 pl-[220px]">
        <header className="no-print sticky top-0 z-40 border-b border-border bg-white/80 backdrop-blur-xl">
          <div className="flex h-16 items-center justify-between px-8">
            <div>
              <h1 className="text-lg font-semibold text-foreground">{nav.find((item) => item.id === section)?.label ?? "Сегодня"}</h1>
              <p className="text-xs text-muted-foreground">{formatDate(todayIso)}</p>
            </div>
            <div className="flex items-center gap-3">
              <Button className="gap-2 rounded-lg bg-blue-600 shadow-md shadow-blue-600/25 hover:bg-blue-700" onClick={() => {
                setEditingVisit(null);
                setAcceptingId(null);
                setForm(createEmptyForm(state.mechanics));
                setFormOpen(true);
              }}>
                <Plus className="h-4 w-4" />
                Новый заезд
              </Button>
              <Dialog open={formOpen} onOpenChange={(open) => {
                if (!open) {
                  setFormOpen(false);
                  setEditingVisit(null);
                  setAcceptingId(null);
                  setFormError("");
                }
              }}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingVisit ? "Редактировать заезд" : acceptingId ? "Приём записи в работу" : "Новый заезд"}</DialogTitle>
                  </DialogHeader>
                  <VisitFormView
                    form={form}
                    error={formError}
                    mechanics={state.mechanics}
                    services={state.services}
                    onChange={(nextForm) => {
                      setForm(nextForm);
                      if (formError) setFormError("");
                    }}
                    onSubmit={saveVisit}
                  />
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </header>

        {notice && (
          <div className="no-print fixed right-6 top-20 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg shadow-green-100">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {notice}
          </div>
        )}

        <div className="no-print px-8 py-6">
          <section className="min-w-0">
          {section === "today" && (
            <TodaySection
              date={todayIso}
              visits={todayVisits}
              totals={dayTotals}
              onOpen={setDetailVisit}
              onOrder={(visit) => {
                setSelectedOrderId(visit.id);
                router.push(`/orders?order=${encodeURIComponent(visit.id)}`);
              }}
              onPaid={markPaid}
              onEdit={startEditVisit}
              onDelete={(id) => setDeleteConfirm(id)}
              onStatusChange={changeVisitStatus}
              deleteConfirm={deleteConfirm}
              onDeleteConfirm={deleteVisit}
              onDeleteCancel={() => setDeleteConfirm(null)}
            />
          )}

          {section === "appointments" && (
            <AppointmentsSection
              appointments={state.appointments}
              services={state.services}
              todayIso={todayIso}
              editingAppointment={editingAppointment}
              onSave={saveAppointment}
              onAccept={acceptAppointment}
              onMove={moveAppointment}
              onCancel={cancelAppointment}
              onRestore={restoreAppointment}
              onEdit={setEditingAppointment}
              onEditCancel={() => setEditingAppointment(null)}
              onDelete={deleteAppointment}
            />
          )}

          {section === "clients" && (
            <ClientsSection
              clients={filteredClients}
              query={clientSearch}
              onQuery={setClientSearch}
            />
          )}

          {section === "orders" && (
            <OrdersSection
              visits={state.visits}
              selected={selectedOrder}
              company={state.company}
              onSelect={(id) => {
                setSelectedOrderId(id);
                router.replace(`/orders?order=${encodeURIComponent(id)}`);
              }}
            />
          )}

          {section === "summary" && (
            <DaySummarySection visits={state.visits} mechanics={state.mechanics} todayIso={todayIso} />
          )}

          {section === "stats" && <StatsSection visits={state.visits} mechanics={state.mechanics} />}

          {section === "settings" && (
            <SettingsSection state={state} setState={setState} />
          )}
        </section>
        </div>
      </div>

      <Dialog open={Boolean(detailVisit)} onOpenChange={(open) => !open && setDetailVisit(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{detailVisit?.car} {detailVisit?.plate}</DialogTitle>
          </DialogHeader>
          {detailVisit && <VisitDetails visit={detailVisit} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(paymentVisit)} onOpenChange={(open) => !open && setPaymentVisit(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Оплата заезда</DialogTitle>
          </DialogHeader>
          {paymentVisit && (
            <div className="space-y-4">
              <div className="rounded-md border border-border bg-slate-50 p-4">
                <p className="font-semibold">{paymentVisit.car} {paymentVisit.plate}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {paymentVisit.works.map((work) => work.name).join(", ")}
                </p>
                <p className="mt-3 text-xl font-semibold">{formatMoney(visitTotal(paymentVisit))}</p>
              </div>
              <Field label="Способ оплаты">
                <NativeSelect value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                  {paymentMethods.map((method) => (
                    <option key={method} value={method}>{method}</option>
                  ))}
                </NativeSelect>
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setPaymentVisit(null)}>Отмена</Button>
                <Button onClick={confirmPayment}>Сохранить оплату</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {selectedOrder && (
        <div className="print-only">
          <OrderPrintSheet visit={selectedOrder} company={state.company} />
        </div>
      )}
    </main>
  );
}

function mechanicPercent(mechanics: Mechanic[], name: string) {
  return mechanics.find((mechanic) => mechanic.name === name)?.percent ?? 0;
}

function buildDayTotals(visits: Visit[], mechanics: Mechanic[]) {
  const total = sum(visits.map(visitTotal));
  const paidVisits = visits.filter(isPaid);
  const paid = sum(paidVisits.map(visitTotal));
  const unpaid = total - paid;
  const parts = sum(visits.map((visit) => visit.partsAmount));
  const byPayment = Object.fromEntries(paymentMethods.map((method) => [method, 0])) as Record<PaymentMethod, number>;

  visits.forEach((visit) => {
    byPayment[isPaid(visit) ? visit.paymentMethod : "Не оплачено"] += visitTotal(visit);
  });

  // «Чистыми» считаем только по фактически полученным деньгам (оплаченные заезды):
  // оплачено − стоимость запчастей по оплаченным − зарплата мастеров с оплаченных работ.
  const paidParts = sum(paidVisits.map((visit) => visit.partsAmount));
  const paidMechanicAccrued = sum(paidVisits.map((visit) =>
    Math.round((visit.laborAmount * mechanicPercent(mechanics, visit.mechanic)) / 100)
  ));

  // Сводка по мастерам — только за этот день (начислено за день).
  const mechanicRows = mechanics.map((mechanic) => {
    const mechanicVisits = visits.filter((visit) => visit.mechanic === mechanic.name);
    const labor = sum(mechanicVisits.map((visit) => visit.laborAmount));
    const works = mechanicVisits.length;
    const accrued = Math.round((labor * mechanic.percent) / 100);
    return {
      mechanic: mechanic.name,
      works,
      labor,
      percent: mechanic.percent,
      accrued
    };
  }).filter((row) => row.works > 0);
  const mechanicAccrued = sum(mechanicRows.map((row) => row.accrued));

  return {
    visits: visits.length,
    total,
    paid,
    unpaid,
    parts,
    byPayment,
    mechanicAccrued,
    clean: paid - paidParts - paidMechanicAccrued,
    mechanicRows
  };
}

// Расчёт с мастерами за всё время: начислено по всем заездам минус уже выданное.
function buildMechanicSettlement(visits: Visit[], mechanics: Mechanic[]) {
  return mechanics.map((mechanic) => {
    const mechanicVisits = visits.filter((visit) => visit.mechanic === mechanic.name);
    const labor = sum(mechanicVisits.map((visit) => visit.laborAmount));
    const accrued = Math.round((labor * mechanic.percent) / 100);
    return {
      id: mechanic.id,
      mechanic: mechanic.name,
      works: mechanicVisits.length,
      labor,
      percent: mechanic.percent,
      accrued,
      paid: mechanic.paid,
      balance: accrued - mechanic.paid
    };
  });
}

// Нормализуем телефон до цифр, чтобы "+7 923 111-22-33" и "89231112233" были одним клиентом.
function normalizePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  // приводим 8XXX и 7XXX к единому виду
  if (digits.length === 11 && (digits[0] === "8" || digits[0] === "7")) return `7${digits.slice(1)}`;
  return digits;
}

type ClientCard = {
  name: string;
  phone: string;
  cars: string[];
  visits: Visit[];
  upcoming: Appointment[];
  total: number;
  paid: number;
  lastVisit: string;
};

function buildClients(visits: Visit[], appointments: Appointment[], todayIso: string): ClientCard[] {
  const map = new Map<string, ClientCard>();

  // Ключ клиента: нормализованный телефон, иначе — имя в нижнем регистре, иначе госномер.
  const clientKey = (name: string, phone: string, plate: string) => {
    const normalized = normalizePhone(phone);
    if (normalized) return `tel:${normalized}`;
    if (name.trim()) return `name:${name.trim().toLowerCase()}`;
    return `car:${plate || "—"}`;
  };

  const ensure = (name: string, phone: string, plate: string): ClientCard => {
    const key = clientKey(name, phone, plate);
    const existing = map.get(key);
    if (existing) {
      // дополняем недостающие имя/телефон, если в одном из заездов они были пустыми
      if (!existing.name && name) existing.name = name;
      if (!existing.phone && phone) existing.phone = phone;
      return existing;
    }
    const card: ClientCard = { name, phone, cars: [], visits: [], upcoming: [], total: 0, paid: 0, lastVisit: "" };
    map.set(key, card);
    return card;
  };

  visits.forEach((visit) => {
    const name = visit.client || "Клиент без имени";
    const card = ensure(name, visit.phone, visit.plate);
    const carTitle = `${visit.car}${visit.plate ? `, ${visit.plate}` : ""}`;
    if (carTitle.trim() && !card.cars.includes(carTitle)) card.cars.push(carTitle);
    card.visits.push(visit);
    card.total += visitTotal(visit);
    if (isPaid(visit)) card.paid += visitTotal(visit);
    if (visit.date > card.lastVisit) card.lastVisit = visit.date;
  });

  // Привязываем предстоящие активные записи к существующим клиентам (без создания новых карточек).
  appointments
    .filter((appointment) => appointment.state === "active" && appointment.date >= todayIso)
    .forEach((appointment) => {
      const key = clientKey(appointment.client || "", appointment.phone, appointment.plate);
      const card = map.get(key);
      if (card) card.upcoming.push(appointment);
    });

  return Array.from(map.values()).sort((a, b) => b.lastVisit.localeCompare(a.lastVisit));
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card className="border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-2 text-xl font-semibold tracking-tight text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/60 bg-white/50 p-8 text-center sm:col-span-2 xl:col-span-full">
      <p className="font-semibold">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function TodaySection({
  date,
  visits,
  totals,
  onOpen,
  onOrder,
  onPaid,
  onEdit,
  onDelete,
  onStatusChange,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel
}: {
  date: string;
  visits: Visit[];
  totals: ReturnType<typeof buildDayTotals>;
  onOpen: (visit: Visit) => void;
  onOrder: (visit: Visit) => void;
  onPaid: (visit: Visit) => void;
  onEdit: (visit: Visit) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: VisitStatus) => void;
  deleteConfirm: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}) {
  const sortedVisits = [...visits].sort((a, b) => (a.time || "99:99").localeCompare(b.time || "99:99"));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard label="Заезды" value={totals.visits} />
        <StatCard label="Выручка" value={formatMoney(totals.total)} />
        <StatCard label="Не оплачено" value={formatMoney(totals.unpaid)} />
        <StatCard label="Чистыми" value={formatMoney(totals.clean)} />
      </div>
      {totals.visits > 0 && (
        <div className="flex flex-wrap gap-4 rounded-lg border border-border/40 bg-white/60 px-4 py-2.5 text-xs text-muted-foreground">
          <span>Наличные: <b className="text-foreground">{formatMoney(totals.byPayment["Наличные"])}</b></span>
          <span>Перевод: <b className="text-foreground">{formatMoney(totals.byPayment["Перевод"])}</b></span>
          <span>Терминал: <b className="text-foreground">{formatMoney(totals.byPayment["Терминал"])}</b></span>
          <span>Безнал: <b className="text-foreground">{formatMoney(totals.byPayment["Безнал"])}</b></span>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm lg:overflow-x-auto">
        {sortedVisits.length ? sortedVisits.map((visit, index) => (
          <VisitRow
            key={visit.id}
            index={index}
            visit={visit}
            onOpen={onOpen}
            onOrder={onOrder}
            onPaid={onPaid}
            onEdit={onEdit}
            onDelete={onDelete}
            onStatusChange={onStatusChange}
            deleteConfirm={deleteConfirm}
            onDeleteConfirm={onDeleteConfirm}
            onDeleteCancel={onDeleteCancel}
          />
        )) : (
          <EmptyState title="Заездов сегодня пока нет" text="Добавьте первый заезд через кнопку в верхней панели." />
        )}
      </div>
    </div>
  );
}

function VisitRow({
  index,
  visit,
  onOpen,
  onOrder,
  onPaid,
  onEdit,
  onDelete,
  onStatusChange,
  deleteConfirm,
  onDeleteConfirm,
  onDeleteCancel
}: {
  index: number;
  visit: Visit;
  onOpen: (visit: Visit) => void;
  onOrder: (visit: Visit) => void;
  onPaid: (visit: Visit) => void;
  onEdit: (visit: Visit) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: VisitStatus) => void;
  deleteConfirm: string | null;
  onDeleteConfirm: (id: string) => void;
  onDeleteCancel: () => void;
}) {
  const isDeleting = deleteConfirm === visit.id;

  return (
    <>
      {index === 0 && (
        <div className="hidden min-w-[960px] grid-cols-[36px_56px_1fr_1fr_1.2fr_80px_84px_84px_84px_88px_120px_200px] gap-3 border-b border-border/60 bg-slate-50/80 px-4 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid">
          <span>№</span>
          <span>Время</span>
          <span>Авто / госномер</span>
          <span>Клиент / телефон</span>
          <span>Работы</span>
          <span>Мастер</span>
          <span className="text-right">Работа ₽</span>
          <span className="text-right">Запчасти ₽</span>
          <span className="text-right">Итого</span>
          <span>Оплата</span>
          <span>Статус</span>
          <span className="text-right">Действия</span>
        </div>
      )}
      <div className={`hidden min-w-[960px] grid-cols-[36px_56px_1fr_1fr_1.2fr_80px_84px_84px_84px_88px_120px_200px] gap-3 border-b border-border/40 px-4 py-3.5 text-sm transition-colors last:border-b-0 hover:bg-slate-50/50 lg:grid lg:items-center ${isDeleting ? "bg-red-50/50" : ""}`}>
        <span className="text-muted-foreground">{index + 1}</span>
        <span className="font-medium">{visit.time || "—"}</span>
        <div className="min-w-0">
          <p className="truncate font-medium">{visit.car}</p>
          <p className="text-xs text-muted-foreground">{visit.plate || "Без номера"}</p>
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium">{visit.client || "Клиент не указан"}</p>
          <p className="truncate text-xs text-muted-foreground">{visit.phone || "Телефон не указан"}</p>
        </div>
        <p className="min-w-0 truncate">{visit.works.map((work) => work.name).join(", ") || "Работы не указаны"}</p>
        <span>{visit.mechanic}</span>
        <span className="text-right font-medium">{formatMoney(visit.laborAmount)}</span>
        <span className="text-right">{formatMoney(visit.partsAmount)}</span>
        <span className="text-right font-semibold">{formatMoney(visitTotal(visit))}</span>
        <span>{visit.paymentMethod}</span>
        <NativeSelect
          value={visit.status}
          onChange={(e) => onStatusChange(visit.id, e.target.value as VisitStatus)}
          className="!h-8 !rounded !px-2 !py-1 !text-xs"
        >
          {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </NativeSelect>
        <div className="flex flex-wrap justify-end gap-1">
          {isDeleting ? (
            <>
              <Button variant="secondary" size="sm" className="h-7 text-xs" onClick={onDeleteCancel}>Нет</Button>
              <Button size="sm" className="h-7 bg-red-600 text-xs hover:bg-red-700" onClick={() => onDeleteConfirm(visit.id)}>Да, удалить</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(visit)} title="Редактировать">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="secondary" size="sm" className="h-7 w-7 p-0" onClick={() => onOrder(visit)} title="Заказ-наряд">
                <FileText className="h-3.5 w-3.5" />
              </Button>
              <Button size="sm" className="h-7 px-2 text-xs" onClick={() => onPaid(visit)}>
                {isPaid(visit) ? "Оплата" : "Оплатить"}
              </Button>
              <Button variant="secondary" size="sm" className="h-7 w-7 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => onDelete(visit.id)} title="Удалить">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className="space-y-3 border-b border-border p-3 last:border-b-0 lg:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-semibold">{visit.time || "—"}</span>
              <p className="font-semibold">{visit.car}</p>
              {visit.plate && <Badge>{visit.plate}</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {visit.client || "Клиент не указан"}{visit.phone ? `, ${visit.phone}` : ""}
            </p>
          </div>
          <Badge className={statusClass(visit.status)}>{visit.status}</Badge>
        </div>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Info label="Работы" value={visit.works.map((work) => work.name).join(", ") || "Не указаны"} />
          <Info label="Мастер" value={visit.mechanic} />
          <Info label="Работа" value={formatMoney(visit.laborAmount)} />
          <Info label="Запчасти" value={formatMoney(visit.partsAmount)} />
          <Info label="Итого" value={formatMoney(visitTotal(visit))} />
          <Info label="Оплата" value={visit.paymentMethod} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => onEdit(visit)}>Редактировать</Button>
          <Button variant="secondary" size="sm" onClick={() => onOrder(visit)}>Заказ-наряд</Button>
          <Button size="sm" onClick={() => onPaid(visit)}>
            {isPaid(visit) ? "Изменить оплату" : "Оплатить"}
          </Button>
          <Button variant="secondary" size="sm" className="text-red-500" onClick={() => onDelete(visit.id)}>Удалить</Button>
        </div>
      </div>
    </>
  );
}

function statusClass(status: VisitStatus) {
  if (status === "Оплачен") return "border-emerald-200 bg-emerald-50 text-emerald-700 font-medium";
  if (status === "Завершён") return "border-blue-200 bg-blue-50 text-blue-700 font-medium";
  if (status === "В работе") return "border-amber-200 bg-amber-50 text-amber-700 font-medium";
  return "border-slate-200 bg-slate-50 text-slate-600 font-medium";
}

function VisitFormView({
  form,
  error,
  mechanics,
  services,
  onChange,
  onSubmit
}: {
  form: VisitForm;
  error: string;
  mechanics: Mechanic[];
  services: string[];
  onChange: (form: VisitForm) => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof VisitForm>(key: K, value: VisitForm[K]) => onChange({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <h3 className="font-semibold">Основное</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Время">
            <Input type="time" value={form.time} onChange={(event) => set("time", event.target.value)} />
          </Field>
        <Field label="Автомобиль *"><Input value={form.car} onChange={(event) => set("car", event.target.value)} /></Field>
        <Field label="Госномер"><Input value={form.plate} onChange={(event) => set("plate", event.target.value)} /></Field>
          <Field label="Работы *">
            <Input
              list="services"
              value={form.worksText}
              onChange={(event) => set("worksText", event.target.value)}
            />
            <datalist id="services">
              {services.map((service) => <option key={service} value={service} />)}
            </datalist>
          </Field>
        <Field label="Механик">
          <NativeSelect value={form.mechanic} onChange={(event) => set("mechanic", event.target.value)}>
            {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.name}>{mechanic.name}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Сумма работ *"><Input type="number" value={form.laborAmount} onChange={(event) => set("laborAmount", event.target.value)} /></Field>
        <Field label="Способ оплаты">
          <NativeSelect value={form.paymentMethod} onChange={(event) => set("paymentMethod", event.target.value as PaymentMethod)}>
            {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Статус">
          <NativeSelect value={form.status} onChange={(event) => set("status", event.target.value as VisitStatus)}>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </NativeSelect>
        </Field>
        </div>
      </div>
      <div className="rounded-lg border border-border p-4">
        <h3 className="font-semibold">Дополнительно</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Клиент"><Input value={form.client} onChange={(event) => set("client", event.target.value)} /></Field>
          <Field label="Телефон"><Input value={form.phone} onChange={(event) => set("phone", event.target.value)} /></Field>
          <Field label="Пробег"><Input value={form.mileage} onChange={(event) => set("mileage", event.target.value)} /></Field>
          <Field label="VIN"><Input value={form.vin} onChange={(event) => set("vin", event.target.value)} /></Field>
          <Field label="Запчасти/материалы"><Input value={form.partsText} onChange={(event) => set("partsText", event.target.value)} /></Field>
          <Field label="Сумма запчастей"><Input type="number" value={form.partsAmount} onChange={(event) => set("partsAmount", event.target.value)} /></Field>
        </div>
        <div className="mt-4">
          <Field label="Комментарий"><Textarea value={form.comment} onChange={(event) => set("comment", event.target.value)} /></Field>
        </div>
      </div>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button onClick={onSubmit}>Сохранить заезд</Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function NativeSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none transition-all focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
    />
  );
}

function VisitDetails({ visit }: { visit: Visit }) {
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-2">
      <Info label="Клиент" value={visit.client || "Не указан"} />
      <Info label="Телефон" value={visit.phone || "Не указан"} />
      <Info label="Время" value={visit.time || "—"} />
      <Info label="Автомобиль" value={visit.car} />
      <Info label="Госномер" value={visit.plate || "Не указан"} />
      <Info label="VIN" value={visit.vin || "Не указан"} />
      <Info label="Пробег" value={visit.mileage || "Не указан"} />
      <Info label="Работы" value={visit.works.map((work) => `${work.name}: ${formatMoney(work.amount)}`).join(", ")} />
      <Info label="Запчасти" value={visit.parts.length ? visit.parts.map((part) => `${part.name}: ${formatMoney(part.amount)}`).join(", ") : "Нет"} />
      <Info label="Механик" value={visit.mechanic} />
      <Info label="Итого" value={formatMoney(visitTotal(visit))} />
      <Info label="Оплата" value={visit.paymentMethod} />
      <Info label="Статус" value={visit.status} />
      <div className="sm:col-span-2"><Info label="Комментарий" value={visit.comment || "Нет"} /></div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function AppointmentsSection({
  appointments,
  services,
  todayIso,
  editingAppointment,
  onSave,
  onAccept,
  onMove,
  onCancel,
  onRestore,
  onEdit,
  onEditCancel,
  onDelete
}: {
  appointments: Appointment[];
  services: string[];
  todayIso: string;
  editingAppointment: Appointment | null;
  onSave: (form: AppointmentForm) => void;
  onAccept: (appointment: Appointment) => void;
  onMove: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onRestore: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onEditCancel: () => void;
  onDelete: (id: string) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [form, setForm] = useState<AppointmentForm>(() => createEmptyAppointmentForm());
  const [error, setError] = useState("");
  const [tab, setTab] = useState("upcoming");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Открываем форму при запросе на редактирование извне.
  useEffect(() => {
    if (editingAppointment) {
      setForm({
        date: editingAppointment.date,
        time: editingAppointment.time,
        client: editingAppointment.client,
        phone: editingAppointment.phone,
        car: editingAppointment.car,
        plate: editingAppointment.plate,
        plannedService: editingAppointment.plannedService,
        comment: editingAppointment.comment
      });
      setError("");
      setFormOpen(true);
    }
  }, [editingAppointment]);

  const active = appointments.filter((item) => item.state === "active");
  const overdue = active.filter((item) => item.date < todayIso);
  const tomorrowIso = addDaysFrom(new Date(`${todayIso}T12:00:00`), 1);

  const groups = {
    upcoming: active.filter((item) => item.date >= todayIso),
    today: active.filter((item) => item.date === todayIso),
    tomorrow: active.filter((item) => item.date === tomorrowIso),
    archive: appointments.filter((item) => item.state !== "active")
  };

  const tabs = [
    { id: "upcoming", label: "Предстоящие", count: groups.upcoming.length },
    { id: "today", label: "Сегодня", count: groups.today.length },
    { id: "tomorrow", label: "Завтра", count: groups.tomorrow.length },
    { id: "archive", label: "Архив", count: groups.archive.length }
  ];

  const sortByDate = (list: Appointment[]) =>
    [...list].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));

  const visible = sortByDate(groups[tab as keyof typeof groups]);

  function closeForm() {
    setFormOpen(false);
    setError("");
    onEditCancel();
    setForm(createEmptyAppointmentForm());
  }

  function submitAppointment() {
    if (!form.date || !form.time || !form.car.trim() || !form.plannedService.trim()) {
      setError("Заполните дату, время, автомобиль и услугу.");
      return;
    }

    onSave(form);
    setForm(createEmptyAppointmentForm());
    setError("");
    setFormOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Записи</h2>
        <div className="flex flex-wrap gap-2">
          <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
            <DialogTrigger asChild>
              <Button variant="secondary">
                <CalendarDays className="h-4 w-4" />
                Календарь
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl">
              <DialogHeader>
                <DialogTitle>Календарь записей</DialogTitle>
              </DialogHeader>
              <AppointmentCalendar appointments={active} todayIso={todayIso} />
            </DialogContent>
          </Dialog>
          <Button onClick={() => {
            onEditCancel();
            setForm(createEmptyAppointmentForm());
            setError("");
            setFormOpen(true);
          }}>
            <Plus className="h-4 w-4" />
            Добавить запись
          </Button>
          <Dialog open={formOpen} onOpenChange={(open) => { if (!open) closeForm(); }}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingAppointment ? "Редактировать запись" : "Новая запись"}</DialogTitle>
              </DialogHeader>
              <AppointmentFormView
                form={form}
                error={error}
                services={services}
                onChange={(nextForm) => {
                  setForm(nextForm);
                  if (error) setError("");
                }}
                onSubmit={submitAppointment}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {overdue.length > 0 && (
        <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm font-semibold text-amber-800">⚠️ Просроченные записи ({overdue.length}) — клиент не приехал в назначенный день</p>
          {sortByDate(overdue).map((appointment) => (
            <AppointmentRow
              key={appointment.id}
              appointment={appointment}
              overdue
              deleteConfirm={deleteConfirm}
              onAccept={onAccept}
              onMove={onMove}
              onCancel={onCancel}
              onRestore={onRestore}
              onEdit={onEdit}
              onDelete={onDelete}
              onDeleteRequest={setDeleteConfirm}
            />
          ))}
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          {tabs.map((item) => (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
              {item.count > 0 && (
                <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs font-semibold text-slate-600">{item.count}</span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value={tab}>
          <div className="space-y-3">
            {visible.length ? visible.map((appointment) => (
              <AppointmentRow
                key={appointment.id}
                appointment={appointment}
                deleteConfirm={deleteConfirm}
                onAccept={onAccept}
                onMove={onMove}
                onCancel={onCancel}
                onRestore={onRestore}
                onEdit={onEdit}
                onDelete={onDelete}
                onDeleteRequest={setDeleteConfirm}
              />
            )) : (
              <EmptyState title="Записей нет" text="На выбранный период предварительных записей не найдено." />
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AppointmentFormView({
  form,
  error,
  services,
  onChange,
  onSubmit
}: {
  form: AppointmentForm;
  error: string;
  services: string[];
  onChange: (form: AppointmentForm) => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof AppointmentForm>(key: K, value: AppointmentForm[K]) => onChange({ ...form, [key]: value });

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Дата">
          <Input type="date" value={form.date} onChange={(event) => set("date", event.target.value)} />
        </Field>
        <Field label="Время">
          <Input type="time" value={form.time} onChange={(event) => set("time", event.target.value)} />
        </Field>
        <Field label="Клиент">
          <Input value={form.client} onChange={(event) => set("client", event.target.value)} />
        </Field>
        <Field label="Телефон">
          <Input value={form.phone} onChange={(event) => set("phone", event.target.value)} />
        </Field>
        <Field label="Автомобиль *">
          <Input value={form.car} onChange={(event) => set("car", event.target.value)} />
        </Field>
        <Field label="Госномер">
          <Input value={form.plate} onChange={(event) => set("plate", event.target.value)} />
        </Field>
      </div>
      <Field label="Услуга *">
        <Input
          list="appointment-services"
          value={form.plannedService}
          onChange={(event) => set("plannedService", event.target.value)}
        />
        <datalist id="appointment-services">
          {services.map((service) => <option key={service} value={service} />)}
        </datalist>
      </Field>
      <Field label="Комментарий">
        <Textarea value={form.comment} onChange={(event) => set("comment", event.target.value)} />
      </Field>
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        <Button onClick={onSubmit}>Сохранить запись</Button>
      </div>
    </div>
  );
}

function AppointmentCalendar({ appointments, todayIso }: { appointments: Appointment[]; todayIso: string }) {
  const sorted = [...appointments].sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  const dates = sorted.length ? sorted.map((appointment) => appointment.date) : [todayIso];
  const first = dateAtNoon(dates.reduce((min, date) => (date < min ? date : min), dates[0]));
  const last = dateAtNoon(dates.reduce((max, date) => (date > max ? date : max), dates[0]));
  const start = new Date(first.getTime() - mondayOffset(first) * dayMs);
  const end = new Date(last.getTime() + (6 - mondayOffset(last)) * dayMs);
  const days: Date[] = [];

  for (let cursor = start; cursor <= end; cursor = new Date(cursor.getTime() + dayMs)) {
    days.push(cursor);
  }

  const byDate = new Map<string, Appointment[]>();
  sorted.forEach((appointment) => {
    const current = byDate.get(appointment.date) ?? [];
    current.push(appointment);
    byDate.set(appointment.date, current);
  });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-border bg-border text-sm">
        {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map((day) => (
          <div key={day} className="bg-slate-50 px-2 py-2 text-center text-xs font-semibold uppercase text-muted-foreground">
            {day}
          </div>
        ))}
        {days.map((day) => {
          const date = isoDate(day);
          const dayAppointments = byDate.get(date) ?? [];
          return (
            <div key={date} className="min-h-32 bg-white p-2">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-semibold">{new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit" }).format(day)}</span>
                {date === todayIso && <Badge>Сегодня</Badge>}
              </div>
              <div className="space-y-1.5">
                {dayAppointments.map((appointment) => (
                  <div key={appointment.id} className="rounded-md border border-border bg-slate-50 px-2 py-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{appointment.time}</span>
                      <AppointmentStateBadge state={appointment.state} />
                    </div>
                    <p className="mt-1 font-medium">{appointment.car} {appointment.plate}</p>
                    <p className="truncate text-muted-foreground">{appointment.client || "Клиент не указан"}</p>
                    <p className="truncate text-muted-foreground">{appointment.plannedService}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {!appointments.length && (
        <p className="text-sm text-muted-foreground">Записей пока нет. Добавьте первую запись, и она появится в календаре.</p>
      )}
    </div>
  );
}

function AppointmentStateBadge({ state }: { state: AppointmentState }) {
  if (state === "accepted") return <Badge className="border-green-200 bg-green-50 text-green-700">В работе</Badge>;
  if (state === "cancelled") return <Badge>Отменена</Badge>;
  return <Badge className="border-blue-200 bg-blue-50 text-blue-700">Запись</Badge>;
}

function dateAtNoon(value: string) {
  return new Date(`${value}T12:00:00`);
}

function mondayOffset(date: Date) {
  return (date.getDay() + 6) % 7;
}

function AppointmentRow({
  appointment,
  overdue,
  deleteConfirm,
  onAccept,
  onMove,
  onCancel,
  onRestore,
  onEdit,
  onDelete,
  onDeleteRequest
}: {
  appointment: Appointment;
  overdue?: boolean;
  deleteConfirm: string | null;
  onAccept: (appointment: Appointment) => void;
  onMove: (appointment: Appointment) => void;
  onCancel: (appointment: Appointment) => void;
  onRestore: (appointment: Appointment) => void;
  onEdit: (appointment: Appointment) => void;
  onDelete: (id: string) => void;
  onDeleteRequest: (id: string | null) => void;
}) {
  const isDeleting = deleteConfirm === appointment.id;
  const isArchived = appointment.state !== "active";

  return (
    <Card className={`${isArchived ? "opacity-70" : ""} ${overdue ? "border-amber-200" : ""}`}>
      <CardContent className="grid gap-4 p-4 lg:grid-cols-[0.9fr_1.1fr_1.3fr_auto] lg:items-center">
        <div>
          <p className="font-semibold">{formatDate(appointment.date)}</p>
          <p className="text-sm text-muted-foreground">{appointment.time}</p>
        </div>
        <div>
          <p className="font-medium">{appointment.client || "Клиент не указан"}</p>
          <p className="text-sm text-muted-foreground">{appointment.phone || "Телефон не указан"}</p>
        </div>
        <div>
          <p className="font-medium">{appointment.car} {appointment.plate}</p>
          <p className="text-sm text-muted-foreground">{appointment.plannedService}{appointment.comment ? `, ${appointment.comment}` : ""}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {isDeleting ? (
            <>
              <span className="text-sm text-muted-foreground">Удалить запись?</span>
              <Button variant="secondary" size="sm" onClick={() => onDeleteRequest(null)}>Нет</Button>
              <Button size="sm" className="bg-red-600 hover:bg-red-700" onClick={() => { onDelete(appointment.id); onDeleteRequest(null); }}>Да</Button>
            </>
          ) : appointment.state === "accepted" ? (
            <>
              <Badge className="border-green-200 bg-green-50 text-green-700">Принята в работу</Badge>
              <Button variant="secondary" size="sm" className="text-red-500" onClick={() => onDeleteRequest(appointment.id)}>Удалить</Button>
            </>
          ) : appointment.state === "cancelled" ? (
            <>
              <Badge>Отменена</Badge>
              <Button variant="secondary" size="sm" onClick={() => onRestore(appointment)}>Вернуть</Button>
              <Button variant="secondary" size="sm" className="text-red-500" onClick={() => onDeleteRequest(appointment.id)}>Удалить</Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => onAccept(appointment)}>Принять</Button>
              <Button variant="secondary" size="sm" onClick={() => onEdit(appointment)}>Изменить</Button>
              <Button variant="secondary" size="sm" onClick={() => onMove(appointment)}>+1 день</Button>
              <Button variant="secondary" size="sm" onClick={() => onCancel(appointment)}>Отменить</Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ClientsSection({
  clients,
  query,
  onQuery
}: {
  clients: ReturnType<typeof buildClients>;
  query: string;
  onQuery: (value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-semibold">Клиенты</h2>
        <div className="relative sm:w-80">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Имя, телефон, госномер" />
        </div>
      </div>
      <div className="grid gap-3 xl:grid-cols-2">
        {clients.length ? clients.map((client) => {
          const sortedVisits = [...client.visits].sort((a, b) => b.date.localeCompare(a.date));
          return (
          <Card key={`${client.phone || client.name}-${client.cars[0] ?? ""}`}>
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <CardTitle>{client.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{client.phone || "Телефон не указан"}</p>
                </div>
                <Badge className="shrink-0">{client.visits.length} визит{plural(client.visits.length)}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {client.cars.length ? client.cars.map((car) => <Badge key={car}>{car}</Badge>) : <span className="text-sm text-muted-foreground">Авто не указано</span>}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <Info label="Всего" value={formatMoney(client.total)} />
                <Info label="Оплачено" value={formatMoney(client.paid)} />
                <Info label="Последний визит" value={client.lastVisit ? formatDate(client.lastVisit) : "—"} />
              </div>
              {client.upcoming.length > 0 && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm">
                  <span className="font-medium text-blue-700">📅 Записан: </span>
                  {client.upcoming
                    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
                    .map((appointment) => `${formatDate(appointment.date)} в ${appointment.time} — ${appointment.plannedService}`)
                    .join("; ")}
                </div>
              )}
              <div className="space-y-2">
                {sortedVisits.slice(0, 4).map((visit) => (
                  <div key={visit.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2 text-sm">
                    <span className="min-w-0 truncate">{formatDate(visit.date)} · {visit.works.map((work) => work.name).join(", ") || "—"}</span>
                    <span className="shrink-0 font-medium">{formatMoney(visitTotal(visit))}</span>
                  </div>
                ))}
                {sortedVisits.length > 4 && (
                  <p className="text-xs text-muted-foreground">…и ещё {sortedVisits.length - 4} визит{plural(sortedVisits.length - 4)}</p>
                )}
              </div>
            </CardContent>
          </Card>
          );
        }) : (
          <EmptyState title="Клиенты не найдены" text="Измените поиск или добавьте заезд, чтобы карточка клиента появилась автоматически." />
        )}
      </div>
    </div>
  );
}

function OrdersSection({
  visits,
  selected,
  company,
  onSelect
}: {
  visits: Visit[];
  selected: Visit | undefined;
  company: CompanySettings;
  onSelect: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const sorted = [...visits].sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`));
    if (!q) return sorted;
    return sorted.filter((visit) =>
      `${orderNumber(visit)} ${visit.client} ${visit.car} ${visit.plate} ${visit.phone}`.toLowerCase().includes(q)
    );
  }, [visits, query]);

  if (!visits.length) {
    return <EmptyState title="Заказ-нарядов нет" text="Они появятся после добавления заездов в разделе «Сегодня»." />;
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
      <div className="space-y-3">
        <h2 className="text-2xl font-semibold">Заказ-наряды</h2>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="№, клиент, авто, госномер" />
        </div>
        <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
          {filtered.length ? filtered.map((visit) => (
            <button
              key={visit.id}
              className={`block w-full rounded-xl border p-4 text-left transition-all ${
                selected?.id === visit.id ? "border-blue-500 bg-blue-50/70 shadow-md shadow-blue-100" : "border-border/60 bg-white shadow-sm hover:border-blue-200 hover:shadow-md"
              }`}
              onClick={() => onSelect(visit.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">№ {orderNumber(visit)}</p>
                <Badge className={statusClass(visit.status)}>{visit.status}</Badge>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(visit.date)} · {visit.car} {visit.plate}</p>
              <p className="mt-1 text-sm text-muted-foreground">{visit.client || "Клиент не указан"}</p>
              <p className="mt-2 text-sm font-medium">{formatMoney(visitTotal(visit))}</p>
            </button>
          )) : (
            <p className="px-1 py-4 text-sm text-muted-foreground">По запросу «{query}» ничего не найдено.</p>
          )}
        </div>
      </div>
      <div className="space-y-3">
        {selected ? (
          <>
            <div className="flex justify-end">
              <Button onClick={() => window.print()}>
                <Printer className="h-4 w-4" />
                Печать заказ-наряда
              </Button>
            </div>
            <OrderPrintSheet visit={selected} company={company} />
          </>
        ) : (
          <EmptyState title="Выберите заказ-наряд" text="Нажмите на заказ слева, чтобы открыть его для печати." />
        )}
      </div>
    </div>
  );
}

function orderNumber(visit: Visit) {
  return visit.id.replace(/\D/g, "").slice(-6).padStart(6, "0");
}

function OrderPrintSheet({ visit, company }: { visit: Visit; company: CompanySettings }) {
  return (
    <article className="print-sheet mx-auto max-w-3xl rounded-lg border border-border bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-300 pb-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">{company.name}</h2>
          <p className="mt-1 text-sm">{company.address}</p>
          <p className="text-sm">{company.phone}</p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm text-slate-500">Заказ-наряд</p>
          <p className="text-lg font-bold">№ {orderNumber(visit)}</p>
          <p className="text-sm">{formatDate(visit.date)}{visit.time ? `, ${visit.time}` : ""}</p>
        </div>
      </div>
      <div className="grid gap-4 border-b border-slate-300 py-5 text-sm sm:grid-cols-2">
        <Info label="Клиент" value={visit.client || "Не указан"} />
        <Info label="Телефон" value={visit.phone || "Не указан"} />
        <Info label="Автомобиль" value={visit.car} />
        <Info label="Госномер" value={visit.plate || "Не указан"} />
        <Info label="VIN" value={visit.vin || "Не указан"} />
        <Info label="Пробег" value={visit.mileage ? `${visit.mileage} км` : "Не указан"} />
      </div>
      <PrintTable title="Работы" items={visit.works} />
      <PrintTable title="Запчасти/материалы" items={visit.parts} empty="Не указаны" />
      <div className="ml-auto mt-5 max-w-sm space-y-2 text-sm">
        <TotalRow label="Сумма работ" value={visit.laborAmount} />
        <TotalRow label="Сумма запчастей" value={visit.partsAmount} />
        <TotalRow label="Итоговая сумма" value={visitTotal(visit)} strong />
      </div>
      <div className="mt-12 grid gap-8 text-sm sm:grid-cols-2">
        <div className="border-t border-slate-400 pt-2">Подпись клиента</div>
        <div className="border-t border-slate-400 pt-2">Подпись исполнителя</div>
      </div>
    </article>
  );
}

function PrintTable({ title, items, empty = "Нет" }: { title: string; items: WorkItem[]; empty?: string }) {
  return (
    <div className="mt-5">
      <h3 className="font-semibold">{title}</h3>
      <div className="mt-2 overflow-hidden rounded-md border border-slate-300">
        <table className="w-full border-collapse text-sm">
          <tbody>
            {items.length ? items.map((item, index) => (
              <tr key={`${item.name}-${index}`} className="border-b border-slate-200 last:border-b-0">
                <td className="px-3 py-2">{index + 1}. {item.name}</td>
                <td className="w-40 px-3 py-2 text-right">{formatMoney(item.amount)}</td>
              </tr>
            )) : (
              <tr><td className="px-3 py-2 text-slate-500">{empty}</td><td /></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function TotalRow({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-slate-300 pt-2 text-base font-bold" : ""}`}>
      <span>{label}</span>
      <span>{formatMoney(value)}</span>
    </div>
  );
}

function DaySummarySection({
  visits,
  mechanics,
  todayIso
}: {
  visits: Visit[];
  mechanics: Mechanic[];
  todayIso: string;
}) {
  const [date, setDate] = useState(todayIso);
  const dayVisits = useMemo(() => visits.filter((visit) => visit.date === date), [visits, date]);
  const totals = useMemo(() => buildDayTotals(dayVisits, mechanics), [dayVisits, mechanics]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Итог дня</h2>
          <p className="text-sm text-muted-foreground">{formatDate(date)}</p>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Дата">
            <Input type="date" max={todayIso} value={date} onChange={(event) => setDate(event.target.value || todayIso)} className="w-44" />
          </Field>
          {date !== todayIso && (
            <Button variant="secondary" onClick={() => setDate(todayIso)}>Сегодня</Button>
          )}
        </div>
      </div>
      {totals.visits === 0 ? (
        <EmptyState title="За этот день заездов нет" text="Выберите другую дату или добавьте заезд в разделе «Сегодня»." />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Всего заездов" value={totals.visits} />
            <StatCard label="Выручка" value={formatMoney(totals.total)} />
            <StatCard label="Не оплачено" value={formatMoney(totals.unpaid)} />
            <StatCard label="Чистыми" value={formatMoney(totals.clean)} />
          </div>
          <Card>
            <CardHeader><CardTitle>Поступления по способам оплаты</CardTitle></CardHeader>
            <CardContent className="grid gap-3 p-4 pt-0 sm:grid-cols-2 xl:grid-cols-5">
              <Info label="Наличные" value={formatMoney(totals.byPayment["Наличные"])} />
              <Info label="Перевод" value={formatMoney(totals.byPayment["Перевод"])} />
              <Info label="Терминал" value={formatMoney(totals.byPayment["Терминал"])} />
              <Info label="Безнал" value={formatMoney(totals.byPayment["Безнал"])} />
              <Info label="Не оплачено" value={formatMoney(totals.byPayment["Не оплачено"])} />
            </CardContent>
          </Card>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground">Начислено мастерам за день</h3>
            {totals.mechanicRows.length ? (
              <DataTable
                headers={["Мастер", "Заездов", "Сумма работ", "Процент", "Начислено за день"]}
                rows={totals.mechanicRows.map((row) => [
                  row.mechanic,
                  `${row.works}`,
                  formatMoney(row.labor),
                  `${row.percent}%`,
                  formatMoney(row.accrued)
                ])}
              />
            ) : (
              <p className="text-sm text-muted-foreground">В этот день работы мастеров не выполнялись.</p>
            )}
            <p className="text-xs text-muted-foreground">Итоговый расчёт с мастерами (за всё время) — в разделе «Настройки».</p>
          </div>
        </>
      )}
    </div>
  );
}

function StatsSection({ visits, mechanics }: { visits: Visit[]; mechanics: Mechanic[] }) {
  const periods = [
    { label: "День", days: 1 },
    { label: "Неделя", days: 7 },
    { label: "Месяц", days: 30 }
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Статистика</h2>
      <div className="grid gap-4 xl:grid-cols-3">
        {periods.map((period) => {
          const from = new Date(todayDate().getTime() - (period.days - 1) * dayMs);
          const slice = visits.filter((visit) => new Date(`${visit.date}T12:00:00`) >= from);
          const total = sum(slice.map(visitTotal));
          const paid = sum(slice.filter(isPaid).map(visitTotal));
          const serviceCounts = new Map<string, number>();
          slice.forEach((visit) => visit.works.forEach((work) => serviceCounts.set(work.name, (serviceCounts.get(work.name) ?? 0) + 1)));
          const popular = Array.from(serviceCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
          return (
            <Card key={period.label}>
              <CardHeader>
                <CardTitle>{period.label}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <Info label="Количество заездов" value={`${slice.length}`} />
                  <Info label="Выручка" value={formatMoney(total)} />
                  <Info label="Средний чек" value={formatMoney(slice.length ? Math.round(total / slice.length) : 0)} />
                  <Info label="Оплачено / не оплачено" value={`${formatMoney(paid)} / ${formatMoney(total - paid)}`} />
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Суммы по механикам</p>
                  <div className="mt-2 space-y-1 text-sm">
                    {mechanics.map((mechanic) => (
                      <div key={mechanic.id} className="flex justify-between gap-3">
                        <span>{mechanic.name}</span>
                        <span className="font-medium">{formatMoney(sum(slice.filter((visit) => visit.mechanic === mechanic.name).map((visit) => visit.laborAmount)))}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase text-muted-foreground">Популярные услуги</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {popular.length ? popular.map(([name, count]) => <Badge key={name}>{name} · {count}</Badge>) : <Badge>Нет данных</Badge>}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function nextMechanicId(mechanics: Mechanic[]) {
  const max = mechanics.reduce((acc, mechanic) => {
    const num = Number(mechanic.id.replace(/\D/g, ""));
    return Number.isFinite(num) ? Math.max(acc, num) : acc;
  }, 0);
  return `m-${max + 1}`;
}

function SettingsSection({
  state,
  setState
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [newService, setNewService] = useState("");
  const [newMechanic, setNewMechanic] = useState("");
  const settlement = useMemo(() => buildMechanicSettlement(state.visits, state.mechanics), [state.visits, state.mechanics]);

  const updateMechanic = (id: string, patch: Partial<Mechanic>) =>
    setState((current) => ({
      ...current,
      mechanics: current.mechanics.map((item) => (item.id === id ? { ...item, ...patch } : item))
    }));

  const addMechanic = () => {
    const name = newMechanic.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      mechanics: [...current.mechanics, { id: nextMechanicId(current.mechanics), name, percent: 40, paid: 0 }]
    }));
    setNewMechanic("");
  };

  const removeMechanic = (id: string) =>
    setState((current) => ({ ...current, mechanics: current.mechanics.filter((item) => item.id !== id) }));

  const addService = () => {
    const name = newService.trim();
    if (!name) return;
    setState((current) =>
      current.services.includes(name) ? current : { ...current, services: [...current.services, name] }
    );
    setNewService("");
  };

  const removeService = (name: string) =>
    setState((current) => ({ ...current, services: current.services.filter((item) => item !== name) }));

  return (
    <div className="space-y-5">
      <h2 className="text-2xl font-semibold">Настройки</h2>
      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Мастера</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_96px_40px]">
              <span>Имя</span>
              <span>Процент</span>
              <span></span>
            </div>
            {state.mechanics.map((mechanic) => (
              <div key={mechanic.id} className="grid gap-3 sm:grid-cols-[1fr_96px_40px] sm:items-center">
                <Input
                  value={mechanic.name}
                  onChange={(event) => updateMechanic(mechanic.id, { name: event.target.value })}
                />
                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={mechanic.percent}
                    onChange={(event) => updateMechanic(mechanic.id, { percent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                  />
                </div>
                <Button variant="secondary" size="sm" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => removeMechanic(mechanic.id)} title="Удалить мастера">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <div className="flex gap-2 pt-1">
              <Input
                value={newMechanic}
                placeholder="Имя нового мастера"
                onChange={(event) => setNewMechanic(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addMechanic()}
              />
              <Button variant="secondary" onClick={addMechanic}>
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Типовые услуги</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {state.services.map((service) => (
                <span key={service} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-slate-50 py-1 pl-3 pr-1.5 text-sm">
                  {service}
                  <button className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-red-100 hover:text-red-600" onClick={() => removeService(service)} title="Удалить">
                    ×
                  </button>
                </span>
              ))}
              {!state.services.length && <span className="text-sm text-muted-foreground">Услуги не добавлены</span>}
            </div>
            <div className="flex gap-2">
              <Input
                value={newService}
                placeholder="Новая услуга"
                onChange={(event) => setNewService(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addService()}
              />
              <Button variant="secondary" onClick={addService}>
                <Plus className="h-4 w-4" />
                Добавить
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Расчёт с мастерами</CardTitle>
            <p className="text-sm text-muted-foreground">Начислено по всем заездам за всё время минус уже выданное.</p>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-y border-border/60 text-left">
                  {["Мастер", "Заездов", "Начислено всего", "Выдано", "Остаток", ""].map((header) => (
                    <th key={header} className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {settlement.map((row) => (
                  <tr key={row.id} className="border-b border-border/40 last:border-b-0">
                    <td className="px-5 py-3 font-medium">{row.mechanic}</td>
                    <td className="px-5 py-3">{row.works}</td>
                    <td className="px-5 py-3">{formatMoney(row.accrued)}</td>
                    <td className="px-5 py-3">
                      <Input
                        type="number"
                        min={0}
                        value={row.paid}
                        className="h-8 w-28"
                        onChange={(event) => updateMechanic(row.id, { paid: Math.max(0, Number(event.target.value) || 0) })}
                      />
                    </td>
                    <td className={`px-5 py-3 font-semibold ${row.balance > 0 ? "text-amber-600" : "text-emerald-600"}`}>{formatMoney(row.balance)}</td>
                    <td className="px-5 py-3 text-right">
                      <Button size="sm" variant="secondary" disabled={row.balance <= 0} onClick={() => updateMechanic(row.id, { paid: row.accrued })}>
                        Выдать остаток
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Реквизиты автосервиса</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <Field label="Название">
              <Input value={state.company.name} onChange={(event) => setState((current) => ({ ...current, company: { ...current.company, name: event.target.value } }))} />
            </Field>
            <Field label="Адрес">
              <Input value={state.company.address} onChange={(event) => setState((current) => ({ ...current, company: { ...current.company, address: event.target.value } }))} />
            </Field>
            <Field label="Телефон">
              <Input value={state.company.phone} onChange={(event) => setState((current) => ({ ...current, company: { ...current.company, phone: event.target.value } }))} />
            </Field>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DataTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <Card className="overflow-hidden border-border/60 shadow-sm">
      <CardContent className="overflow-x-auto p-0">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-border/60 text-left">
              {headers.map((header) => <th key={header} className="px-5 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-border/40 transition-colors last:border-b-0 hover:bg-slate-50/50">
                {row.map((cell, cellIndex) => <td key={`${rowIndex}-${cellIndex}`} className="px-5 py-3.5">{cell}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
