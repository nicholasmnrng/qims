# QIMS Mobile App Inspector

Tahap 9 menambahkan baseline React Native Expo app untuk Inspector.

## Workspace

- App: `apps/mobile`
- Entry: `apps/mobile/src/App.tsx`
- Expo config: `apps/mobile/app.json`

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

Issue form uses current assignment area and shift assignment when available.

### Notifications

Consumes:

- `GET /api/notifications`
- `PATCH /api/notifications/:id/read`

### Profile & Eco Mode

Consumes:

- `GET /api/inspector/settings`
- `PATCH /api/inspector/settings`
- `POST /api/auth/logout`

Supports:

- Eco mode
- Low data
- Background sync setting
- API URL update
- logout

## Offline Behavior

Implemented:

- cached Today Mission in AsyncStorage
- visible offline indicator when refresh fails
- local handover draft in AsyncStorage
- backend offline draft save via `POST /api/offline-drafts`

Not yet implemented:

- automatic background sync queue
- device-level push notification registration
- attachment/image compression/upload

## Checks

Tahap 9 verified:

- mobile TypeScript typecheck
- Expo Android export bundle
- backend Inspector login contract
- existing web/backend typecheck, lint, test, build, audit high
