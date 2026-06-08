# Cladtek Quality Inspector Mobile App

Tahap 9 menambahkan React Native Expo app untuk Inspector. Post Tahap 10 gap pass memperluasnya dengan issue attachment, push token registration, local issue draft, and runtime storage integration.

## Workspace

- App: `apps/mobile`
- Entry: `apps/mobile/src/App.tsx`
- Expo config: `apps/mobile/app.json`
- Expo display name: `Cladtek Quality Inspector`
- Mobile header/login/boot screen display Cladtek branding.

Commands:

```bash
npm run mobile:start
npm run mobile:typecheck
npm run mobile:build
```

## API URL

Default API URL:

```txt
http://127.0.0.1:3000
```

API URL dapat diubah dari login/profile screen. Untuk Android emulator biasanya gunakan host LAN atau emulator host sesuai environment lokal.

## Demo Inspector Login

Pastikan akun demo tersedia:

```bash
npm run db:seed:demo
```

Login:

```txt
Email: inspector@qims.local
Password: QimsDemo123!
```

## Implemented Screens

### Login

Consumes:

- `POST /api/auth/login`
- `GET /api/me`

Mobile menyimpan session cookie di AsyncStorage untuk request berikutnya.

### Today's Mission

Consumes:

- `GET /api/inspector/today-mission`

Shows:

- current area
- shift
- active task count
- pending SOP count
- unread notification count
- top priority task
- quick actions to Tasks, SOP, Handover

Mission response is cached locally. If refresh fails, app displays cached mission and offline indicator.

### Tasks

Consumes:

- `GET /api/tasks`
- `POST /api/tasks/:id/acknowledge`
- `PATCH /api/tasks/:id/status`

Actions:

- acknowledge
- start / in progress
- blocked
- done

### SOP

Consumes:

- `GET /api/procedures`
- `POST /api/procedure-versions/:id/acknowledge`

Critical SOP sends `criticalConfirmed: true`.

### Handover

Consumes:

- `GET /api/handovers`
- `POST /api/offline-drafts`
- `POST /api/handovers`

Local draft is saved to AsyncStorage and can also be saved to backend offline draft contract. Submit uses explicit handover API.

### Issues

Consumes:

- `GET /api/issues`
- `POST /api/issues`
- `POST /api/storage/signed-upload`
- `PUT /api/storage/local-upload?objectKey=...`
- `POST /api/offline-drafts`

Issue form uses current assignment area and shift assignment when available. User can pick an image, app resizes/compresses to JPEG, uploads through the signed upload contract, and sends `attachmentUrl` to issue creation. Local issue draft is stored in AsyncStorage and can be saved through the offline draft API.

### Notifications

Consumes:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

Priority and notification changes are visible through refresh. The web/backend runtime also writes local realtime events; native push provider delivery still requires external credentials.

### Profile & Eco Mode

Consumes:

- `GET /api/inspector/settings`
- `PATCH /api/inspector/settings`
- `POST /api/device-tokens`
- `POST /api/auth/logout`

Supports:

- Eco mode
- Low data
- Background sync setting
- Expo notification permission request
- device token registration
- local/dev fallback token registration when production push token is unavailable
- API URL update
- logout

## Offline Behavior

Implemented:

- cached Today Mission in AsyncStorage
- visible offline indicator when refresh fails
- local handover draft in AsyncStorage
- local issue draft in AsyncStorage
- backend offline draft save via `POST /api/offline-drafts`
- manual sync/save for handover and issue drafts

Not yet implemented:

- automatic background sync queue
- production push provider delivery without Expo/FCM/APNs credential
- production object storage without Supabase/S3/R2 credential
- native realtime subscription without deployment provider

## Checks

Verified:

- mobile TypeScript typecheck
- Expo Android export bundle
- backend Inspector login contract
- issue photo upload path through API smoke
- device token registration through API smoke
- existing web/backend typecheck, lint, test, build, audit high
