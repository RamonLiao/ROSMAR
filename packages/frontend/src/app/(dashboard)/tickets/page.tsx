"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";
import { Plus, Globe, Check, ChevronsUpDown, Pencil, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  useTickets,
  useCreateTicket,
  useUpdateTicket,
  useDeleteTicket,
} from "@/lib/hooks/use-tickets";

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignee: string | null;
  slaDeadline: string | null;
  createdAt: string;
  [key: string]: unknown;
}

/* ── Brand-aligned badge styles ── */
const statusStyles: Record<string, string> = {
  open: "bg-teal-100 text-teal-700 border border-teal-200 dark:bg-primary/15 dark:text-primary dark:border-primary/30",
  in_progress: "bg-sky-100 text-sky-700 border border-sky-200 dark:bg-sky-500/15 dark:text-sky-400 dark:border-sky-400/30",
  waiting: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  resolved: "bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-400/30",
  closed: "bg-slate-100 text-slate-500 border border-slate-200 dark:bg-muted/50 dark:text-muted-foreground/60 dark:border-border/50",
};

const priorityStyles: Record<string, string> = {
  low: "bg-slate-100 text-slate-600 border border-slate-200 dark:bg-muted dark:text-muted-foreground dark:border-border",
  medium: "bg-teal-50 text-teal-700 border border-teal-200 dark:bg-primary/10 dark:text-primary dark:border-primary/20",
  high: "bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-400/30",
  critical: "bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-400/30",
};

/* ── Timezone helpers ── */
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function getOffset(tz: string): string {
  try {
    return (
      new Intl.DateTimeFormat("en", { timeZone: tz, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

function getOffsetMinutes(tz: string): number {
  try {
    const offset = getOffset(tz); // e.g. "GMT+8", "GMT-5:30"
    const m = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
    if (!m) return 0;
    const sign = m[1] === "+" ? 1 : -1;
    return sign * (parseInt(m[2]) * 60 + parseInt(m[3] || "0"));
  } catch {
    return 0;
  }
}

/** "Asia/Taipei" → "Taipei" */
function cityName(tz: string) {
  return tz.split("/").pop()!.replace(/_/g, " ");
}

/**
 * IANA timezone → ISO 3166-1 alpha-2 country code.
 * Source: IANA zone1970.tab (comprehensive mapping).
 */
const TZ_CC: Record<string, string> = {
  // ── Africa ──
  "Africa/Abidjan":"CI","Africa/Accra":"GH","Africa/Addis_Ababa":"ET","Africa/Algiers":"DZ",
  "Africa/Asmara":"ER","Africa/Bamako":"ML","Africa/Bangui":"CF","Africa/Banjul":"GM",
  "Africa/Bissau":"GW","Africa/Blantyre":"MW","Africa/Brazzaville":"CG","Africa/Bujumbura":"BI",
  "Africa/Cairo":"EG","Africa/Casablanca":"MA","Africa/Ceuta":"ES","Africa/Conakry":"GN",
  "Africa/Dakar":"SN","Africa/Dar_es_Salaam":"TZ","Africa/Djibouti":"DJ","Africa/Douala":"CM",
  "Africa/El_Aaiun":"EH","Africa/Freetown":"SL","Africa/Gaborone":"BW","Africa/Harare":"ZW",
  "Africa/Johannesburg":"ZA","Africa/Juba":"SS","Africa/Kampala":"UG","Africa/Khartoum":"SD",
  "Africa/Kigali":"RW","Africa/Kinshasa":"CD","Africa/Lagos":"NG","Africa/Libreville":"GA",
  "Africa/Lome":"TG","Africa/Luanda":"AO","Africa/Lubumbashi":"CD","Africa/Lusaka":"ZM",
  "Africa/Malabo":"GQ","Africa/Maputo":"MZ","Africa/Maseru":"LS","Africa/Mbabane":"SZ",
  "Africa/Mogadishu":"SO","Africa/Monrovia":"LR","Africa/Nairobi":"KE","Africa/Ndjamena":"TD",
  "Africa/Niamey":"NE","Africa/Nouakchott":"MR","Africa/Ouagadougou":"BF",
  "Africa/Porto-Novo":"BJ","Africa/Sao_Tome":"ST","Africa/Tripoli":"LY","Africa/Tunis":"TN",
  "Africa/Windhoek":"NA",
  // ── America ──
  "America/Adak":"US","America/Anchorage":"US","America/Anguilla":"AI","America/Antigua":"AG",
  "America/Araguaina":"BR","America/Argentina/Buenos_Aires":"AR","America/Argentina/Catamarca":"AR",
  "America/Argentina/Cordoba":"AR","America/Argentina/Jujuy":"AR","America/Argentina/La_Rioja":"AR",
  "America/Argentina/Mendoza":"AR","America/Argentina/Rio_Gallegos":"AR",
  "America/Argentina/Salta":"AR","America/Argentina/San_Juan":"AR","America/Argentina/San_Luis":"AR",
  "America/Argentina/Tucuman":"AR","America/Argentina/Ushuaia":"AR","America/Aruba":"AW",
  "America/Asuncion":"PY","America/Atikokan":"CA","America/Bahia":"BR","America/Bahia_Banderas":"MX",
  "America/Barbados":"BB","America/Belem":"BR","America/Belize":"BZ","America/Blanc-Sablon":"CA",
  "America/Boa_Vista":"BR","America/Bogota":"CO","America/Boise":"US","America/Cambridge_Bay":"CA",
  "America/Campo_Grande":"BR","America/Cancun":"MX","America/Caracas":"VE","America/Cayenne":"GF",
  "America/Cayman":"KY","America/Chicago":"US","America/Chihuahua":"MX","America/Ciudad_Juarez":"MX",
  "America/Costa_Rica":"CR","America/Creston":"CA","America/Cuiaba":"BR","America/Curacao":"CW",
  "America/Danmarkshavn":"GL","America/Dawson":"CA","America/Dawson_Creek":"CA","America/Denver":"US",
  "America/Detroit":"US","America/Dominica":"DM","America/Edmonton":"CA","America/Eirunepe":"BR",
  "America/El_Salvador":"SV","America/Fort_Nelson":"CA","America/Fortaleza":"BR",
  "America/Glace_Bay":"CA","America/Goose_Bay":"CA","America/Grand_Turk":"TC",
  "America/Grenada":"GD","America/Guadeloupe":"GP","America/Guatemala":"GT","America/Guayaquil":"EC",
  "America/Guyana":"GY","America/Halifax":"CA","America/Havana":"CU","America/Hermosillo":"MX",
  "America/Indiana/Indianapolis":"US","America/Indiana/Knox":"US","America/Indiana/Marengo":"US",
  "America/Indiana/Petersburg":"US","America/Indiana/Tell_City":"US","America/Indiana/Vevay":"US",
  "America/Indiana/Vincennes":"US","America/Indiana/Winamac":"US","America/Inuvik":"CA",
  "America/Iqaluit":"CA","America/Jamaica":"JM","America/Juneau":"US",
  "America/Kentucky/Louisville":"US","America/Kentucky/Monticello":"US","America/Kralendijk":"BQ",
  "America/La_Paz":"BO","America/Lima":"PE","America/Los_Angeles":"US",
  "America/Lower_Princes":"SX","America/Maceio":"BR","America/Managua":"NI","America/Manaus":"BR",
  "America/Marigot":"MF","America/Martinique":"MQ","America/Matamoros":"MX","America/Mazatlan":"MX",
  "America/Menominee":"US","America/Merida":"MX","America/Metlakatla":"US",
  "America/Mexico_City":"MX","America/Miquelon":"PM","America/Moncton":"CA","America/Monterrey":"MX",
  "America/Montevideo":"UY","America/Montserrat":"MS","America/Nassau":"BS","America/New_York":"US",
  "America/Nome":"US","America/Noronha":"BR","America/North_Dakota/Beulah":"US",
  "America/North_Dakota/Center":"US","America/North_Dakota/New_Salem":"US","America/Nuuk":"GL",
  "America/Ojinaga":"MX","America/Panama":"PA","America/Paramaribo":"SR",
  "America/Phoenix":"US","America/Port-au-Prince":"HT","America/Port_of_Spain":"TT",
  "America/Porto_Velho":"BR","America/Puerto_Rico":"PR","America/Punta_Arenas":"CL",
  "America/Rankin_Inlet":"CA","America/Recife":"BR","America/Regina":"CA","America/Resolute":"CA",
  "America/Rio_Branco":"BR","America/Santarem":"BR","America/Santiago":"CL",
  "America/Santo_Domingo":"DO","America/Sao_Paulo":"BR","America/Scoresbysund":"GL",
  "America/Sitka":"US","America/St_Barthelemy":"BL","America/St_Johns":"CA","America/St_Kitts":"KN",
  "America/St_Lucia":"LC","America/St_Thomas":"VI","America/St_Vincent":"VC",
  "America/Swift_Current":"CA","America/Tegucigalpa":"HN","America/Thule":"GL",
  "America/Tijuana":"MX","America/Toronto":"CA","America/Tortola":"VG","America/Vancouver":"CA",
  "America/Whitehorse":"CA","America/Winnipeg":"CA","America/Yakutat":"US",
  // ── Antarctica ──
  "Antarctica/Casey":"AQ","Antarctica/Davis":"AQ","Antarctica/DumontDUrville":"AQ",
  "Antarctica/Macquarie":"AU","Antarctica/Mawson":"AQ","Antarctica/McMurdo":"AQ",
  "Antarctica/Palmer":"AQ","Antarctica/Rothera":"AQ","Antarctica/Syowa":"AQ",
  "Antarctica/Troll":"AQ","Antarctica/Vostok":"AQ",
  // ── Asia ──
  "Asia/Aden":"YE","Asia/Almaty":"KZ","Asia/Amman":"JO","Asia/Anadyr":"RU","Asia/Aqtau":"KZ",
  "Asia/Aqtobe":"KZ","Asia/Ashgabat":"TM","Asia/Atyrau":"KZ","Asia/Baghdad":"IQ","Asia/Bahrain":"BH",
  "Asia/Baku":"AZ","Asia/Bangkok":"TH","Asia/Barnaul":"RU","Asia/Beirut":"LB","Asia/Bishkek":"KG",
  "Asia/Brunei":"BN","Asia/Chita":"RU","Asia/Choibalsan":"MN","Asia/Colombo":"LK",
  "Asia/Damascus":"SY","Asia/Dhaka":"BD","Asia/Dili":"TL","Asia/Dubai":"AE","Asia/Dushanbe":"TJ",
  "Asia/Famagusta":"CY","Asia/Gaza":"PS","Asia/Hebron":"PS","Asia/Ho_Chi_Minh":"VN",
  "Asia/Hong_Kong":"HK","Asia/Hovd":"MN","Asia/Irkutsk":"RU","Asia/Jakarta":"ID",
  "Asia/Jayapura":"ID","Asia/Jerusalem":"IL","Asia/Kabul":"AF","Asia/Kamchatka":"RU",
  "Asia/Karachi":"PK","Asia/Kathmandu":"NP","Asia/Khandyga":"RU","Asia/Kolkata":"IN",
  "Asia/Krasnoyarsk":"RU","Asia/Kuala_Lumpur":"MY","Asia/Kuching":"MY","Asia/Kuwait":"KW",
  "Asia/Macau":"MO","Asia/Magadan":"RU","Asia/Makassar":"ID","Asia/Manila":"PH",
  "Asia/Muscat":"OM","Asia/Nicosia":"CY","Asia/Novokuznetsk":"RU","Asia/Novosibirsk":"RU",
  "Asia/Omsk":"RU","Asia/Oral":"KZ","Asia/Phnom_Penh":"KH","Asia/Pontianak":"ID",
  "Asia/Pyongyang":"KP","Asia/Qatar":"QA","Asia/Qostanay":"KZ","Asia/Qyzylorda":"KZ",
  "Asia/Riyadh":"SA","Asia/Sakhalin":"RU","Asia/Samarkand":"UZ","Asia/Seoul":"KR",
  "Asia/Shanghai":"CN","Asia/Singapore":"SG","Asia/Srednekolymsk":"RU","Asia/Taipei":"TW",
  "Asia/Tashkent":"UZ","Asia/Tbilisi":"GE","Asia/Tehran":"IR","Asia/Thimphu":"BT",
  "Asia/Tokyo":"JP","Asia/Tomsk":"RU","Asia/Ulaanbaatar":"MN","Asia/Urumqi":"CN",
  "Asia/Ust-Nera":"RU","Asia/Vientiane":"LA","Asia/Vladivostok":"RU","Asia/Yakutsk":"RU",
  "Asia/Yangon":"MM","Asia/Yekaterinburg":"RU","Asia/Yerevan":"AM",
  // ── Atlantic ──
  "Atlantic/Azores":"PT","Atlantic/Bermuda":"BM","Atlantic/Canary":"ES","Atlantic/Cape_Verde":"CV",
  "Atlantic/Faroe":"FO","Atlantic/Madeira":"PT","Atlantic/Reykjavik":"IS",
  "Atlantic/South_Georgia":"GS","Atlantic/St_Helena":"SH","Atlantic/Stanley":"FK",
  // ── Australia ──
  "Australia/Adelaide":"AU","Australia/Brisbane":"AU","Australia/Broken_Hill":"AU",
  "Australia/Darwin":"AU","Australia/Eucla":"AU","Australia/Hobart":"AU","Australia/Lindeman":"AU",
  "Australia/Lord_Howe":"AU","Australia/Melbourne":"AU","Australia/Perth":"AU","Australia/Sydney":"AU",
  // ── Europe ──
  "Europe/Amsterdam":"NL","Europe/Andorra":"AD","Europe/Astrakhan":"RU","Europe/Athens":"GR",
  "Europe/Belgrade":"RS","Europe/Berlin":"DE","Europe/Bratislava":"SK","Europe/Brussels":"BE",
  "Europe/Bucharest":"RO","Europe/Budapest":"HU","Europe/Busingen":"DE","Europe/Chisinau":"MD",
  "Europe/Copenhagen":"DK","Europe/Dublin":"IE","Europe/Gibraltar":"GI","Europe/Guernsey":"GG",
  "Europe/Helsinki":"FI","Europe/Isle_of_Man":"IM","Europe/Istanbul":"TR","Europe/Jersey":"JE",
  "Europe/Kaliningrad":"RU","Europe/Kirov":"RU","Europe/Kyiv":"UA","Europe/Lisbon":"PT",
  "Europe/Ljubljana":"SI","Europe/London":"GB","Europe/Luxembourg":"LU","Europe/Madrid":"ES",
  "Europe/Malta":"MT","Europe/Mariehamn":"AX","Europe/Minsk":"BY","Europe/Monaco":"MC",
  "Europe/Moscow":"RU","Europe/Nicosia":"CY","Europe/Oslo":"NO","Europe/Paris":"FR",
  "Europe/Podgorica":"ME","Europe/Prague":"CZ","Europe/Riga":"LV","Europe/Rome":"IT",
  "Europe/Samara":"RU","Europe/San_Marino":"SM","Europe/Sarajevo":"BA","Europe/Saratov":"RU",
  "Europe/Simferopol":"UA","Europe/Skopje":"MK","Europe/Sofia":"BG","Europe/Stockholm":"SE",
  "Europe/Tallinn":"EE","Europe/Tirane":"AL","Europe/Ulyanovsk":"RU","Europe/Vaduz":"LI",
  "Europe/Vatican":"VA","Europe/Vienna":"AT","Europe/Vilnius":"LT","Europe/Volgograd":"RU",
  "Europe/Warsaw":"PL","Europe/Zagreb":"HR","Europe/Zurich":"CH",
  // ── Indian ──
  "Indian/Antananarivo":"MG","Indian/Chagos":"IO","Indian/Christmas":"CX","Indian/Cocos":"CC",
  "Indian/Comoro":"KM","Indian/Kerguelen":"TF","Indian/Mahe":"SC","Indian/Maldives":"MV",
  "Indian/Mauritius":"MU","Indian/Mayotte":"YT","Indian/Reunion":"RE",
  // ── Pacific ──
  "Pacific/Apia":"WS","Pacific/Auckland":"NZ","Pacific/Bougainville":"PG","Pacific/Chatham":"NZ",
  "Pacific/Chuuk":"FM","Pacific/Easter":"CL","Pacific/Efate":"VU","Pacific/Fakaofo":"TK",
  "Pacific/Fiji":"FJ","Pacific/Funafuti":"TV","Pacific/Galapagos":"EC","Pacific/Gambier":"PF",
  "Pacific/Guadalcanal":"SB","Pacific/Guam":"GU","Pacific/Honolulu":"US","Pacific/Kanton":"KI",
  "Pacific/Kiritimati":"KI","Pacific/Kosrae":"FM","Pacific/Kwajalein":"MH","Pacific/Majuro":"MH",
  "Pacific/Marquesas":"PF","Pacific/Midway":"UM","Pacific/Nauru":"NR","Pacific/Niue":"NU",
  "Pacific/Norfolk":"NF","Pacific/Noumea":"NC","Pacific/Pago_Pago":"AS","Pacific/Palau":"PW",
  "Pacific/Pitcairn":"PN","Pacific/Pohnpei":"FM","Pacific/Port_Moresby":"PG",
  "Pacific/Rarotonga":"CK","Pacific/Tahiti":"PF","Pacific/Tarawa":"KI","Pacific/Tongatapu":"TO",
  "Pacific/Wake":"UM","Pacific/Wallis":"WF",
};

/** Convert country code → display name via Intl */
const countryNames = new Intl.DisplayNames(["en"], { type: "region" });

function getCountry(tz: string): string {
  const cc = TZ_CC[tz];
  if (!cc) return "";
  try { return countryNames.of(cc) ?? ""; } catch { return cc; }
}

interface TzItem {
  tz: string;
  city: string;
  country: string;
  offset: string;
  offsetMin: number;
  /** For search: "Taipei Taiwan GMT+8 Asia/Taipei" */
  searchValue: string;
}

/** Build grouped & sorted timezone list */
function buildTzGroups(localTz: string) {
  const allTz = Intl.supportedValuesOf("timeZone");
  const regionOrder = ["Asia", "Pacific", "Australia", "Europe", "Africa", "America", "Indian", "Atlantic", "Antarctica"];
  const groups: Record<string, TzItem[]> = {};

  for (const tz of allTz) {
    const region = tz.split("/")[0];
    if (!region || !tz.includes("/")) continue;
    if (!groups[region]) groups[region] = [];
    const offset = getOffset(tz);
    const city = cityName(tz);
    const country = getCountry(tz);
    groups[region].push({
      tz,
      city,
      country,
      offset,
      offsetMin: getOffsetMinutes(tz),
      searchValue: `${city} ${country} ${offset} ${tz}`,
    });
  }

  for (const region of Object.keys(groups)) {
    groups[region].sort((a, b) => a.offsetMin - b.offsetMin || a.city.localeCompare(b.city));
  }

  const sorted = regionOrder
    .filter((r) => groups[r])
    .map((r) => ({ region: r, items: groups[r] }));

  const localCity = cityName(localTz);
  const localCountry = getCountry(localTz);
  const localOffset = getOffset(localTz);
  return {
    local: { tz: localTz, city: localCity, country: localCountry, offset: localOffset },
    groups: sorted,
  };
}

function formatTzDisplay(city: string, country: string, offset: string) {
  return country ? `${city}, ${country}` : city;
}

function formatDateInTz(date: Date, tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function getSlaColor(deadline: Date) {
  const diff = deadline.getTime() - Date.now();
  if (diff <= SEVEN_DAYS_MS) return "text-rose-500 dark:text-rose-400 font-medium";
  return "text-muted-foreground";
}

export default function TicketsPage() {
  const localTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [timezone, setTimezone] = useState(localTz);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { data: tickets = [], isLoading } = useTickets();
  const createTicket = useCreateTicket();
  const updateTicket = useUpdateTicket();
  const deleteTicket = useDeleteTicket();

  const tzData = useMemo(() => buildTzGroups(localTz), [localTz]);
  const currentTzLabel = (() => {
    const city = cityName(timezone);
    const country = getCountry(timezone);
    const offset = getOffset(timezone);
    return `${formatTzDisplay(city, country, offset)} · ${offset}`;
  })();

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = fd.get("title") as string;
    const priority = fd.get("priority") as string;
    const assignee = fd.get("assignee") as string;
    const deadlineLocal = fd.get("sla_deadline") as string;

    if (!title || !deadlineLocal) return;

    createTicket.mutate(
      {
        title,
        priority: priority || "medium",
        assignee: assignee || "Support Team",
        slaDeadline: new Date(deadlineLocal).toISOString(),
      },
      { onSuccess: () => setDialogOpen(false) },
    );
  };

  const handleUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!viewTicket) return;
    const fd = new FormData(e.currentTarget);
    updateTicket.mutate(
      {
        id: viewTicket.id,
        title: fd.get("title") as string,
        status: fd.get("status") as string,
        priority: fd.get("priority") as string,
        assignee: fd.get("assignee") as string,
        slaDeadline: new Date(fd.get("sla_deadline") as string).toISOString(),
      },
      {
        onSuccess: (data) => {
          setViewTicket(data as unknown as Ticket);
          setIsEditing(false);
        },
      },
    );
  };

  const handleDelete = () => {
    if (!viewTicket) return;
    deleteTicket.mutate(viewTicket.id, {
      onSuccess: () => setViewTicket(null),
    });
  };

  /** Convert ISO to datetime-local value in selected timezone */
  const toLocalInput = (iso: string) => {
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
  };

  const columns = [
    {
      key: "title",
      label: "Title",
      render: (item: Ticket) => (
        <span className="font-medium">{item.title}</span>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (item: Ticket) => (
        <Badge variant="outline" className={statusStyles[item.status]}>
          {item.status.replace("_", " ").toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "priority",
      label: "Priority",
      render: (item: Ticket) => (
        <Badge variant="outline" className={priorityStyles[item.priority]}>
          {item.priority.toUpperCase()}
        </Badge>
      ),
    },
    {
      key: "assignee",
      label: "Assignee",
    },
    {
      key: "slaDeadline",
      label: "SLA Deadline",
      render: (item: Ticket) => {
        if (!item.slaDeadline) return <span className="text-muted-foreground">—</span>;
        const deadline = new Date(item.slaDeadline);
        return (
          <span className={getSlaColor(deadline)}>
            {formatDateInTz(deadline, timezone)}
          </span>
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      render: (item: Ticket) => (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setViewTicket(item); setIsEditing(false); }}
        >
          View
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-muted-foreground tracking-tight">
            Support ticket management with SLA tracking
          </p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Ticket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Ticket</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Title</Label>
                <Input id="title" name="title" placeholder="Describe the issue" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <select
                    id="priority"
                    name="priority"
                    defaultValue="medium"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="assignee">Assignee</Label>
                  <select
                    id="assignee"
                    name="assignee"
                    defaultValue="Support Team"
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option>Support Team</option>
                    <option>Tech Team</option>
                    <option>Product Team</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sla_deadline">SLA Deadline</Label>
                <Input id="sla_deadline" name="sla_deadline" type="datetime-local" required />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Create</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Timezone selector — searchable combobox */}
      <Popover open={tzOpen} onOpenChange={setTzOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={tzOpen}
            className="w-[320px] justify-between font-normal"
          >
            <Globe className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{currentTzLabel}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[380px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search city, country, or offset..." />
            <CommandList>
              <CommandEmpty>No timezone found.</CommandEmpty>
              <CommandGroup heading="Local">
                <CommandItem
                  value={`${tzData.local.city} ${tzData.local.country} ${tzData.local.offset} ${localTz}`}
                  onSelect={() => { setTimezone(localTz); setTzOpen(false); }}
                  className="flex items-center justify-between"
                >
                  <div className="flex items-center">
                    <Check className={cn("mr-2 h-4 w-4 shrink-0", timezone === localTz ? "opacity-100" : "opacity-0")} />
                    <div>
                      <span className="font-medium">{tzData.local.city}</span>
                      {tzData.local.country && (
                        <span className="ml-1.5 text-muted-foreground">{tzData.local.country}</span>
                      )}
                    </div>
                  </div>
                  <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground">{tzData.local.offset}</span>
                </CommandItem>
              </CommandGroup>
              {tzData.groups.map(({ region, items }) => (
                <CommandGroup key={region} heading={region}>
                  {items.map((item) => (
                    <CommandItem
                      key={item.tz}
                      value={item.searchValue}
                      onSelect={() => { setTimezone(item.tz); setTzOpen(false); }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center">
                        <Check className={cn("mr-2 h-4 w-4 shrink-0", timezone === item.tz ? "opacity-100" : "opacity-0")} />
                        <div>
                          <span className="font-medium">{item.city}</span>
                          {item.country && (
                            <span className="ml-1.5 text-muted-foreground">{item.country}</span>
                          )}
                        </div>
                      </div>
                      <span className="ml-auto pl-3 text-xs tabular-nums text-muted-foreground">{item.offset}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <DataTable
          data={tickets}
          columns={columns}
          searchable
          searchPlaceholder="Search tickets..."
        />
      )}

      {/* View / Edit Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={(open) => { if (!open) { setViewTicket(null); setIsEditing(false); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>{isEditing ? "Edit Ticket" : "Ticket Details"}</DialogTitle>
              {!isEditing && (
                <Button variant="ghost" size="sm" onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              )}
            </div>
          </DialogHeader>

          {viewTicket && !isEditing && (
            <div className="space-y-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Title</p>
                <p className="font-medium">{viewTicket.title}</p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Status</p>
                  <Badge variant="outline" className={cn("mt-1", statusStyles[viewTicket.status])}>
                    {viewTicket.status.replace("_", " ").toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Priority</p>
                  <Badge variant="outline" className={cn("mt-1", priorityStyles[viewTicket.priority])}>
                    {viewTicket.priority.toUpperCase()}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">Assignee</p>
                  <p>{viewTicket.assignee}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wider">SLA Deadline</p>
                  <p className={getSlaColor(new Date(viewTicket.slaDeadline!))}>
                    {formatDateInTz(new Date(viewTicket.slaDeadline!), timezone)}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Created</p>
                <p className="text-sm text-muted-foreground">
                  {formatDateInTz(new Date(viewTicket.createdAt), timezone)}
                </p>
              </div>
              <div className="flex justify-between pt-2">
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  Delete
                </Button>
                <Button variant="outline" onClick={() => setViewTicket(null)}>
                  Close
                </Button>
              </div>
            </div>
          )}

          {viewTicket && isEditing && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-title">Title</Label>
                <Input id="edit-title" name="title" defaultValue={viewTicket.title} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <select
                    id="edit-status"
                    name="status"
                    defaultValue={viewTicket.status}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="waiting">Waiting</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-priority">Priority</Label>
                  <select
                    id="edit-priority"
                    name="priority"
                    defaultValue={viewTicket.priority}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-assignee">Assignee</Label>
                  <select
                    id="edit-assignee"
                    name="assignee"
                    defaultValue={viewTicket.assignee ?? ""}
                    className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  >
                    <option>Support Team</option>
                    <option>Tech Team</option>
                    <option>Product Team</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-deadline">SLA Deadline</Label>
                  <Input
                    id="edit-deadline"
                    name="sla_deadline"
                    type="datetime-local"
                    defaultValue={toLocalInput(viewTicket.slaDeadline!)}
                    required
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit">Save</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
