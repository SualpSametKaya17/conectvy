# Conectvy

RustDesk / AnyDesk uzak bağlantı bilgilerini yönetmek için Windows masaüstü uygulaması.

## Teknoloji Yığını

| Katman | Teknoloji |
|--------|-----------|
| UI Framework | Next.js 14+ App Router (TypeScript) |
| UI Components | shadcn/ui + Tailwind CSS |
| Desktop Wrapper | Electron 29 |
| ORM | Prisma 5 (SQL Server provider) |
| Validation | Zod (client + server shared) |
| Forms | React Hook Form + @hookform/resolvers |
| Veritabanı | MSSQL (local) |

## Kurulum

### 1. Gereksinimler

- Node.js 20+
- MSSQL Server (local)
- Windows 10/11 (Electron hedef)

### 2. .env Dosyası

```bash
cp .env.example .env
# .env içindeki DATABASE_URL'i kendi MSSQL bilgilerinizle güncelleyin
```

### 3. Bağımlılıkları Yükle

```bash
npm install
```

### 4. Veritabanı Oluştur

```bash
# Schema'yı doğrudan DB'ye push et (migration olmadan, hızlı başlangıç)
npm run db:push

# VEYA migration tabanlı (production önerilen):
npm run db:migrate
```

### 5. Geliştirme Modu

```bash
# Sadece Next.js (web tarayıcı)
npm run dev

# Next.js + Electron (masaüstü)
npm run electron:dev
```

### 6. Production Build (Windows .exe)

```bash
# Electron main/preload TypeScript dosyalarını derle
npx tsc -p electron/tsconfig.json

# Next.js build + Electron builder
npm run electron:build
# → release/ klasörüne .exe çıkar
```

## Proje Yapısı

```
conectvy/
├── app/
│   ├── (dashboard)/          # Route group (layout: sidebar + header)
│   │   ├── dashboard/        # Dashboard sayfası (özet)
│   │   ├── connections/      # Bağlantılar CRUD
│   │   ├── companies/        # Firmalar CRUD
│   │   ├── regions/          # Bölgeler CRUD
│   │   └── settings/         # Ayarlar + DB health
│   ├── api/
│   │   ├── health/           # GET /api/health
│   │   ├── dashboard/        # GET /api/dashboard
│   │   ├── connections/      # CRUD /api/connections
│   │   ├── companies/        # CRUD /api/companies
│   │   └── regions/          # CRUD /api/regions
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── ui/                   # shadcn/ui bileşenleri (manuel)
│   ├── layout/               # Sidebar, Header
│   ├── connections/          # ConnectionForm
│   └── shared/               # CrudTable (yeniden kullanılabilir)
├── lib/
│   ├── prisma.ts             # PrismaClient singleton
│   ├── utils.ts              # cn(), apiSuccess(), formatDate()
│   └── validations/          # Zod şemaları
│       ├── connection.ts
│       ├── company.ts
│       └── region.ts
├── prisma/
│   └── schema.prisma         # SQL Server uyumlu şema
├── electron/
│   ├── main.ts               # Electron main process
│   ├── preload.ts            # contextBridge API
│   └── tsconfig.json
├── types/
│   └── electron.d.ts         # window.electron tip tanımı
├── .env.example
├── electron-builder.json
└── components.json           # shadcn/ui config
```

## Veritabanı Şeması (Özet)

```
User           → ileride auth için altyapı
Company        → Firma tanımları
Region         → Bölge tanımları (Company ile ilişkili)
Connection     → Bağlantı kayıtları (tool, remoteId, password, company, region)
Tag            → Etiketler
ConnectionTag  → Connection ↔ Tag pivot
```

## Güvenlik Notları

- Şifreler şu an plain-text (local-only mod). İleride AES-256 ile şifrelenecek.
- `contextIsolation: true`, `nodeIntegration: false` ile Electron sandbox aktif.
- Tüm API girişleri Zod ile server-side doğrulanır.
- SQL injection: Prisma ORM parametrik sorgu kullanır.

## Sayfalar ve Acceptance Criteria

### Dashboard (`/dashboard`)
- ✅ Toplam/aktif bağlantı, firma, bölge sayıları
- ✅ Son 5 güncellenen bağlantı
- ✅ Araç dağılımı badge

### Connections (`/connections`)
- ✅ Tablo: Ad, Araç (badge), Remote ID (kopyala), Şifre (gizle/göster), Firma, Bölge, Güncelleme
- ✅ Arama (name/remoteId), araç filtresi
- ✅ Yeni bağlantı dialog, düzenle/sil dropdown
- ✅ Sayfalama

### Companies (`/companies`)
- ✅ Tablo: Ad, Açıklama, Bağlantı sayısı, Bölge sayısı
- ✅ Aynı isimde firma ekleme engeli (409)

### Regions (`/regions`)
- ✅ Tablo: Ad, Firma, Açıklama, Bağlantı sayısı
- ✅ Firma seçimi Select ile

### Settings (`/settings`)
- ✅ DB health check (yeşil/kırmızı badge)
- ✅ Yenile butonu
- ✅ Uygulama bilgileri
