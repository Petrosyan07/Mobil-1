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
  UserRound,
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
import { cn } from "@/lib/utils";

type PaymentMethod = "Наличные" | "Перевод" | "Терминал" | "Безнал" | "Не оплачено";
type VisitStatus = "Запланирован" | "В работе" | "Завершён" | "Оплачен";
type AppointmentState = "active" | "accepted" | "cancelled";

type Mechanic = {
  id: string;
  name: string;
  percent: number;
  paid: number;
};

type PayrollPayment = {
  id: string;
  mechanicId: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  comment: string;
};

type WorkItem = {
  name: string;
  amount: number;
};

type ServiceItem = {
  id: string;
  name: string;
  price: number;
  category: string;
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
  mechanicId?: string;
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

type SavedClient = {
  id: string;
  name: string;
  phone: string;
  car: string;
  plate: string;
  mileage: string;
  vin: string;
  note: string;
  createdAt: string;
};

type ClientVehicle = {
  key: string;
  label: string;
  car: string;
  plate: string;
  mileage: string;
  vin: string;
};

type CompanySettings = {
  name: string;
  legalName?: string;
  address: string;
  phone: string;
  email?: string;
  website?: string;
  taxId?: string;
  registrationId?: string;
  workHours?: string;
  director?: string;
};

type AppPreferences = {
  defaultPaymentMethod: PaymentMethod;
  defaultMechanicPercent: number;
  warrantyDays: number;
  orderPrefix: string;
  requirePhoneForClient: boolean;
};

type AppState = {
  visits: Visit[];
  appointments: Appointment[];
  mechanics: Mechanic[];
  services: ServiceItem[];
  company: CompanySettings;
  savedClients?: SavedClient[];
  clientNotes?: Record<string, string>;
  payrollPayments: PayrollPayment[];
  preferences: AppPreferences;
};

type MechanicSettlement = {
  id: string;
  mechanic: string;
  works: number;
  labor: number;
  percent: number;
  accrued: number;
  paid: number;
  balance: number;
};

type VisitForm = {
  clientKey: string;
  vehicleKey: string;
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
const defaultPreferences: AppPreferences = {
  defaultPaymentMethod: "Не оплачено",
  defaultMechanicPercent: 40,
  warrantyDays: 14,
  orderPrefix: "M1",
  requirePhoneForClient: false
};

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

function nextSavedClientId(clients: SavedClient[]) {
  const next = clients.reduce((max, client) => {
    const number = Number(client.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `c-${next}`;
}

function nextPayrollPaymentId(payments: PayrollPayment[]) {
  const next = payments.reduce((max, payment) => {
    const number = Number(payment.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `p-${next}`;
}

function nextServiceId(services: ServiceItem[]) {
  const next = services.reduce((max, service) => {
    const number = Number(service.id.replace(/\D/g, ""));
    return Number.isFinite(number) ? Math.max(max, number) : max;
  }, 0) + 1;

  return `s-${next}`;
}

function serviceDefaults(name: string) {
  const defaults: Record<string, { price: number; category: string }> = {
    "замена масла": { price: 1800, category: "ТО" },
    "диагностика ходовой": { price: 1500, category: "Диагностика" },
    "компьютерная диагностика": { price: 1800, category: "Диагностика" },
    "шиномонтаж": { price: 2800, category: "Колёса" },
    "ремонт колеса": { price: 700, category: "Колёса" },
    "замена тормозных колодок": { price: 3200, category: "Тормоза" },
    "замена тормозных дисков": { price: 4500, category: "Тормоза" },
    "замена свечей": { price: 2400, category: "Двигатель" },
    "заправка кондиционера": { price: 2500, category: "Климат" },
    "снятие/установка защиты картера": { price: 700, category: "ТО" }
  };

  return defaults[name.trim().toLowerCase()] ?? { price: 0, category: "Общие" };
}

function normalizeServices(services: AppState["services"] | string[] | undefined): ServiceItem[] {
  if (!services?.length) return mockState.services;
  return services.map((service, index) => {
    if (typeof service === "string") {
      const defaults = serviceDefaults(service);
      return { id: `s-${index + 1}`, name: service, price: defaults.price, category: defaults.category };
    }

    const defaults = serviceDefaults(service.name);
    return {
      id: service.id || `s-${index + 1}`,
      name: service.name,
      price: Math.max(0, Number(service.price) || defaults.price),
      category: service.category === "Общие" && defaults.category !== "Общие" ? defaults.category : service.category || defaults.category
    };
  });
}

function normalizeAppState(saved: AppState): AppState {
  const mechanics = saved.mechanics?.length ? saved.mechanics : mockState.mechanics;
  const visits = (saved.visits ?? []).map((visit) => {
    const byId = visit.mechanicId ? mechanics.find((mechanic) => mechanic.id === visit.mechanicId) : undefined;
    const byName = mechanics.find((mechanic) => mechanic.name === visit.mechanic);
    const mechanic = byId ?? byName;

    return {
      ...visit,
      mechanicId: mechanic?.id,
      mechanic: mechanic?.name ?? visit.mechanic
    };
  });

  return {
    ...mockState,
    ...saved,
    visits,
    mechanics,
    appointments: saved.appointments ?? [],
    services: normalizeServices(saved.services as AppState["services"] | string[] | undefined),
    company: { ...mockState.company, ...(saved.company ?? {}) },
    savedClients: saved.savedClients ?? [],
    clientNotes: saved.clientNotes ?? {},
    payrollPayments: saved.payrollPayments ?? [],
    preferences: { ...defaultPreferences, ...(saved.preferences ?? {}) }
  };
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

function createEmptyForm(mechanics?: Mechanic[], preferences: AppPreferences = defaultPreferences): VisitForm {
  return {
    clientKey: "",
    vehicleKey: "",
    time: currentTime(),
    client: "",
    phone: "",
    car: "",
    plate: "",
    mileage: "",
    vin: "",
    worksText: "",
    mechanic: mechanics?.[0]?.id ?? mechanics?.[0]?.name ?? "",
    laborAmount: "",
    partsText: "",
    partsAmount: "",
    paymentMethod: preferences.defaultPaymentMethod,
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
    { id: "s-1", name: "Замена масла", price: 1800, category: "ТО" },
    { id: "s-2", name: "Диагностика ходовой", price: 1500, category: "Диагностика" },
    { id: "s-3", name: "Компьютерная диагностика", price: 1800, category: "Диагностика" },
    { id: "s-4", name: "Шиномонтаж", price: 2800, category: "Колёса" },
    { id: "s-5", name: "Ремонт колеса", price: 700, category: "Колёса" },
    { id: "s-6", name: "Замена тормозных колодок", price: 3200, category: "Тормоза" },
    { id: "s-7", name: "Замена тормозных дисков", price: 4500, category: "Тормоза" },
    { id: "s-8", name: "Замена свечей", price: 2400, category: "Двигатель" },
    { id: "s-9", name: "Заправка кондиционера", price: 2500, category: "Климат" },
    { id: "s-10", name: "Снятие/установка защиты картера", price: 700, category: "ТО" }
  ],
  company: {
    name: "М1 / Mobil 1 Центр",
    legalName: "ООО «М1 Автоцентр»",
    address: "Красноярск, ул. Забобонова, 13",
    phone: "+7 (391) 000-00-00",
    email: "service@m1-auto.local",
    website: "",
    taxId: "",
    registrationId: "",
    workHours: "Пн-Сб 09:00-20:00",
    director: ""
  },
  preferences: {
    ...defaultPreferences
  },
  savedClients: [],
  clientNotes: {},
  payrollPayments: [],
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
      mechanicId: "m-1",
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
      mechanicId: "m-2",
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
      mechanicId: "m-3",
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
      mechanicId: "m-4",
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
  { id: "employees", label: "Сотрудники", href: "/employees", icon: UserRound },
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
        return normalizeAppState(JSON.parse(saved) as AppState);
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
  const [form, setForm] = useState<VisitForm>(() => createEmptyForm(state.mechanics, state.preferences ?? defaultPreferences));
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (section !== "today" || typeof window === "undefined") return;
    if (window.sessionStorage.getItem("m1-open-new-visit") !== "1") return;
    window.sessionStorage.removeItem("m1-open-new-visit");
    openNewVisitForm();
  }, [section]);

  const todayIso = todayIsoDate();
  const todayVisits = useMemo(() => state.visits.filter((visit) => visit.date === todayIso), [state.visits, todayIso]);
  const selectedOrder = state.visits.find((visit) => visit.id === selectedOrderId) ?? todayVisits[0] ?? state.visits[0];

  const dayTotals = useMemo(() => buildDayTotals(todayVisits, state.mechanics), [todayVisits, state.mechanics]);
  const clientCards = useMemo(
    () => buildClients(state.visits, state.appointments, todayIso, state.clientNotes, state.savedClients),
    [state.visits, state.appointments, state.clientNotes, state.savedClients, todayIso]
  );

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function openNewVisitForm() {
    setEditingVisit(null);
    setAcceptingId(null);
    setForm(createEmptyForm(state.mechanics, state.preferences ?? defaultPreferences));
    setFormError("");
    setFormOpen(true);
  }

  function openNewVisitFromFloatingButton() {
    if (section === "today") {
      openNewVisitForm();
      return;
    }

    window.sessionStorage.setItem("m1-open-new-visit", "1");
    router.push("/");
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
      clientKey: clientKey(visit.client || "Клиент без имени", visit.phone, visit.plate),
      vehicleKey: `${visit.car.trim().toLowerCase()}|${visit.plate.trim().toUpperCase()}`,
      time: visit.time,
      client: visit.client,
      phone: visit.phone,
      car: visit.car,
      plate: visit.plate,
      mileage: visit.mileage,
      vin: visit.vin,
      worksText: visit.works.map((w) => w.name).join(", "),
      mechanic: visit.mechanicId ?? visit.mechanic,
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

    const laborAmount = Math.max(0, Number(form.laborAmount) || 0);
    const partsAmount = Math.max(0, Number(form.partsAmount) || 0);
    const selectedMechanic = state.mechanics.find((mechanic) => mechanic.id === form.mechanic || mechanic.name === form.mechanic);
    const visitData = {
      time: form.time || currentTime(),
      client: form.client.trim(),
      phone: form.phone.trim(),
      car: form.car.trim(),
      plate: form.plate.trim().toUpperCase(),
      mileage: form.mileage.trim(),
      vin: form.vin.trim().toUpperCase(),
      works: parseItems(form.worksText, laborAmount),
      mechanic: selectedMechanic?.name ?? form.mechanic,
      mechanicId: selectedMechanic?.id,
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
    setForm(createEmptyForm(state.mechanics, state.preferences ?? defaultPreferences));
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
      clientKey: clientKey(appointment.client || "Клиент без имени", appointment.phone, appointment.plate),
      vehicleKey: `${appointment.car.trim().toLowerCase()}|${appointment.plate.trim().toUpperCase()}`,
      time: appointment.time || currentTime(),
      client: appointment.client,
      phone: appointment.phone,
      car: appointment.car,
      plate: appointment.plate,
      mileage: "",
      vin: "",
      worksText: appointment.plannedService,
      mechanic: state.mechanics[0]?.id ?? state.mechanics[0]?.name ?? "",
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

  function saveClient(client: ClientCard, data: { name: string; phone: string; note: string }) {
    const name = data.name.trim() || "Клиент без имени";
    const phone = data.phone.trim();
    const nextKey = clientKey(name, phone, client.cars[0] ?? "");

    setState((current) => {
      const nextNotes = { ...(current.clientNotes ?? {}) };
      delete nextNotes[client.key];
      if (data.note.trim()) nextNotes[nextKey] = data.note.trim();

      return {
        ...current,
        clientNotes: nextNotes,
        savedClients: (current.savedClients ?? []).map((saved) =>
          saved.id === client.savedId || clientKey(saved.name || "Клиент без имени", saved.phone, saved.plate) === client.key
            ? { ...saved, name, phone, note: data.note.trim() }
            : saved
        ),
        visits: current.visits.map((visit) =>
          clientKey(visit.client || "Клиент без имени", visit.phone, visit.plate) === client.key
            ? { ...visit, client: name, phone }
            : visit
        ),
        appointments: current.appointments.map((appointment) =>
          clientKey(appointment.client || "Клиент без имени", appointment.phone, appointment.plate) === client.key
            ? { ...appointment, client: name, phone }
            : appointment
        )
      };
    });
    showNotice(`Клиент обновлён: ${name}`);
  }

  function addClient(data: Omit<SavedClient, "id" | "createdAt">) {
    const name = data.name.trim();
    const car = data.car.trim();
    if (!name && !data.phone.trim() && !car && !data.plate.trim()) {
      showNotice("Заполните имя, телефон или автомобиль клиента");
      return;
    }

    const savedClient: SavedClient = {
      id: nextSavedClientId(state.savedClients ?? []),
      name: name || "Клиент без имени",
      phone: data.phone.trim(),
      car,
      plate: data.plate.trim().toUpperCase(),
      mileage: data.mileage.trim(),
      vin: data.vin.trim().toUpperCase(),
      note: data.note.trim(),
      createdAt: todayIso
    };

    setState((current) => {
      const nextNotes = { ...(current.clientNotes ?? {}) };
      const key = clientKey(savedClient.name, savedClient.phone, savedClient.plate);
      if (savedClient.note) nextNotes[key] = savedClient.note;

      return {
        ...current,
        savedClients: [...(current.savedClients ?? []), savedClient],
        clientNotes: nextNotes
      };
    });
    showNotice(`Клиент добавлен: ${savedClient.name}`);
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
        {notice && (
          <div className="no-print fixed right-6 top-6 z-50 flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-medium text-green-700 shadow-lg shadow-green-100">
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
              onNewVisit={openNewVisitForm}
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
              clients={clientCards}
              query={clientSearch}
              onQuery={setClientSearch}
              onSave={saveClient}
              onAdd={addClient}
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

          {section === "employees" && (
            <EmployeesSection state={state} setState={setState} />
          )}

          {section === "stats" && <StatsSection visits={state.visits} mechanics={state.mechanics} />}

          {section === "settings" && (
            <SettingsSection state={state} setState={setState} />
          )}
        </section>
        </div>
      </div>

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
            clients={clientCards}
            onChange={(nextForm) => {
              setForm(nextForm);
              if (formError) setFormError("");
            }}
            onSubmit={saveVisit}
          />
        </DialogContent>
      </Dialog>

      <Button
        className="no-print fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-blue-600 p-0 shadow-xl shadow-blue-600/30 hover:bg-blue-700"
        onClick={openNewVisitFromFloatingButton}
        title={section === "today" ? "Новый заезд" : "Перейти на сегодня и добавить заезд"}
      >
        <Plus className="h-6 w-6" />
      </Button>

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

function findMechanic(mechanics: Mechanic[], visit: Visit) {
  return mechanics.find((mechanic) => mechanic.id === visit.mechanicId) ??
    mechanics.find((mechanic) => mechanic.name === visit.mechanic);
}

function mechanicPercent(mechanics: Mechanic[], visit: Visit) {
  return findMechanic(mechanics, visit)?.percent ?? 0;
}

function visitMechanicAccrued(visit: Visit, mechanics: Mechanic[]) {
  return Math.round((visit.laborAmount * mechanicPercent(mechanics, visit)) / 100);
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
  const paidMechanicAccrued = sum(paidVisits.map((visit) => visitMechanicAccrued(visit, mechanics)));

  // Сводка по мастерам — только за этот день (начислено за день).
  const mechanicRows = mechanics.map((mechanic) => {
    const mechanicVisits = visits.filter((visit) => findMechanic(mechanics, visit)?.id === mechanic.id);
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

// Расчёт с сотрудниками за всё время: начислено по всем заездам минус уже выданное.
function buildMechanicSettlement(visits: Visit[], mechanics: Mechanic[]): MechanicSettlement[] {
  return mechanics.map((mechanic) => {
    const mechanicVisits = visits.filter((visit) => findMechanic(mechanics, visit)?.id === mechanic.id);
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
  key: string;
  savedId?: string;
  name: string;
  phone: string;
  cars: string[];
  vehicles: ClientVehicle[];
  visits: Visit[];
  upcoming: Appointment[];
  total: number;
  paid: number;
  unpaid: number;
  average: number;
  firstVisit: string;
  lastVisit: string;
  nextAppointment: string;
  note: string;
};

// Ключ клиента: нормализованный телефон, иначе — имя в нижнем регистре, иначе госномер.
function clientKey(name: string, phone: string, plate: string) {
  const normalized = normalizePhone(phone);
  if (normalized) return `tel:${normalized}`;
  if (name.trim()) return `name:${name.trim().toLowerCase()}`;
  return `car:${plate || "—"}`;
}

function buildClients(
  visits: Visit[],
  appointments: Appointment[],
  todayIso: string,
  notes: Record<string, string> = {},
  savedClients: SavedClient[] = []
): ClientCard[] {
  const map = new Map<string, ClientCard>();
  const upsertVehicle = (card: ClientCard, vehicle: Omit<ClientVehicle, "key" | "label">) => {
    const key = `${vehicle.car.trim().toLowerCase()}|${vehicle.plate.trim().toUpperCase()}`;
    if (!vehicle.car.trim() && !vehicle.plate.trim()) return;
    const label = `${vehicle.car}${vehicle.plate ? `, ${vehicle.plate}` : ""}`;
    const existingIndex = card.vehicles.findIndex((item) => item.key === key);
    const nextVehicle: ClientVehicle = { key, label, ...vehicle };
    if (existingIndex >= 0) {
      card.vehicles[existingIndex] = {
        ...card.vehicles[existingIndex],
        ...nextVehicle,
        mileage: nextVehicle.mileage || card.vehicles[existingIndex].mileage,
        vin: nextVehicle.vin || card.vehicles[existingIndex].vin
      };
    } else {
      card.vehicles.push(nextVehicle);
    }
    if (!card.cars.includes(label)) card.cars.push(label);
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
    const card: ClientCard = {
      key,
      name,
      phone,
      cars: [],
      vehicles: [],
      visits: [],
      upcoming: [],
      total: 0,
      paid: 0,
      unpaid: 0,
      average: 0,
      firstVisit: "",
      lastVisit: "",
      nextAppointment: "",
      note: notes[key] ?? ""
    };
    map.set(key, card);
    return card;
  };

  savedClients.forEach((saved) => {
    const card = ensure(saved.name || "Клиент без имени", saved.phone, saved.plate);
    card.savedId = saved.id;
    if (saved.note && !card.note) card.note = saved.note;
    upsertVehicle(card, {
      car: saved.car,
      plate: saved.plate,
      mileage: saved.mileage,
      vin: saved.vin
    });
  });

  visits.forEach((visit) => {
    const name = visit.client || "Клиент без имени";
    const card = ensure(name, visit.phone, visit.plate);
    upsertVehicle(card, {
      car: visit.car,
      plate: visit.plate,
      mileage: visit.mileage,
      vin: visit.vin
    });
    card.visits.push(visit);
    card.total += visitTotal(visit);
    if (isPaid(visit)) card.paid += visitTotal(visit);
    card.unpaid = card.total - card.paid;
    card.average = card.visits.length ? Math.round(card.total / card.visits.length) : 0;
    if (!card.firstVisit || visit.date < card.firstVisit) card.firstVisit = visit.date;
    if (visit.date > card.lastVisit) card.lastVisit = visit.date;
  });

  // Привязываем предстоящие активные записи и создаём карточку, даже если клиент ещё не приезжал.
  appointments
    .filter((appointment) => appointment.state === "active" && appointment.date >= todayIso)
    .forEach((appointment) => {
      const card = ensure(appointment.client || "Клиент без имени", appointment.phone, appointment.plate);
      upsertVehicle(card, {
        car: appointment.car,
        plate: appointment.plate,
        mileage: "",
        vin: ""
      });
      card.upcoming.push(appointment);
      const appointmentStamp = `${appointment.date} ${appointment.time || "00:00"}`;
      if (!card.nextAppointment || appointmentStamp < card.nextAppointment) card.nextAppointment = appointmentStamp;
    });

  return Array.from(map.values()).sort((a, b) => {
    const bActivity = b.lastVisit || b.nextAppointment;
    const aActivity = a.lastVisit || a.nextAppointment;
    return bActivity.localeCompare(aActivity);
  });
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
  onDeleteCancel,
  onNewVisit
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
  onNewVisit: () => void;
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
          <EmptyState title="Заездов сегодня пока нет" text="Добавьте первый заезд через кнопку ниже." />
        )}
      </div>
      <div className="flex justify-center">
        <Button className="gap-2 rounded-lg bg-blue-600 px-6 shadow-md shadow-blue-600/25 hover:bg-blue-700" onClick={onNewVisit}>
          <Plus className="h-4 w-4" />
          Новый заезд
        </Button>
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
  clients,
  onChange,
  onSubmit
}: {
  form: VisitForm;
  error: string;
  mechanics: Mechanic[];
  services: ServiceItem[];
  clients: ClientCard[];
  onChange: (form: VisitForm) => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof VisitForm>(key: K, value: VisitForm[K]) => onChange({ ...form, [key]: value });
  const selectedClient = clients.find((client) => client.key === form.clientKey);

  const chooseClient = (key: string) => {
    const client = clients.find((item) => item.key === key);
    if (!client) {
      onChange({ ...form, clientKey: "", vehicleKey: "" });
      return;
    }

    const vehicle = client.vehicles[0];
    onChange({
      ...form,
      clientKey: client.key,
      vehicleKey: vehicle?.key ?? "",
      client: client.name,
      phone: client.phone,
      car: vehicle?.car ?? form.car,
      plate: vehicle?.plate ?? form.plate,
      mileage: vehicle?.mileage ?? form.mileage,
      vin: vehicle?.vin ?? form.vin
    });
  };

  const chooseVehicle = (key: string) => {
    const vehicle = selectedClient?.vehicles.find((item) => item.key === key);
    if (!vehicle) {
      onChange({ ...form, vehicleKey: "" });
      return;
    }

    onChange({
      ...form,
      vehicleKey: vehicle.key,
      car: vehicle.car,
      plate: vehicle.plate,
      mileage: vehicle.mileage,
      vin: vehicle.vin
    });
  };

  const changeWorks = (value: string) => {
    const service = services.find((item) => item.name.toLowerCase() === value.trim().toLowerCase());
    onChange({
      ...form,
      worksText: value,
      laborAmount: service?.price && !form.laborAmount ? String(service.price) : form.laborAmount
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-4">
        <h3 className="font-semibold">Клиент из базы</h3>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Выбрать клиента">
            <NativeSelect value={form.clientKey} onChange={(event) => chooseClient(event.target.value)}>
              <option value="">Ввести вручную</option>
              {clients.map((client) => (
                <option key={client.key} value={client.key}>
                  {client.name}{client.phone ? ` · ${client.phone}` : ""}{client.cars[0] ? ` · ${client.cars[0]}` : ""}
                </option>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Автомобиль клиента">
            <NativeSelect value={form.vehicleKey} onChange={(event) => chooseVehicle(event.target.value)} disabled={!selectedClient?.vehicles.length}>
              <option value="">{selectedClient?.vehicles.length ? "Выбрать автомобиль" : "Нет автомобилей в базе"}</option>
              {selectedClient?.vehicles.map((vehicle) => (
                <option key={vehicle.key} value={vehicle.key}>{vehicle.label}</option>
              ))}
            </NativeSelect>
          </Field>
        </div>
      </div>
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
              onChange={(event) => changeWorks(event.target.value)}
            />
            <datalist id="services">
              {services.map((service) => <option key={service.id} value={service.name} label={service.price ? formatMoney(service.price) : service.category} />)}
            </datalist>
          </Field>
        <Field label="Механик">
          <NativeSelect value={form.mechanic} onChange={(event) => set("mechanic", event.target.value)}>
            {mechanics.map((mechanic) => <option key={mechanic.id} value={mechanic.id}>{mechanic.name}</option>)}
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

function NativeSelect({ className, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "flex h-10 w-full rounded-lg border border-input bg-white px-3 py-2 text-sm outline-none transition-all focus-visible:border-blue-400 focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
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
  services: ServiceItem[];
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
  services: ServiceItem[];
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
          {services.map((service) => <option key={service.id} value={service.name} />)}
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
  onQuery,
  onSave,
  onAdd
}: {
  clients: ReturnType<typeof buildClients>;
  query: string;
  onQuery: (value: string) => void;
  onSave: (client: ClientCard, data: { name: string; phone: string; note: string }) => void;
  onAdd: (client: Omit<SavedClient, "id" | "createdAt">) => void;
}) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("activity");
  const [selectedKey, setSelectedKey] = useState(clients[0]?.key ?? "");
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", phone: "", note: "" });
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<Omit<SavedClient, "id" | "createdAt">>({
    name: "",
    phone: "",
    car: "",
    plate: "",
    mileage: "",
    vin: "",
    note: ""
  });

  const visibleClients = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = clients.filter((client) => {
      const searchText = `${client.name} ${client.phone} ${client.cars.join(" ")} ${client.note}`.toLowerCase();
      const matchesQuery = !q || searchText.includes(q);
      if (!matchesQuery) return false;
      if (filter === "debt") return client.unpaid > 0;
      if (filter === "upcoming") return client.upcoming.length > 0;
      if (filter === "vip") return client.total >= 10000 || client.visits.length >= 3;
      if (filter === "no-phone") return !client.phone;
      return true;
    });

    return filtered.sort((a, b) => {
      if (sort === "total") return b.total - a.total;
      if (sort === "debt") return b.unpaid - a.unpaid;
      if (sort === "name") return a.name.localeCompare(b.name, "ru");
      const bActivity = b.lastVisit || b.nextAppointment;
      const aActivity = a.lastVisit || a.nextAppointment;
      return bActivity.localeCompare(aActivity);
    });
  }, [clients, filter, query, sort]);

  const selectedClient = visibleClients.find((client) => client.key === selectedKey) ?? visibleClients[0] ?? clients[0];
  const totals = {
    clients: clients.length,
    visits: sum(clients.map((client) => client.visits.length)),
    paid: sum(clients.map((client) => client.paid)),
    unpaid: sum(clients.map((client) => client.unpaid)),
    upcoming: sum(clients.map((client) => client.upcoming.length))
  };

  useEffect(() => {
    if (!selectedClient) return;
    setSelectedKey(selectedClient.key);
    setEditForm({ name: selectedClient.name, phone: selectedClient.phone, note: selectedClient.note });
  }, [selectedClient?.key]);

  const saveEdit = () => {
    if (!selectedClient) return;
    onSave(selectedClient, editForm);
    setEditing(false);
  };

  const saveNewClient = () => {
    onAdd(addForm);
    setAddForm({ name: "", phone: "", car: "", plate: "", mileage: "", vin: "", note: "" });
    setAddOpen(false);
  };

  const filters = [
    { id: "all", label: "Все" },
    { id: "debt", label: "С долгом" },
    { id: "upcoming", label: "Записаны" },
    { id: "vip", label: "Постоянные" },
    { id: "no-phone", label: "Без телефона" }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Клиенты</h2>
          <p className="text-sm text-muted-foreground">База клиентов, долги, будущие записи и история обращений.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="relative sm:w-80">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Имя, телефон, госномер, заметка" />
          </div>
          <NativeSelect value={sort} onChange={(event) => setSort(event.target.value)} className="sm:w-44">
            <option value="activity">Сначала активные</option>
            <option value="total">По выручке</option>
            <option value="debt">По долгу</option>
            <option value="name">По имени</option>
          </NativeSelect>
          <Button onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4" />
            Новый клиент
          </Button>
        </div>
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Новый клиент</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Имя">
                <Input value={addForm.name} onChange={(event) => setAddForm((current) => ({ ...current, name: event.target.value }))} />
              </Field>
              <Field label="Телефон">
                <Input value={addForm.phone} onChange={(event) => setAddForm((current) => ({ ...current, phone: event.target.value }))} />
              </Field>
              <Field label="Автомобиль">
                <Input value={addForm.car} onChange={(event) => setAddForm((current) => ({ ...current, car: event.target.value }))} />
              </Field>
              <Field label="Госномер">
                <Input value={addForm.plate} onChange={(event) => setAddForm((current) => ({ ...current, plate: event.target.value }))} />
              </Field>
              <Field label="Пробег">
                <Input value={addForm.mileage} onChange={(event) => setAddForm((current) => ({ ...current, mileage: event.target.value }))} />
              </Field>
              <Field label="VIN">
                <Input value={addForm.vin} onChange={(event) => setAddForm((current) => ({ ...current, vin: event.target.value }))} />
              </Field>
            </div>
            <Field label="Заметка">
              <Textarea value={addForm.note} onChange={(event) => setAddForm((current) => ({ ...current, note: event.target.value }))} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAddOpen(false)}>Отмена</Button>
              <Button onClick={saveNewClient}>Добавить клиента</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Клиентов" value={totals.clients} />
        <StatCard label="Визитов" value={totals.visits} />
        <StatCard label="Оплачено" value={formatMoney(totals.paid)} />
        <StatCard label="Долг" value={formatMoney(totals.unpaid)} />
        <StatCard label="Записей" value={totals.upcoming} />
      </div>

      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item.id}
            variant={filter === item.id ? "default" : "secondary"}
            size="sm"
            onClick={() => setFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
      </div>

      {clients.length ? (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <div className="space-y-2">
            {visibleClients.length ? visibleClients.map((client) => {
              const isSelected = selectedClient?.key === client.key;
              return (
                <button
                  key={client.key}
                  className={`block w-full rounded-xl border p-4 text-left transition-all ${
                    isSelected ? "border-blue-500 bg-blue-50/70 shadow-md shadow-blue-100" : "border-border/60 bg-white shadow-sm hover:border-blue-200 hover:shadow-md"
                  }`}
                  onClick={() => {
                    setSelectedKey(client.key);
                    setEditing(false);
                  }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{client.name}</p>
                      <p className="truncate text-sm text-muted-foreground">{client.phone || "Телефон не указан"}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge>{client.visits.length} визит{plural(client.visits.length)}</Badge>
                      {client.unpaid > 0 && <Badge className="border-amber-200 bg-amber-50 text-amber-700">Долг</Badge>}
                    </div>
                  </div>
                  <p className="mt-3 truncate text-sm text-muted-foreground">{client.cars.join("; ") || "Авто не указано"}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="uppercase text-muted-foreground">Всего</p>
                      <p className="font-semibold">{formatMoney(client.total)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-muted-foreground">Долг</p>
                      <p className={`font-semibold ${client.unpaid > 0 ? "text-amber-600" : ""}`}>{formatMoney(client.unpaid)}</p>
                    </div>
                    <div>
                      <p className="uppercase text-muted-foreground">Активность</p>
                      <p className="font-semibold">{client.lastVisit ? formatDate(client.lastVisit) : client.nextAppointment ? "Запись" : "—"}</p>
                    </div>
                  </div>
                </button>
              );
            }) : (
              <EmptyState title="Клиенты не найдены" text="Измените поиск или фильтр, чтобы увидеть карточки клиентов." />
            )}
          </div>

          {selectedClient ? (
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <CardTitle>{selectedClient.name}</CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">{selectedClient.phone || "Телефон не указан"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {selectedClient.unpaid > 0 && <Badge className="border-amber-200 bg-amber-50 text-amber-700">Есть долг</Badge>}
                    {selectedClient.upcoming.length > 0 && <Badge className="border-blue-200 bg-blue-50 text-blue-700">Есть запись</Badge>}
                    {(selectedClient.total >= 10000 || selectedClient.visits.length >= 3) && <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">Постоянный</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                {editing ? (
                  <div className="rounded-lg border border-border/60 bg-slate-50/70 p-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Имя">
                        <Input value={editForm.name} onChange={(event) => setEditForm((current) => ({ ...current, name: event.target.value }))} />
                      </Field>
                      <Field label="Телефон">
                        <Input value={editForm.phone} onChange={(event) => setEditForm((current) => ({ ...current, phone: event.target.value }))} />
                      </Field>
                    </div>
                    <div className="mt-4">
                      <Field label="Заметка">
                        <Textarea value={editForm.note} onChange={(event) => setEditForm((current) => ({ ...current, note: event.target.value }))} />
                      </Field>
                    </div>
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="secondary" onClick={() => {
                        setEditForm({ name: selectedClient.name, phone: selectedClient.phone, note: selectedClient.note });
                        setEditing(false);
                      }}>Отмена</Button>
                      <Button onClick={saveEdit}>Сохранить клиента</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-end">
                    <Button variant="secondary" onClick={() => setEditing(true)}>Редактировать клиента</Button>
                  </div>
                )}

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <Info label="Всего" value={formatMoney(selectedClient.total)} />
                  <Info label="Оплачено" value={formatMoney(selectedClient.paid)} />
                  <Info label="Долг" value={formatMoney(selectedClient.unpaid)} />
                  <Info label="Средний чек" value={formatMoney(selectedClient.average)} />
                  <Info label="Первый визит" value={selectedClient.firstVisit ? formatDate(selectedClient.firstVisit) : "—"} />
                  <Info label="Последний визит" value={selectedClient.lastVisit ? formatDate(selectedClient.lastVisit) : "—"} />
                  <Info label="Визитов" value={`${selectedClient.visits.length}`} />
                  <Info label="Авто" value={`${selectedClient.cars.length}`} />
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground">Автомобили</h3>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedClient.cars.length ? selectedClient.cars.map((car) => <Badge key={car}>{car}</Badge>) : <span className="text-sm text-muted-foreground">Авто не указано</span>}
                  </div>
                </div>

                {selectedClient.note && (
                  <div className="rounded-lg border border-border/60 bg-slate-50/70 px-4 py-3 text-sm">
                    <p className="text-xs font-medium uppercase text-muted-foreground">Заметка</p>
                    <p className="mt-1">{selectedClient.note}</p>
                  </div>
                )}

                {selectedClient.upcoming.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground">Ближайшие записи</h3>
                    <div className="mt-2 space-y-2">
                      {[...selectedClient.upcoming]
                        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))
                        .map((appointment) => (
                          <div key={appointment.id} className="rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-sm">
                            <p className="font-medium text-blue-700">{formatDate(appointment.date)} в {appointment.time}</p>
                            <p className="text-muted-foreground">{appointment.car} {appointment.plate} · {appointment.plannedService}</p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground">История визитов</h3>
                  <div className="mt-2 space-y-2">
                    {selectedClient.visits.length ? [...selectedClient.visits]
                      .sort((a, b) => `${b.date} ${b.time}`.localeCompare(`${a.date} ${a.time}`))
                      .map((visit) => (
                        <div key={visit.id} className="grid gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm lg:grid-cols-[1fr_auto] lg:items-center">
                          <div className="min-w-0">
                            <p className="font-medium">{formatDate(visit.date)}{visit.time ? `, ${visit.time}` : ""} · {visit.car} {visit.plate}</p>
                            <p className="truncate text-muted-foreground">{visit.works.map((work) => work.name).join(", ") || "Работы не указаны"}</p>
                          </div>
                          <div className="flex items-center gap-2 lg:justify-end">
                            <Badge className={isPaid(visit) ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}>
                              {isPaid(visit) ? "Оплачен" : "Не оплачен"}
                            </Badge>
                            <span className="font-semibold">{formatMoney(visitTotal(visit))}</span>
                          </div>
                        </div>
                      )) : (
                        <p className="text-sm text-muted-foreground">У клиента пока нет завершённых визитов.</p>
                      )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="Выберите клиента" text="Карточка клиента откроется справа." />
          )}
        </div>
      ) : (
        <EmptyState title="Клиентов пока нет" text="Клиенты появятся после добавления заезда или активной записи." />
      )}
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
          {company.legalName && <p className="mt-1 text-sm">{company.legalName}</p>}
          <p className="mt-1 text-sm">{company.address}</p>
          <p className="text-sm">{company.phone}</p>
          {(company.email || company.website) && <p className="text-sm">{[company.email, company.website].filter(Boolean).join(" · ")}</p>}
          {(company.taxId || company.registrationId) && <p className="text-sm">{[company.taxId ? `ИНН ${company.taxId}` : "", company.registrationId ? `ОГРН ${company.registrationId}` : ""].filter(Boolean).join(" · ")}</p>}
          {company.workHours && <p className="text-sm">Режим работы: {company.workHours}</p>}
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
            <p className="text-xs text-muted-foreground">Итоговый расчёт с сотрудниками (за всё время) — в разделе «Сотрудники».</p>
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
                        <span className="font-medium">{formatMoney(sum(slice.filter((visit) => findMechanic(mechanics, visit)?.id === mechanic.id).map((visit) => visit.laborAmount)))}</span>
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

function EmployeesSection({
  state,
  setState
}: {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}) {
  const [newMechanic, setNewMechanic] = useState("");
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: "", percent: "", paid: "" });
  const [selectedId, setSelectedId] = useState("");
  const [period, setPeriod] = useState("month");
  const [fromDate, setFromDate] = useState(addDays(-29));
  const [toDate, setToDate] = useState(todayIsoDate());
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("Наличные");
  const [paymentComment, setPaymentComment] = useState("");

  const periodRange = useMemo(() => {
    const today = todayIsoDate();
    if (period === "today") return { from: today, to: today, label: "сегодня" };
    if (period === "week") return { from: addDays(-6), to: today, label: "7 дней" };
    if (period === "month") return { from: addDays(-29), to: today, label: "30 дней" };
    if (period === "custom") return { from: fromDate, to: toDate, label: "период" };
    return { from: "", to: "", label: "всё время" };
  }, [fromDate, period, toDate]);

  const visitsInPeriod = useMemo(() => {
    if (period === "all") return state.visits;
    return state.visits.filter((visit) => visit.date >= periodRange.from && visit.date <= periodRange.to);
  }, [period, periodRange.from, periodRange.to, state.visits]);

  const paymentsInPeriod = useMemo(() => {
    if (period === "all") return state.payrollPayments;
    return state.payrollPayments.filter((payment) => payment.date >= periodRange.from && payment.date <= periodRange.to);
  }, [period, periodRange.from, periodRange.to, state.payrollPayments]);

  const settlement = useMemo(() => buildMechanicSettlement(state.visits, state.mechanics), [state.visits, state.mechanics]);
  const settlementById = new Map(settlement.map((row) => [row.id, row]));
  const employeeRows = state.mechanics.map((mechanic) => {
    const periodVisits = visitsInPeriod.filter((visit) => findMechanic(state.mechanics, visit)?.id === mechanic.id);
    const periodLabor = sum(periodVisits.map((visit) => visit.laborAmount));
    const periodAccrued = Math.round((periodLabor * mechanic.percent) / 100);
    const periodPaid = sum(paymentsInPeriod.filter((payment) => payment.mechanicId === mechanic.id).map((payment) => payment.amount));
    const all = settlementById.get(mechanic.id);

    return {
      id: mechanic.id,
      name: mechanic.name,
      percent: mechanic.percent,
      periodVisits,
      periodWorks: periodVisits.length,
      periodLabor,
      periodAccrued,
      periodPaid,
      allAccrued: all?.accrued ?? 0,
      allPaid: all?.paid ?? mechanic.paid,
      balance: all?.balance ?? 0
    };
  });
  const sortedEmployeeRows = [...employeeRows].sort((a, b) => {
    if (b.balance !== a.balance) return b.balance - a.balance;
    if (b.periodAccrued !== a.periodAccrued) return b.periodAccrued - a.periodAccrued;
    return a.name.localeCompare(b.name);
  });

  const totals = {
    periodWorks: sum(employeeRows.map((row) => row.periodWorks)),
    periodLabor: sum(employeeRows.map((row) => row.periodLabor)),
    periodAccrued: sum(employeeRows.map((row) => row.periodAccrued)),
    periodPaid: sum(employeeRows.map((row) => row.periodPaid)),
    allBalance: sum(employeeRows.map((row) => row.balance)),
    payoutDue: sum(employeeRows.map((row) => Math.max(0, row.balance))),
    peopleDue: employeeRows.filter((row) => row.balance > 0).length
  };
  const selected = (selectedId ? employeeRows.find((row) => row.id === selectedId) : undefined) ?? sortedEmployeeRows[0] ?? employeeRows[0];
  const selectedMechanic = selected ? state.mechanics.find((mechanic) => mechanic.id === selected.id) : undefined;
  const selectedTimeline = useMemo(() => {
    if (!selected) return [];

    const mechanicPayments = state.payrollPayments.filter((payment) => payment.mechanicId === selected.id);
    const loggedPaid = sum(mechanicPayments.map((payment) => payment.amount));
    const legacyPaid = Math.max(0, selected.allPaid - loggedPaid);
    type PayrollTimelineEvent = {
      id: string;
      kind: "accrual" | "payment";
      date: string;
      time: string;
      sortKey: string;
      title: string;
      meta: string;
      amount: number;
    };
    const events: PayrollTimelineEvent[] = [
      ...state.visits
        .filter((visit) => findMechanic(state.mechanics, visit)?.id === selected.id)
        .map((visit) => ({
          id: `visit-${visit.id}`,
          kind: "accrual" as const,
          date: visit.date,
          time: visit.time,
          sortKey: `${visit.date} ${visit.time || "00:00"} visit-${visit.id}`,
          title: visit.works.map((work) => work.name).join(", ") || "Работы",
          meta: `${visit.car}${visit.plate ? ` ${visit.plate}` : ""}`,
          amount: visitMechanicAccrued(visit, state.mechanics)
        })),
      ...mechanicPayments.map((payment) => ({
        id: `payment-${payment.id}`,
        kind: "payment" as const,
        date: payment.date,
        time: "",
        sortKey: `${payment.date} 23:59 payment-${payment.id}`,
        title: payment.comment || "Выплата",
        meta: payment.method,
        amount: -payment.amount
      }))
    ];

    if (legacyPaid > 0) {
      events.push({
        id: `legacy-${selected.id}`,
        kind: "payment" as const,
        date: "",
        time: "",
        sortKey: `0000-00-00 00:00 legacy-${selected.id}`,
        title: "Ранее выдано",
        meta: "Перенесённая сумма",
        amount: -legacyPaid
      });
    }

    let balance = 0;
    return events
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
      .map((event) => {
        balance += event.amount;
        return { ...event, balanceAfter: balance };
      })
      .reverse();
  }, [selected, state.mechanics, state.payrollPayments, state.visits]);
  const selectedHasVisits = selected
    ? state.visits.some((visit) => visit.mechanicId === selected.id || findMechanic(state.mechanics, visit)?.id === selected.id)
    : false;

  const updateMechanic = (id: string, patch: Partial<Mechanic>) =>
    setState((current) => {
      const currentMechanic = current.mechanics.find((item) => item.id === id);
      const nextName = patch.name?.trim();
      const mechanics = current.mechanics.map((item) =>
        item.id === id
          ? {
              ...item,
              ...patch,
              name: nextName ?? patch.name ?? item.name,
              percent: patch.percent === undefined ? item.percent : Math.min(100, Math.max(0, patch.percent)),
              paid: patch.paid === undefined ? item.paid : Math.max(0, patch.paid)
            }
          : item
      );

      return {
        ...current,
        mechanics,
        visits: nextName && currentMechanic
          ? current.visits.map((visit) =>
              visit.mechanicId === id || visit.mechanic === currentMechanic.name
                ? { ...visit, mechanicId: id, mechanic: nextName }
                : visit
            )
          : current.visits
      };
    });

  const addMechanic = () => {
    const name = newMechanic.trim();
    if (!name) return;
    const nextId = nextMechanicId(state.mechanics);
    setState((current) =>
      current.mechanics.some((mechanic) => mechanic.name.toLowerCase() === name.toLowerCase())
        ? current
        : {
            ...current,
            mechanics: [
              ...current.mechanics,
              { id: nextId, name, percent: current.preferences.defaultMechanicPercent, paid: 0 }
            ]
          }
    );
    setSelectedId(nextId);
    setNewMechanic("");
    setAddDialogOpen(false);
  };

  const removeMechanic = (id: string) =>
    setState((current) => {
      const hasVisits = current.visits.some((visit) => visit.mechanicId === id || findMechanic(current.mechanics, visit)?.id === id);
      if (hasVisits) return current;
      return { ...current, mechanics: current.mechanics.filter((item) => item.id !== id) };
    });

  const registerPayment = (mechanicId: string, amount: number, comment = paymentComment) => {
    if (amount <= 0) return;
    setState((current) => ({
      ...current,
      payrollPayments: [
        {
          id: nextPayrollPaymentId(current.payrollPayments),
          mechanicId,
          date: todayIsoDate(),
          amount,
          method: paymentMethod,
          comment: comment.trim()
        },
        ...current.payrollPayments
      ],
      mechanics: current.mechanics.map((mechanic) =>
        mechanic.id === mechanicId ? { ...mechanic, paid: mechanic.paid + amount } : mechanic
      )
    }));
    setPaymentAmount("");
    setPaymentComment("");
  };

  const chooseEmployee = (id: string, balance: number) => {
    setSelectedId(id);
    setPaymentAmount(balance > 0 ? String(balance) : "");
  };

  const openProfile = () => {
    if (!selectedMechanic) return;
    setProfileDraft({
      name: selectedMechanic.name,
      percent: String(selectedMechanic.percent),
      paid: String(selectedMechanic.paid)
    });
    setProfileOpen(true);
  };

  const saveProfile = () => {
    if (!selectedMechanic) return;
    updateMechanic(selectedMechanic.id, {
      name: profileDraft.name,
      percent: Number(profileDraft.percent) || 0,
      paid: Number(profileDraft.paid) || 0
    });
    setProfileOpen(false);
  };

  const deleteSelectedMechanic = () => {
    if (!selectedMechanic || selectedHasVisits) return;
    const nextSelected = state.mechanics.find((mechanic) => mechanic.id !== selectedMechanic.id)?.id ?? "";
    removeMechanic(selectedMechanic.id);
    setSelectedId(nextSelected);
    setProfileOpen(false);
  };

  const formatSignedMoney = (value: number) => {
    if (value > 0) return `+${formatMoney(value)}`;
    if (value < 0) return `-${formatMoney(Math.abs(value))}`;
    return formatMoney(0);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Зарплата</h2>
          <p className="text-sm text-muted-foreground">Очередь выплат, быстрый расчёт и лента движений по сотрудникам.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <NativeSelect value={period} onChange={(event) => setPeriod(event.target.value)} className="sm:w-36">
            <option value="today">Сегодня</option>
            <option value="week">7 дней</option>
            <option value="month">30 дней</option>
            <option value="all">Всё время</option>
            <option value="custom">Период</option>
          </NativeSelect>
          {period === "custom" && (
            <>
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="sm:w-36" />
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="sm:w-36" />
            </>
          )}
          <Button variant="secondary" onClick={() => setAddDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Сотрудник
          </Button>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(220px,.6fr)_minmax(220px,.6fr)]">
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">К выплате сейчас</p>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-3xl font-semibold tracking-tight">{formatMoney(totals.payoutDue)}</p>
            <Badge className="w-fit border-amber-200 bg-amber-50 text-amber-700">
              {totals.peopleDue ? `${totals.peopleDue} к выплате` : "очередь пуста"}
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Начислено за {periodRange.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(totals.periodAccrued)}</p>
          <p className="mt-1 text-sm text-muted-foreground">{totals.periodWorks} работ</p>
        </div>
        <div className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Выплачено за {periodRange.label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{formatMoney(totals.periodPaid)}</p>
          <p className="mt-1 text-sm text-muted-foreground">Баланс всего: {formatMoney(totals.allBalance)}</p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className="overflow-hidden rounded-xl border border-border/60 bg-white shadow-sm">
          <div className="grid grid-cols-[1fr_auto] gap-3 border-b border-border/60 px-4 py-3">
            <div>
              <h3 className="font-semibold">Очередь выплат</h3>
              <p className="text-sm text-muted-foreground">Сначала сотрудники с самым большим остатком.</p>
            </div>
            <Badge>{sortedEmployeeRows.length}</Badge>
          </div>
          <div className="divide-y divide-border/50">
          {sortedEmployeeRows.length ? sortedEmployeeRows.map((row) => {
            const active = selected?.id === row.id;
            return (
              <div
                key={row.id}
                className={cn(
                  "grid gap-3 px-4 py-3 transition-colors md:grid-cols-[minmax(0,1fr)_150px_132px] md:items-center",
                  active ? "bg-blue-50/70" : "hover:bg-slate-50/70"
                )}
              >
                <button className="min-w-0 text-left" onClick={() => chooseEmployee(row.id, row.balance)}>
                  <div className="flex items-center gap-3">
                    <span className={cn("h-2.5 w-2.5 rounded-full", row.balance > 0 ? "bg-amber-400" : row.balance < 0 ? "bg-red-400" : "bg-emerald-400")} />
                    <div className="min-w-0">
                      <p className="truncate font-medium">{row.name}</p>
                      <p className="truncate text-sm text-muted-foreground">
                        {row.percent}% · {row.periodWorks ? `${row.periodWorks} работ за ${periodRange.label}` : "без работ за период"}
                      </p>
                    </div>
                  </div>
                </button>
                <button className="text-left md:text-right" onClick={() => chooseEmployee(row.id, row.balance)}>
                  <p className={cn("text-lg font-semibold tracking-tight", row.balance > 0 ? "text-amber-700" : row.balance < 0 ? "text-red-600" : "text-emerald-700")}>
                    {formatMoney(row.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">остаток</p>
                </button>
                <Button
                  variant={row.balance > 0 ? "default" : "secondary"}
                  disabled={row.balance <= 0}
                  onClick={() => {
                    chooseEmployee(row.id, row.balance);
                    registerPayment(row.id, row.balance, "Закрытие остатка");
                  }}
                >
                  Выплатить
                </Button>
              </div>
            );
          }) : (
            <EmptyState title="Сотрудников пока нет" text="Добавьте первого сотрудника, чтобы вести расчёты." />
          )}
          </div>
        </section>

        {selected && selectedMechanic ? (
          <aside className="space-y-5">
            <section className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted-foreground">Выбран сотрудник</p>
                  <h3 className="text-xl font-semibold tracking-tight">{selected.name}</h3>
                </div>
                <Button variant="secondary" size="icon" onClick={openProfile} title="Настройки сотрудника">
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-5 rounded-lg border border-border/60 bg-slate-50/70 p-4">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Остаток к выплате</p>
                <p className={cn("mt-2 text-3xl font-semibold tracking-tight", selected.balance > 0 ? "text-amber-700" : selected.balance < 0 ? "text-red-600" : "text-emerald-700")}>
                  {formatMoney(selected.balance)}
                </p>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                <Info label="Начислено" value={formatMoney(selected.periodAccrued)} />
                <Info label="Выплачено" value={formatMoney(selected.periodPaid)} />
                <Info label="Работ" value={`${selected.periodWorks}`} />
              </div>

              <div className="mt-5 space-y-3">
                <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                  <Field label="Сумма выплаты">
                    <Input
                      type="number"
                      min={0}
                      value={paymentAmount}
                      placeholder={selected.balance > 0 ? String(selected.balance) : "0"}
                      onChange={(event) => setPaymentAmount(event.target.value)}
                    />
                  </Field>
                  <Field label="Способ">
                    <NativeSelect value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value as PaymentMethod)}>
                      {paymentMethods.filter((method) => method !== "Не оплачено").map((method) => <option key={method} value={method}>{method}</option>)}
                    </NativeSelect>
                  </Field>
                </div>
                <Field label="Комментарий">
                  <Input value={paymentComment} onChange={(event) => setPaymentComment(event.target.value)} placeholder="Аванс, зарплата, корректировка" />
                </Field>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    variant="secondary"
                    disabled={selected.balance <= 0}
                    onClick={() => {
                      setPaymentAmount(String(Math.max(0, selected.balance)));
                      registerPayment(selected.id, Math.max(0, selected.balance), paymentComment || "Закрытие остатка");
                    }}
                  >
                    Весь остаток
                  </Button>
                  <Button onClick={() => registerPayment(selected.id, Number(paymentAmount) || 0)}>
                    Записать выплату
                  </Button>
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-border/60 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold">Лента расчётов</h3>
                  <p className="text-sm text-muted-foreground">{selectedTimeline.length} операций</p>
                </div>
                <Badge>{selected.percent}%</Badge>
              </div>
              <div className="mt-4 max-h-[520px] space-y-3 overflow-auto pr-1">
                {selectedTimeline.length ? selectedTimeline.slice(0, 24).map((event) => (
                  <div key={event.id} className="grid grid-cols-[18px_1fr] gap-3 text-sm">
                    <div className="flex flex-col items-center">
                      <span className={cn("mt-1 h-2.5 w-2.5 rounded-full", event.kind === "accrual" ? "bg-blue-500" : "bg-emerald-500")} />
                      <span className="mt-1 h-full w-px bg-border" />
                    </div>
                    <div className="pb-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{event.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {event.date ? formatDate(event.date) : "Ранее"}{event.time ? ` · ${event.time}` : ""} · {event.meta}
                          </p>
                        </div>
                        <p className={cn("shrink-0 font-semibold", event.kind === "accrual" ? "text-blue-700" : "text-emerald-700")}>
                          {formatSignedMoney(event.amount)}
                        </p>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">Баланс после: {formatMoney(event.balanceAfter)}</p>
                    </div>
                  </div>
                )) : (
                  <p className="text-sm text-muted-foreground">Движений пока нет.</p>
                )}
              </div>
            </section>
          </aside>
        ) : (
          <EmptyState title="Сотрудников пока нет" text="Добавьте первого сотрудника, чтобы вести расчёты." />
        )}
      </div>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Новый сотрудник</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Field label="Имя">
              <Input
                value={newMechanic}
                placeholder="Например, Алексей"
                onChange={(event) => setNewMechanic(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && addMechanic()}
              />
            </Field>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAddDialogOpen(false)}>Отмена</Button>
              <Button onClick={addMechanic}>Добавить</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Профиль сотрудника</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_120px_150px]">
              <Field label="Имя">
                <Input value={profileDraft.name} onChange={(event) => setProfileDraft((draft) => ({ ...draft, name: event.target.value }))} />
              </Field>
              <Field label="Процент">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={profileDraft.percent}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, percent: event.target.value }))}
                />
              </Field>
              <Field label="Выдано всего">
                <Input
                  type="number"
                  min={0}
                  value={profileDraft.paid}
                  onChange={(event) => setProfileDraft((draft) => ({ ...draft, paid: event.target.value }))}
                />
              </Field>
            </div>
            <div className="flex flex-col gap-2 border-t border-border/60 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="secondary"
                className="text-red-500 hover:bg-red-50 hover:text-red-600"
                disabled={selectedHasVisits}
                onClick={deleteSelectedMechanic}
              >
                <Trash2 className="h-4 w-4" />
                Удалить
              </Button>
              <div className="flex justify-end gap-2">
                <Button variant="secondary" onClick={() => setProfileOpen(false)}>Отмена</Button>
                <Button onClick={saveProfile}>Сохранить</Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
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
  const [newService, setNewService] = useState({ name: "", price: "", category: "Общие" });
  const [newMechanic, setNewMechanic] = useState("");
  const preferences = state.preferences;

  const updateMechanic = (id: string, patch: Partial<Mechanic>) =>
    setState((current) => {
      const currentMechanic = current.mechanics.find((item) => item.id === id);
      const nextName = patch.name?.trim();
      return {
        ...current,
        mechanics: current.mechanics.map((item) =>
          item.id === id
            ? {
                ...item,
                ...patch,
                percent: patch.percent === undefined ? item.percent : Math.min(100, Math.max(0, patch.percent)),
                paid: patch.paid === undefined ? item.paid : Math.max(0, patch.paid)
              }
            : item
        ),
        visits: nextName && currentMechanic
          ? current.visits.map((visit) =>
              visit.mechanicId === id || visit.mechanic === currentMechanic.name
                ? { ...visit, mechanicId: id, mechanic: nextName }
                : visit
            )
          : current.visits
      };
    });

  const addMechanic = () => {
    const name = newMechanic.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      mechanics: [
        ...current.mechanics,
        {
          id: nextMechanicId(current.mechanics),
          name,
          percent: current.preferences.defaultMechanicPercent,
          paid: 0
        }
      ]
    }));
    setNewMechanic("");
  };

  const removeMechanic = (id: string) =>
    setState((current) => {
      const hasVisits = current.visits.some((visit) => visit.mechanicId === id || findMechanic(current.mechanics, visit)?.id === id);
      if (hasVisits) return current;
      return { ...current, mechanics: current.mechanics.filter((item) => item.id !== id) };
    });

  const addService = () => {
    const name = newService.name.trim();
    if (!name) return;
    setState((current) => {
      const exists = current.services.some((service) => service.name.toLowerCase() === name.toLowerCase());
      if (exists) return current;
      return {
        ...current,
        services: [
          ...current.services,
          {
            id: nextServiceId(current.services),
            name,
            price: Math.max(0, Number(newService.price) || 0),
            category: newService.category.trim() || "Общие"
          }
        ]
      };
    });
    setNewService({ name: "", price: "", category: "Общие" });
  };

  const updateService = (id: string, patch: Partial<ServiceItem>) =>
    setState((current) => ({
      ...current,
      services: current.services.map((service) =>
        service.id === id
          ? {
              ...service,
              ...patch,
              price: patch.price === undefined ? service.price : Math.max(0, patch.price),
              category: patch.category === undefined ? service.category : patch.category || "Общие"
            }
          : service
      )
    }));

  const removeService = (id: string) =>
    setState((current) => ({ ...current, services: current.services.filter((item) => item.id !== id) }));

  const updateCompany = (patch: Partial<CompanySettings>) =>
    setState((current) => ({ ...current, company: { ...current.company, ...patch } }));

  const updatePreferences = (patch: Partial<AppPreferences>) =>
    setState((current) => ({
      ...current,
      preferences: { ...current.preferences, ...patch }
    }));

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-semibold">Настройки</h2>
        <p className="text-sm text-muted-foreground">Справочники, реквизиты и рабочие правила автосервиса.</p>
      </div>

      <Tabs defaultValue="mechanics" className="space-y-5">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="mechanics">Мастера</TabsTrigger>
          <TabsTrigger value="services">Услуги</TabsTrigger>
          <TabsTrigger value="company">Реквизиты</TabsTrigger>
          <TabsTrigger value="rules">Правила</TabsTrigger>
        </TabsList>

        <TabsContent value="mechanics">
          <Card>
            <CardHeader>
              <CardTitle>Настройки мастеров</CardTitle>
              <p className="text-sm text-muted-foreground">Имена и процент начисления. Зарплаты и остатки вынесены в раздел «Сотрудники».</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground sm:grid sm:grid-cols-[1fr_120px_40px]">
                <span>Имя</span>
                <span>Процент</span>
                <span></span>
              </div>
              {state.mechanics.map((mechanic) => (
                <div key={mechanic.id} className="grid gap-3 sm:grid-cols-[1fr_120px_40px] sm:items-center">
                  <Input
                    value={mechanic.name}
                    onChange={(event) => updateMechanic(mechanic.id, { name: event.target.value })}
                  />
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={mechanic.percent}
                    onChange={(event) => updateMechanic(mechanic.id, { percent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                  />
                  <Button variant="secondary" size="sm" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => removeMechanic(mechanic.id)} title="Удалить мастера">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <div className="grid gap-2 pt-2 sm:grid-cols-[1fr_140px_auto]">
                <Input
                  value={newMechanic}
                  placeholder="Имя нового мастера"
                  onChange={(event) => setNewMechanic(event.target.value)}
                  onKeyDown={(event) => event.key === "Enter" && addMechanic()}
                />
                <div className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-muted-foreground">
                  {preferences.defaultMechanicPercent}% по умолчанию
                </div>
                <Button variant="secondary" onClick={addMechanic}>
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Справочник услуг</CardTitle>
              <p className="text-sm text-muted-foreground">Цена подставляется в новый заезд при выборе услуги из списка.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="hidden gap-3 px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground lg:grid lg:grid-cols-[1.4fr_160px_180px_40px]">
                <span>Услуга</span>
                <span>Цена</span>
                <span>Категория</span>
                <span></span>
              </div>
              {state.services.map((service) => (
                <div key={service.id} className="grid gap-3 lg:grid-cols-[1.4fr_160px_180px_40px] lg:items-center">
                  <Input value={service.name} onChange={(event) => updateService(service.id, { name: event.target.value })} />
                  <Input
                    type="number"
                    min={0}
                    value={service.price}
                    onChange={(event) => updateService(service.id, { price: Number(event.target.value) || 0 })}
                  />
                  <Input value={service.category} onChange={(event) => updateService(service.id, { category: event.target.value })} />
                  <Button variant="secondary" size="sm" className="h-9 w-9 p-0 text-red-500 hover:bg-red-50 hover:text-red-600" onClick={() => removeService(service.id)} title="Удалить услугу">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {!state.services.length && <p className="text-sm text-muted-foreground">Услуги не добавлены.</p>}
              <div className="grid gap-2 border-t border-border/60 pt-4 lg:grid-cols-[1.4fr_160px_180px_auto]">
                <Input
                  value={newService.name}
                  placeholder="Новая услуга"
                  onChange={(event) => setNewService((current) => ({ ...current, name: event.target.value }))}
                  onKeyDown={(event) => event.key === "Enter" && addService()}
                />
                <Input
                  type="number"
                  min={0}
                  value={newService.price}
                  placeholder="Цена"
                  onChange={(event) => setNewService((current) => ({ ...current, price: event.target.value }))}
                />
                <Input
                  value={newService.category}
                  placeholder="Категория"
                  onChange={(event) => setNewService((current) => ({ ...current, category: event.target.value }))}
                />
                <Button variant="secondary" onClick={addService}>
                  <Plus className="h-4 w-4" />
                  Добавить
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company">
          <Card>
            <CardHeader>
              <CardTitle>Реквизиты автосервиса</CardTitle>
              <p className="text-sm text-muted-foreground">Эти данные используются в заказ-нарядах и печатных документах.</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Название">
                <Input value={state.company.name} onChange={(event) => updateCompany({ name: event.target.value })} />
              </Field>
              <Field label="Юридическое название">
                <Input value={state.company.legalName ?? ""} onChange={(event) => updateCompany({ legalName: event.target.value })} />
              </Field>
              <Field label="Телефон">
                <Input value={state.company.phone} onChange={(event) => updateCompany({ phone: event.target.value })} />
              </Field>
              <Field label="Адрес">
                <Input value={state.company.address} onChange={(event) => updateCompany({ address: event.target.value })} />
              </Field>
              <Field label="Email">
                <Input value={state.company.email ?? ""} onChange={(event) => updateCompany({ email: event.target.value })} />
              </Field>
              <Field label="Сайт">
                <Input value={state.company.website ?? ""} onChange={(event) => updateCompany({ website: event.target.value })} />
              </Field>
              <Field label="ИНН">
                <Input value={state.company.taxId ?? ""} onChange={(event) => updateCompany({ taxId: event.target.value })} />
              </Field>
              <Field label="ОГРН / ОГРНИП">
                <Input value={state.company.registrationId ?? ""} onChange={(event) => updateCompany({ registrationId: event.target.value })} />
              </Field>
              <Field label="Режим работы">
                <Input value={state.company.workHours ?? ""} onChange={(event) => updateCompany({ workHours: event.target.value })} />
              </Field>
              <Field label="Руководитель">
                <Input value={state.company.director ?? ""} onChange={(event) => updateCompany({ director: event.target.value })} />
              </Field>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules">
          <Card>
            <CardHeader>
              <CardTitle>Рабочие правила</CardTitle>
              <p className="text-sm text-muted-foreground">Настройки по умолчанию для новых документов, мастеров и клиентской базы.</p>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Field label="Способ оплаты по умолчанию">
                <NativeSelect
                  value={preferences.defaultPaymentMethod}
                  onChange={(event) => updatePreferences({ defaultPaymentMethod: event.target.value as PaymentMethod })}
                >
                  {paymentMethods.map((method) => <option key={method} value={method}>{method}</option>)}
                </NativeSelect>
              </Field>
              <Field label="Процент нового мастера">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={preferences.defaultMechanicPercent}
                  onChange={(event) => updatePreferences({ defaultMechanicPercent: Math.min(100, Math.max(0, Number(event.target.value) || 0)) })}
                />
              </Field>
              <Field label="Гарантия, дней">
                <Input
                  type="number"
                  min={0}
                  value={preferences.warrantyDays}
                  onChange={(event) => updatePreferences({ warrantyDays: Math.max(0, Number(event.target.value) || 0) })}
                />
              </Field>
              <Field label="Префикс заказ-наряда">
                <Input value={preferences.orderPrefix} onChange={(event) => updatePreferences({ orderPrefix: event.target.value })} />
              </Field>
              <label className="flex items-center gap-3 rounded-lg border border-border/60 bg-slate-50/70 px-3 py-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={preferences.requirePhoneForClient}
                  onChange={(event) => updatePreferences({ requirePhoneForClient: event.target.checked })}
                />
                Требовать телефон в карточке клиента
              </label>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
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
