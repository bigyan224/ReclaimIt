# ReclaimIt - Admin API Backend

Admin APIs are hosted inside the main ReclaimIt Express server under `/api/admin/*`.

This folder owns the admin-only backend surface for the admin website:

```txt
backend/src/admin/
|-- README.md
|-- controllers/
|   |-- chats.controller.js
|   |-- dashboard.controller.js
|   |-- items.controller.js
|   |-- matching.controller.js
|   `-- users.controller.js
|-- middleware/
|   `-- adminAuth.middleware.js
|-- models/
|   `-- adminConfig.model.js
|-- routes.js
`-- utils/
    |-- constants.js
    |-- ids.js
    |-- matchingConfig.js
    `-- pagination.js
```

Shared app models still live in `backend/src/models/` because admin actions moderate the same `Item`, `User`, `MatchedItem`, `Chat`, `Message`, and `Notification` collections used by the mobile app.

## Security

All admin routes are protected by `requireAdmin`:

1. Verifies the Clerk bearer token.
2. Allows local users with `User.role === "ADMIN"`.
3. Allows Clerk users with `publicMetadata.role === "admin"`.
4. Best-effort syncs role and ban changes back to Clerk when SDK methods are available.

## Routes

Mounted in `backend/src/app.js`:

```js
app.use("/api/admin", adminRoute);
```

### Dashboard

* `GET /api/admin/dashboard/stats`
* `GET /api/admin/dashboard/analytics`

### Moderation

* `GET /api/admin/items`
* `PUT /api/admin/items/:id/status`
* `PUT /api/admin/items/:id`
* `DELETE /api/admin/items/:id`

### Users

* `GET /api/admin/users`
* `PUT /api/admin/users/:id/ban`
* `PUT /api/admin/users/:id/role`
* `PUT /api/admin/users/:id/status`

### Matching

* `GET /api/admin/matching/matches`
* `POST /api/admin/matching/override`
* `GET /api/admin/matching/config`
* `PUT /api/admin/matching/config`

### Chats

* `GET /api/admin/chats/disputes`
* `GET /api/admin/chats/:id/transcript`
