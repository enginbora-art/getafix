# Getafix

AI destekli çok-ajanlı borsa forecast platformu. BIST ve US piyasaları için günlük hisse önerileri üretir.

## Mimari

- **Backend**: Node.js + Express + Prisma (PostgreSQL)
- **Frontend**: React + Vite + Tailwind CSS
- **AI**: Anthropic Claude (çok-ajanlı — teknik, temel, sentiment, yönetici)
- **Deploy**: Render.com

## Başlatma (Development)

```bash
# Backend
cd backend
cp .env.example .env  # .env düzenle
npm run db:migrate
npm run db:seed
npm run dev

# Frontend
cd frontend
npm run dev
```

## Forecast Zamanlama

| Market | Tür | UTC | TR Saati |
|--------|-----|-----|----------|
| BIST | Sabah | 21:15 | 00:15 |
| BIST | Kapanış | 15:15 | 18:15 |
| US | Sabah | 12:10 | 15:10 |
| US | Kapanış | 20:15 | 23:15 |

## Admin Hesabı (Seed sonrası)

- Email: `admin@getafix.app`
- Şifre: `GetafixAdmin2024!`
